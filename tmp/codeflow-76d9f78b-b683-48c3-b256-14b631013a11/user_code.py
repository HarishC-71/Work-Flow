# Python Code Workflow Visualizer
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
    
    print(f"\nAll results: {results}")

main()
