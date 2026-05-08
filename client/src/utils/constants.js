export const LANGUAGES = {
  python: {
    id: 'python',
    name: 'Python',
    icon: '🐍',
    monacoId: 'python',
    color: '#3776ab',
    extension: '.py',
    defaultCode: `# Python Code Workflow Visualizer
# Try running this code to see step-by-step execution!

def fibonacci(n):
    """Calculate the nth Fibonacci number"""
    if n <= 1:
        return n
    a, b = 0, 1
    for i in range(2, n + 1):
        a, b = b, a + b
    return b

def main():
    numbers = [5, 8, 10]
    results = []
    
    for num in numbers:
        result = fibonacci(num)
        results.append(result)
        print(f"fib({num}) = {result}")
    
    print(f"\\nAll results: {results}")

main()
`,
  },
  java: {
    id: 'java',
    name: 'Java',
    icon: '☕',
    monacoId: 'java',
    color: '#f89820',
    extension: '.java',
    defaultCode: `// Java Code Workflow Visualizer
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
`,
  },
};

export const EXECUTION_STATUS = {
  IDLE: 'idle',
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  ERROR: 'error',
  TIMEOUT: 'timeout',
};

export const EVENT_TYPES = {
  LINE: 'line',
  CALL: 'call',
  RETURN: 'return',
  EXCEPTION: 'exception',
  INPUT: 'input',
  OUTPUT: 'output',
};

export const REPLAY_SPEEDS = [
  { label: '0.5x', value: 2000 },
  { label: '1x', value: 1000 },
  { label: '2x', value: 500 },
  { label: '4x', value: 250 },
  { label: '8x', value: 125 },
];

export const MAX_CODE_SIZE = 50 * 1024; // 50KB
export const MAX_OUTPUT_SIZE = 1024 * 1024; // 1MB
