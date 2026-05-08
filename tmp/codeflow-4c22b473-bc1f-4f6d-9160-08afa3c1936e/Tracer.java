import com.sun.jdi.*;
import com.sun.jdi.connect.Connector;
import com.sun.jdi.connect.LaunchingConnector;
import com.sun.jdi.event.*;
import com.sun.jdi.request.*;

import java.io.*;
import java.util.*;

/**
 * Java Execution Tracer using JDI (Java Debug Interface).
 * Supports interactive stdin and real-time snapshot streaming.
 */
public class Tracer {
    private static final String TRACE_PREFIX = "---SNAPSHOT---";
    private static long startTime;
    private static int stepCount = 0;
    private static Map<String, Object> prevVars = new HashMap<>();

    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("Usage: java Tracer <ClassName>");
            System.exit(1);
        }

        String targetClassName = args[0];
        startTime = System.currentTimeMillis();

        try {
            VirtualMachineManager vmm = Bootstrap.virtualMachineManager();
            LaunchingConnector connector = vmm.defaultConnector();

            Map<String, Connector.Argument> arguments = connector.defaultArguments();
            arguments.get("main").setValue(targetClassName);
            String classpath = System.getProperty("java.class.path");
            arguments.get("options").setValue("-cp \"" + classpath + "\"");

            VirtualMachine vm = connector.launch(arguments);

            // Forward Tracer's stdin to Target VM's stdin
            new Thread(() -> {
                try (OutputStream vmStdin = vm.process().getOutputStream()) {
                    byte[] buffer = new byte[1024];
                    int n;
                    while ((n = System.in.read(buffer)) != -1) {
                        vmStdin.write(buffer, 0, n);
                        vmStdin.flush();
                    }
                } catch (IOException e) {}
            }).start();

            // Redirect Target VM's stdout/stderr to Tracer's stdout
            new Thread(() -> redirectStream(vm.process().getInputStream(), false)).start();
            new Thread(() -> redirectStream(vm.process().getErrorStream(), true)).start();

            // vm.resume(); // REMOVED: Don't resume yet, wait for VMStartEvent in the loop

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
                            setupStepRequest(vm, cpe.thread(), targetClassName);
                        }
                    } else if (event instanceof StepEvent) {
                        StepEvent stepEvent = (StepEvent) event;
                        
                        if (isInputLine(stepEvent)) {
                            emitInputWaiting(stepEvent);
                        }
                        
                        captureSnapshot(stepEvent);
                    } else if (event instanceof VMDeathEvent || event instanceof VMDisconnectEvent) {
                        processRunning = false;
                    }
                }
                vm.resume();
            }

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private static void setupStepRequest(VirtualMachine vm, ThreadReference thread, String targetClassName) {
        // Remove existing step requests for this thread if any
        vm.eventRequestManager().deleteEventRequests(vm.eventRequestManager().stepRequests());
        
        StepRequest sr = vm.eventRequestManager().createStepRequest(thread, StepRequest.STEP_LINE, StepRequest.STEP_INTO);
        sr.addClassFilter(targetClassName);
        sr.enable();
    }

    private static boolean isInputLine(StepEvent event) {
        try {
            // Simple heuristic: check if the method or line contains "Scanner" or "nextLine" or "read"
            // In a production tracer, we would use a more robust analysis of the bytecode.
            Location loc = event.location();
            String methodName = loc.method().name();
            // Check if we are about to enter a method known for blocking input
            return methodName.contains("read") || methodName.contains("next") || methodName.contains("Scanner");
        } catch (Exception e) {
            return false;
        }
    }

    private static void emitInputWaiting(StepEvent event) {
        try {
            StackFrame frame = event.thread().frame(0);
            Location loc = frame.location();
            
            Map<String, Object> snapshot = new HashMap<>();
            snapshot.put("step", stepCount++);
            snapshot.put("line", loc.lineNumber());
            snapshot.put("event", "input_waiting");
            snapshot.put("label", "Program waiting for input...");
            snapshot.put("timestamp_ms", System.currentTimeMillis() - startTime);
            snapshot.put("variables", captureVariables(frame));
            snapshot.put("stack", captureStack(event.thread()));
            snapshot.put("stdout_delta", "");

            System.out.println(TRACE_PREFIX + toJson(snapshot));
        } catch (Exception e) {}
    }

    private static Map<String, Map<String, Object>> captureVariables(StackFrame frame) {
        Map<String, Map<String, Object>> variables = new HashMap<>();
        try {
            for (LocalVariable var : frame.visibleVariables()) {
                Value val = frame.getValue(var);
                Object serializableValue = getSerializableValue(val);
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
                stack.add(stackItem);
            }
        } catch (Exception e) {}
        return stack;
    }

    private static void captureSnapshot(StepEvent event) {
        try {
            StackFrame frame = event.thread().frame(0);
            Location loc = frame.location();

            Map<String, Object> snapshot = new HashMap<>();
            snapshot.put("step", stepCount++);
            snapshot.put("line", loc.lineNumber());
            snapshot.put("event", "line");
            snapshot.put("label", "Execute line " + loc.lineNumber());
            snapshot.put("timestamp_ms", System.currentTimeMillis() - startTime);
            snapshot.put("variables", captureVariables(frame));
            snapshot.put("stack", captureStack(event.thread()));
            snapshot.put("heap", new ArrayList<>());
            snapshot.put("stdout_delta", "");

            System.out.println(TRACE_PREFIX + toJson(snapshot));

        } catch (Exception e) {}
    }

    private static Object getSerializableValue(Value val) {
        if (val == null) return null;
        if (val instanceof StringReference) return ((StringReference) val).value();
        if (val instanceof PrimitiveValue) return val.toString();
        if (val instanceof ArrayReference) {
            ArrayReference arr = (ArrayReference) val;
            List<Object> list = new ArrayList<>();
            try {
                for (Value item : arr.getValues()) {
                    list.add(getSerializableValue(item));
                }
            } catch (Exception e) {}
            return list;
        }
        return val.toString();
    }

    private static void redirectStream(InputStream in, boolean isError) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(in))) {
            String line;
            while ((line = reader.readLine()) != null) {
                Map<String, Object> snapshot = new HashMap<>();
                snapshot.put("step", stepCount++);
                snapshot.put("event", "output");
                snapshot.put("label", "Output: " + line);
                snapshot.put("stdout_delta", line + "\n");
                snapshot.put("timestamp_ms", System.currentTimeMillis() - startTime);
                snapshot.put("variables", new HashMap<>());
                snapshot.put("stack", new ArrayList<>());
                
                System.out.println(TRACE_PREFIX + toJson(snapshot));
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
