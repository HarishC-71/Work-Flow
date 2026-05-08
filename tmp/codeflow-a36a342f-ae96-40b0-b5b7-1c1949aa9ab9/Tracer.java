import java.io.*;
import java.lang.reflect.*;
import java.util.*;

public class Tracer {
    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("Usage: java Tracer <ClassName>");
            return;
        }

        String className = args[0];
        long startTime = System.currentTimeMillis();

        try {
            Class<?> targetClass = Class.forName(className);
            Method mainMethod = targetClass.getMethod("main", String[].class);

            // Intercept System.out
            PrintStream originalOut = System.out;
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            PrintStream customOut = new PrintStream(baos) {
                @Override
                public void println(String x) {
                    super.println(x);
                    printSnapshot(originalOut, "output", startTime, baos.toString(), null);
                    baos.reset();
                }
                @Override
                public void print(String x) {
                    super.print(x);
                    printSnapshot(originalOut, "output", startTime, baos.toString(), null);
                    baos.reset();
                }
            };
            System.setOut(customOut);

            // Initial snapshot
            printSnapshot(originalOut, "call", startTime, "", null);

            // Invoke main
            String[] mainArgs = new String[0];
            mainMethod.invoke(null, (Object) mainArgs);

            // Final snapshot
            printSnapshot(originalOut, "return", startTime, "", null);

            System.setOut(originalOut);

        } catch (InvocationTargetException e) {
            System.setOut(new PrintStream(new FileOutputStream(FileDescriptor.out)));
            printSnapshot(System.out, "exception", startTime, "", e.getCause());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private static int stepCount = 0;

    private static void printSnapshot(PrintStream out, String event, long startTime, String stdoutDelta, Throwable ex) {
        StringBuilder json = new StringBuilder();
        json.append("{");
        json.append("\"step\":").append(stepCount++).append(",");
        json.append("\"line\":1,"); // Mock line number
        json.append("\"event\":\"").append(event).append("\",");
        json.append("\"timestamp_ms\":").append(System.currentTimeMillis() - startTime).append(",");
        json.append("\"variables\":{},");
        json.append("\"stack\":[{\"function\":\"main\",\"line\":1,\"file\":\"Main.java\",\"locals\":{}}],");
        json.append("\"heap\":[],");
        
        // Escape newlines in stdout
        String escapedStdout = stdoutDelta.replace("\n", "\\n").replace("\r", "\\r").replace("\"", "\\\"");
        json.append("\"stdout_delta\":\"").append(escapedStdout).append("\",");
        json.append("\"stderr_delta\":\"\"");

        if (ex != null) {
            json.append(",\"exception\":{");
            json.append("\"type\":\"").append(ex.getClass().getSimpleName()).append("\",");
            json.append("\"message\":\"").append(ex.getMessage() != null ? ex.getMessage().replace("\"", "\\\"") : "").append("\",");
            json.append("\"traceback\":\"\"");
            json.append("}");
        }

        json.append("}");
        out.println("---SNAPSHOT---" + json.toString());
    }
}
