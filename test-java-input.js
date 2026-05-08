fetch('http://localhost:3001/api/v1/execute', { 
  method: 'POST', 
  headers: { 'Content-Type': 'application/json' }, 
  body: JSON.stringify({ 
    language: 'java', 
    code: 'import java.util.Scanner; public class Main { public static void main(String[] args) { Scanner sc = new Scanner(System.in); String name = sc.nextLine(); System.out.println("Hello " + name); } }',
    stdin: 'Alice\n'
  }) 
}).then(res => res.json()).then(data => console.log(JSON.stringify(data, null, 2))).catch(console.error);
