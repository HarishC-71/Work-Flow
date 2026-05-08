fetch('http://localhost:3001/api/v1/execute', { 
  method: 'POST', 
  headers: { 'Content-Type': 'application/json' }, 
  body: JSON.stringify({ 
    language: 'java', 
    code: 'public class Main { public static void main(String[] args) { System.out.println("Hello"); } }' 
  }) 
}).then(res => res.json()).then(data => console.log(JSON.stringify(data, null, 2))).catch(console.error);
