import com.sun.jdi.*;
import com.sun.jdi.connect.Connector;
import com.sun.jdi.connect.LaunchingConnector;
import com.sun.jdi.event.*;
import com.sun.jdi.request.*;

import java.io.*;
import java.util.*;

/**
 * Java Execution Tracer using JDI (Java Debug Interface).
 * Supports interactive stdin, real-time snapshot streaming, call-stack frame variables,
 * instance/static variables capture, and complete JDI Heap serialization.
 */
public class Tracer {
    private static final String TRACE_PREFIX = "---SNAPSHOT---";
    private static long startTime;
    private static int stepCount = 0;
    private static Map<String, Object> prevVars = new HashMap<>();
    
    // Step-local heap map to collect complex/reference object structures
    private static Map<String, Map<String, Object>> stepHeap = new LinkedHashMap<>();

    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("Usage: java Tracer <ClassName>");
            System.exit(1);
        }

        String targetClassName = args[0];
        startTime = System.currentTimeMillis();
        VirtualMachine vm = null;

        try {
            VirtualMachineManager vmm = Bootstrap.virtualMachineManager();
            LaunchingConnector connector = vmm.defaultConnector();

            Map<String, Connector.Argument> arguments = connector.defaultArguments();
            arguments.get("main").setValue(targetClassName);
            
            // Build CP options ensuring the current directory is first for local compilation loading
            // IMPORTANT: JDI's LaunchingConnector passes options directly to the JVM process,
            // NOT through a shell. Do NOT use quotes around path components — they are treated
            // as literal characters and break classpath resolution.
            String classpath = System.getProperty("java.class.path");
            String cpOption;
            if (classpath != null && !classpath.isEmpty()) {
                cpOption = "-cp ." + File.pathSeparator + classpath;
            } else {
                cpOption = "-cp .";
            }
            arguments.get("options").setValue(cpOption);

            vm = connector.launch(arguments);
            final VirtualMachine finalVm = vm;

            // Forward Tracer's stdin to Target VM's stdin
            Thread stdinThread = new Thread(() -> {
                try (OutputStream vmStdin = finalVm.process().getOutputStream()) {
                    byte[] buffer = new byte[1024];
                    int n;
                    while ((n = System.in.read(buffer)) != -1) {
                        vmStdin.write(buffer, 0, n);
                        vmStdin.flush();
                    }
                } catch (IOException e) {}
            });
            stdinThread.setDaemon(true);
            stdinThread.start();

            // Redirect Target VM's stdout/stderr to Tracer's stdout
            Thread stdoutThread = new Thread(() -> redirectStream(finalVm.process().getInputStream(), false));
            stdoutThread.setDaemon(true);
            stdoutThread.start();

            Thread stderrThread = new Thread(() -> redirectStream(finalVm.process().getErrorStream(), true));
            stderrThread.setDaemon(true);
            stderrThread.start();

            EventRequestManager erm = vm.eventRequestManager();
            // We want to know when our target class is loaded
            erm.createClassPrepareRequest().enable();

            EventSet eventSet;
            boolean processRunning = true;

            while (processRunning && (eventSet = vm.eventQueue().remove()) != null) {
                for (Event event : eventSet) {
                    if (event instanceof VMStartEvent) {
                        // Initial thread is started and suspended
                    } else if (event instanceof ClassPrepareEvent) {
                        ClassPrepareEvent cpe = (ClassPrepareEvent) event;
                        if (cpe.referenceType().name().equals(targetClassName)) {
                            setupStepRequest(vm, cpe.thread());
                        }
                    } else if (event instanceof StepEvent) {
                        StepEvent stepEvent = (StepEvent) event;
                        
                        if (isInputLine(stepEvent)) {
                            emitInputWaiting(stepEvent);
                        } else {
                            captureSnapshot(stepEvent);
                        }
                    } else if (event instanceof VMDeathEvent || event instanceof VMDisconnectEvent) {
                        processRunning = false;
                    }
                }
                if (processRunning) {
                    vm.resume();
                }
            }

            // Wait slightly for output threads to finish reading remaining bytes
            try { Thread.sleep(300); } catch (InterruptedException e) {}

            // Emit a final snapshot to signal the end
            Map<String, Object> endSnapshot = new HashMap<>();
            endSnapshot.put("step", stepCount++);
            endSnapshot.put("event", "program_end");
            endSnapshot.put("label", "Program finished");
            endSnapshot.put("timestamp_ms", System.currentTimeMillis() - startTime);
            endSnapshot.put("variables", new HashMap<>());
            endSnapshot.put("stack", new ArrayList<>());
            endSnapshot.put("heap", new ArrayList<>());
            System.out.println(TRACE_PREFIX + toJson(endSnapshot));
            System.out.flush();
            
            // Final small delay to ensure stdout is flushed to parent
            try { Thread.sleep(100); } catch (InterruptedException e) {}

            System.exit(0);

        } catch (Exception e) {
            e.printStackTrace();
            if (vm != null) {
                try {
                    vm.exit(1);
                } catch (Exception ex) {}
            }
        }
    }

    private static void setupStepRequest(VirtualMachine vm, ThreadReference thread) {
        // Remove existing step requests for this thread if any
        vm.eventRequestManager().deleteEventRequests(vm.eventRequestManager().stepRequests());
        
        StepRequest sr = vm.eventRequestManager().createStepRequest(thread, StepRequest.STEP_LINE, StepRequest.STEP_INTO);
        // Exclude system classes instead of target class filter to allow debugging helper/inner classes
        sr.addClassExclusionFilter("java.*");
        sr.addClassExclusionFilter("javax.*");
        sr.addClassExclusionFilter("sun.*");
        sr.addClassExclusionFilter("com.sun.*");
        sr.addClassExclusionFilter("jdk.*");
        sr.addClassExclusionFilter("oracle.*");
        sr.enable();
    }

    private static boolean isInputLine(StepEvent event) {
        try {
            Location loc = event.location();
            int lineNum = loc.lineNumber();
            String sourceName = loc.sourceName();
            
            File sourceFile = new File(sourceName);
            if (sourceFile.exists()) {
                try (BufferedReader reader = new BufferedReader(new FileReader(sourceFile))) {
                    String lineText = "";
                    for (int i = 0; i < lineNum; i++) {
                        lineText = reader.readLine();
                    }
                    if (lineText != null) {
                        lineText = lineText.trim();
                        // Ignore comments
                        if (lineText.startsWith("//") || lineText.startsWith("/*") || lineText.startsWith("*")) {
                            return false;
                        }
                        // Match .next...() or .read...() but not 'new Scanner'
                        return (lineText.contains(".next") || lineText.contains(".read")) && 
                               !lineText.contains("new Scanner");
                    }
                }
            }
        } catch (Exception e) {}
        return false;
    }

    private static void emitInputWaiting(StepEvent event) {
        try {
            StackFrame frame = event.thread().frame(0);
            Location loc = frame.location();
            
            stepHeap.clear(); // Clear before capturing variables
            Map<String, Map<String, Object>> vars = captureVariables(frame);
            List<Map<String, Object>> heapList = new ArrayList<>(stepHeap.values());

            Map<String, Object> snapshot = new HashMap<>();
            snapshot.put("step", stepCount++);
            snapshot.put("line", loc.lineNumber());
            snapshot.put("event", "input_waiting");
            snapshot.put("label", "Program waiting for input...");
            snapshot.put("timestamp_ms", System.currentTimeMillis() - startTime);
            snapshot.put("variables", vars);
            snapshot.put("stack", captureStack(event.thread()));
            snapshot.put("heap", heapList);
            snapshot.put("stdout_delta", "");

            System.out.println(TRACE_PREFIX + toJson(snapshot));
            System.out.flush();
        } catch (Exception e) {}
    }

    private static Map<String, Map<String, Object>> captureVariables(StackFrame frame) {
        Map<String, Map<String, Object>> variables = new HashMap<>();
        try {
            // 1. Capture 'this' reference if in instance scope
            ObjectReference thisObj = frame.thisObject();
            if (thisObj != null) {
                String name = "this";
                processHeap(thisObj, name, 0, new HashSet<>());
                Object serializableValue = getInspectorValue(thisObj);
                String typeName = thisObj.referenceType().name();
                boolean changed = !serializableValue.equals(prevVars.get(name));
                
                Map<String, Object> varInfo = new HashMap<>();
                varInfo.put("name", name);
                varInfo.put("type", typeName);
                varInfo.put("value", serializableValue);
                varInfo.put("changed", changed);
                varInfo.put("scope", "local");
                
                variables.put(name, varInfo);
                prevVars.put(name, serializableValue);
            }

            // 2. Capture static fields (class level / global scope)
            ReferenceType refType = frame.location().declaringType();
            for (Field field : refType.allFields()) {
                if (field.isStatic()) {
                    String name = refType.name() + "." + field.name();
                    Value val = refType.getValue(field);
                    processHeap(val, name, 0, new HashSet<>());
                    Object serializableValue = getInspectorValue(val);
                    String typeName = field.typeName();
                    boolean changed = !serializableValue.equals(prevVars.get(name));
                    
                    Map<String, Object> varInfo = new HashMap<>();
                    varInfo.put("name", name);
                    varInfo.put("type", typeName);
                    varInfo.put("value", serializableValue);
                    varInfo.put("changed", changed);
                    varInfo.put("scope", "global");
                    
                    variables.put(name, varInfo);
                    prevVars.put(name, serializableValue);
                }
            }

            // 3. Capture local variables
            for (LocalVariable var : frame.visibleVariables()) {
                Value val = frame.getValue(var);
                processHeap(val, var.name(), 0, new HashSet<>());
                Object serializableValue = getInspectorValue(val);
                String typeName = var.typeName();
                boolean changed = !serializableValue.equals(prevVars.get(var.name()));
                
                Map<String, Object> varInfo = new HashMap<>();
                varInfo.put("name", var.name());
                varInfo.put("type", typeName);
                varInfo.put("value", serializableValue);
                varInfo.put("changed", changed);
                varInfo.put("scope", "local");
                
                variables.put(var.name(), varInfo);
                prevVars.put(var.name(), serializableValue);
            }
        } catch (Exception e) {}
        return variables;
    }

    private static Object getInspectorValue(Value val) {
        if (val == null) return null;
        if (val instanceof StringReference) return ((StringReference) val).value();
        if (val instanceof PrimitiveValue) return val.toString();
        if (val instanceof ArrayReference) {
            ArrayReference arr = (ArrayReference) val;
            List<Object> list = new ArrayList<>();
            try {
                for (int i = 0; i < arr.length(); i++) {
                    list.add(getInspectorValue(arr.getValue(i)));
                }
            } catch (Exception e) {}
            return list;
        }
        if (val instanceof ObjectReference) {
            ObjectReference obj = (ObjectReference) val;
            String typeName = obj.referenceType().name();
            // For JDK system/common classes, just return their toString representation
            if (typeName.startsWith("java.lang.String")) {
                return obj.toString();
            }
            if (typeName.startsWith("java.") || typeName.startsWith("javax.") || typeName.startsWith("sun.")) {
                return obj.toString();
            }
            // For custom objects, show Ref(TypeName) without the unique address ID to prevent clutter
            return "Ref(" + typeName + ")";
        }
        return val.toString();
    }

    private static String getSimpleStringValue(Value val) {
        if (val == null) return "null";
        if (val instanceof StringReference) return "\"" + ((StringReference) val).value() + "\"";
        if (val instanceof PrimitiveValue) return val.toString();
        if (val instanceof ArrayReference) {
            return "Array(len=" + ((ArrayReference) val).length() + ")";
        }
        if (val instanceof ObjectReference) {
            return "Object(" + ((ObjectReference) val).referenceType().name() + ")";
        }
        return val.toString();
    }

    private static List<Map<String, Object>> captureStack(ThreadReference thread) {
        List<Map<String, Object>> stack = new ArrayList<>();
        try {
            for (int i = 0; i < thread.frameCount(); i++) {
                StackFrame f = thread.frame(i);
                Location l = f.location();
                Map<String, Object> stackItem = new HashMap<>();
                stackItem.put("function", l.method().name());
                stackItem.put("line", l.lineNumber());
                try {
                    stackItem.put("file", l.sourceName());
                } catch (Exception e) {
                    stackItem.put("file", "unknown");
                }
                
                // Extract frame locals to support StackVisualizer.jsx
                Map<String, Object> locals = new HashMap<>();
                try {
                    for (LocalVariable var : f.visibleVariables()) {
                        Value val = f.getValue(var);
                        locals.put(var.name(), getSimpleStringValue(val));
                    }
                } catch (Exception e) {}
                stackItem.put("locals", locals);
                
                stack.add(stackItem);
            }
        } catch (Exception e) {}
        return stack;
    }

    private static void captureSnapshot(StepEvent event) {
        try {
            StackFrame frame = event.thread().frame(0);
            Location loc = frame.location();

            stepHeap.clear(); // Clear before capturing variables
            Map<String, Map<String, Object>> vars = captureVariables(frame);
            List<Map<String, Object>> heapList = new ArrayList<>(stepHeap.values());

            Map<String, Object> snapshot = new HashMap<>();
            snapshot.put("step", stepCount++);
            snapshot.put("line", loc.lineNumber());
            snapshot.put("event", "line");
            snapshot.put("label", "Execute line " + loc.lineNumber());
            snapshot.put("timestamp_ms", System.currentTimeMillis() - startTime);
            snapshot.put("variables", vars);
            snapshot.put("stack", captureStack(event.thread()));
            snapshot.put("heap", heapList);
            snapshot.put("stdout_delta", "");

            System.out.println(TRACE_PREFIX + toJson(snapshot));
            System.out.flush();

        } catch (Exception e) {}
    }

    @SuppressWarnings("unchecked")
    private static void processHeap(Value val, String pathName, int depth, Set<Long> visited) {
        if (val == null || depth > 5) return;

        if (val instanceof ArrayReference) {
            ArrayReference arr = (ArrayReference) val;
            String refId = "0x" + Long.toHexString(arr.uniqueID());
            
            // Add or update heap entry
            Map<String, Object> heapEntry = stepHeap.get(refId);
            boolean isNew = false;
            if (heapEntry == null) {
                heapEntry = new LinkedHashMap<>();
                heapEntry.put("id", refId);
                heapEntry.put("type", arr.referenceType().name());
                heapEntry.put("references", new ArrayList<String>());
                stepHeap.put(refId, heapEntry);
                isNew = true;
            }
            if (pathName != null) {
                List<String> refs = (List<String>) heapEntry.get("references");
                if (!refs.contains(pathName)) {
                    refs.add(pathName);
                }
            }
            
            if (isNew) {
                List<Object> list = new ArrayList<>();
                try {
                    for (int i = 0; i < arr.length(); i++) {
                        Value item = arr.getValue(i);
                        String subPath = (pathName != null) ? pathName + "[" + i + "]" : null;
                        processHeap(item, subPath, depth + 1, visited);
                        list.add(getInspectorValue(item));
                    }
                } catch (Exception e) {}
                heapEntry.put("value", list);
            }
        }

        if (val instanceof ObjectReference) {
            ObjectReference obj = (ObjectReference) val;
            long id = obj.uniqueID();
            String refId = "0x" + Long.toHexString(id);
            
            // Add or update heap entry
            Map<String, Object> heapEntry = stepHeap.get(refId);
            boolean isNew = false;
            if (heapEntry == null) {
                heapEntry = new LinkedHashMap<>();
                heapEntry.put("id", refId);
                heapEntry.put("type", obj.referenceType().name());
                heapEntry.put("references", new ArrayList<String>());
                stepHeap.put(refId, heapEntry);
                isNew = true;
            }
            if (pathName != null) {
                List<String> refs = (List<String>) heapEntry.get("references");
                if (!refs.contains(pathName)) {
                    refs.add(pathName);
                }
            }

            if (isNew) {
                if (visited.contains(id)) {
                    heapEntry.put("value", "Ref(id=" + id + ")");
                } else {
                    visited.add(id);
                    ReferenceType type = obj.referenceType();
                    String typeName = type.name();
                    
                    // For JDK system/common classes, just return their toString representation
                    if (typeName.startsWith("java.lang.String")) {
                        heapEntry.put("value", obj.toString());
                    } else if (typeName.startsWith("java.") || typeName.startsWith("javax.") || typeName.startsWith("sun.")) {
                        heapEntry.put("value", obj.toString());
                    } else {
                        Map<String, Object> fields = new LinkedHashMap<>();
                        try {
                            for (Field field : type.allFields()) {
                                if (!field.isStatic()) {
                                    String subPath = (pathName != null) ? pathName + "." + field.name() : null;
                                    processHeap(obj.getValue(field), subPath, depth + 1, visited);
                                    fields.put(field.name(), getInspectorValue(obj.getValue(field)));
                                }
                            }
                            if (fields.isEmpty()) {
                                heapEntry.put("value", obj.toString());
                            } else {
                                heapEntry.put("value", fields);
                            }
                        } catch (Exception e) {
                            heapEntry.put("value", obj.toString());
                        }
                    }
                    visited.remove(id);
                }
            }
        }
    }

    private static void redirectStream(InputStream in, boolean isError) {
        try {
            InputStreamReader reader = new InputStreamReader(in);
            char[] buffer = new char[1024];
            int n;
            while ((n = reader.read(buffer)) != -1) {
                String text = new String(buffer, 0, n);
                Map<String, Object> snapshot = new HashMap<>();
                snapshot.put("step", stepCount++);
                snapshot.put("event", "output");
                snapshot.put("label", "Output: " + text.trim());
                snapshot.put("stdout_delta", text);
                snapshot.put("timestamp_ms", System.currentTimeMillis() - startTime);
                snapshot.put("variables", new HashMap<>());
                snapshot.put("stack", new ArrayList<>());
                snapshot.put("heap", new ArrayList<>());
                
                System.out.println(TRACE_PREFIX + toJson(snapshot));
                System.out.flush();
            }
        } catch (IOException e) {}
    }

    private static String toJson(Object obj) {
        if (obj == null) return "null";
        if (obj instanceof String) return "\"" + escape((String) obj) + "\"";
        if (obj instanceof Number || obj instanceof Boolean) return obj.toString();
        if (obj instanceof Map) {
            StringBuilder sb = new StringBuilder("{");
            Map<?, ?> map = (Map<?, ?>) obj;
            boolean first = true;
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (!first) sb.append(",");
                sb.append("\"").append(entry.getKey()).append("\":").append(toJson(entry.getValue()));
                first = false;
            }
            sb.append("}");
            return sb.toString();
        }
        if (obj instanceof List) {
            StringBuilder sb = new StringBuilder("[");
            List<?> list = (List<?>) obj;
            boolean first = true;
            for (Object item : list) {
                if (!first) sb.append(",");
                sb.append(toJson(item));
                first = false;
            }
            sb.append("]");
            return sb.toString();
        }
        return "\"" + escape(obj.toString()) + "\"";
    }

    private static String escape(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }
}
