// Java Code Workflow Visualizer
// Try running this code to see step-by-step execution!

public class Main {
    public static int fibonacci(int n) {
        if (n <= 1) return n;
        int a = 0, b = 1;
        for (int i = 2; i <= n; i++) {
            int temp = b;
            b = a + b;
            a = temp;
        }
        return b;
    }

    public static void main(String[] args) {
        int[] numbers = {5, 8, 10};
        int[] results = new int[numbers.length];
        
        for (int i = 0; i < numbers.length; i++) {
            results[i] = fibonacci(numbers[i]);
            System.out.println("fib(" + numbers[i] + ") = " + results[i]);
        }
        
        System.out.print("All results: [");
        for (int i = 0; i < results.length; i++) {
            System.out.print(results[i]);
            if (i < results.length - 1) System.out.print(", ");
        }
        System.out.println("]");
    }
}
