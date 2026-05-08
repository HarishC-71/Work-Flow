import sys
import json
import time
import traceback
import os

class TraceCollector:
    def __init__(self):
        self.snapshots = []
        self.step_count = 0
        self.start_time = time.time()
        self.max_steps = 1000
        self.prev_vars = {}

    def get_serializable(self, obj):
        if isinstance(obj, (int, float, str, bool, type(None))):
            return obj
        if isinstance(obj, (list, tuple)):
            return [self.get_serializable(item) for item in obj]
        if isinstance(obj, dict):
            return {str(k): self.get_serializable(v) for k, v in obj.items()}
        return str(obj)

    def capture_snapshot(self, frame, event, arg):
        if self.step_count >= self.max_steps:
            return

        # Filter out internal calls and non-user files
        filename = frame.f_code.co_filename
        if not filename.endswith('user_code.py'):
            return

        # Capture locals
        locals_dict = {}
        variables = {}
        
        for name, value in frame.f_locals.items():
            if name.startswith('__'): continue
            
            val_serializable = self.get_serializable(value)
            type_name = type(value).__name__
            
            changed = name not in self.prev_vars or self.prev_vars[name] != val_serializable
            
            variables[name] = {
                "name": name,
                "type": type_name,
                "value": val_serializable,
                "changed": changed,
                "scope": "local"
            }
            self.prev_vars[name] = val_serializable

        # Capture stack
        stack = []
        curr = frame
        while curr:
            if curr.f_code.co_filename.endswith('user_code.py'):
                stack.append({
                    "function": curr.f_code.co_name,
                    "line": curr.f_lineno,
                    "file": os.path.basename(curr.f_code.co_filename)
                })
            curr = curr.f_back

        snapshot = {
            "step": self.step_count,
            "line": frame.f_lineno,
            "event": event,
            "timestamp_ms": (time.time() - self.start_time) * 1000,
            "variables": variables,
            "stack": stack,
            "heap": [] # Basic Python trace doesn't easily show heap without heavy inspection
        }

        print(f"---SNAPSHOT---{json.dumps(snapshot)}")
        self.step_count += 1

    def trace_calls(self, frame, event, arg):
        self.capture_snapshot(frame, event, arg)
        return self.trace_calls

def execute_user_code():
    collector = TraceCollector()
    
    try:
        with open('user_code.py', 'r') as f:
            code = f.read()
        
        # Set the trace
        sys.settrace(collector.trace_calls)
        
        # Execute the code
        compiled_code = compile(code, 'user_code.py', 'exec')
        exec_globals = {"__name__": "__main__"}
        exec(compiled_code, exec_globals)
        
    except Exception as e:
        error_snapshot = {
            "step": collector.step_count,
            "event": "exception",
            "timestamp_ms": (time.time() - collector.start_time) * 1000,
            "exception": {
                "type": type(e).__name__,
                "message": str(e),
                "traceback": traceback.format_exc()
            }
        }
        print(f"---SNAPSHOT---{json.dumps(error_snapshot)}")
    finally:
        sys.settrace(None)

if __name__ == "__main__":
    execute_user_code()
