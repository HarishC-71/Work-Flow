import sys
import json
import time
import traceback
import os
import builtins

# ─────────────────────────────────────────────────────────
#  Globals written to by the patched built-ins
# ─────────────────────────────────────────────────────────
_snapshots_out = sys.stdout   # always the real stdout
_start_time    = 0.0
_step_count    = 0
_prev_vars     = {}

def _ts():
    return (time.time() - _start_time) * 1000

def _emit(snapshot: dict):
    """Write a snapshot to the real stdout."""
    _snapshots_out.write("---SNAPSHOT---" + json.dumps(snapshot) + "\n")
    _snapshots_out.flush()

def _is_primitive(val):
    return isinstance(val, (int, float, str, bool, type(None)))

def _capture_heap_and_vars(frame):
    global _prev_vars
    variables = {}
    heap_map = {}

    def get_inspector_val(val):
        """Returns the user-friendly value to display in the Variable Inspector."""
        if _is_primitive(val):
            return val
        if isinstance(val, (list, tuple)):
            return [get_inspector_val(i) for i in val]
        if isinstance(val, set):
            return [get_inspector_val(i) for i in val]
        if isinstance(val, dict):
            return {str(k): get_inspector_val(v) for k, v in val.items()}
        # For custom objects, show Ref(TypeName) without the raw hex ID
        return f"Ref({type(val).__name__})"

    def process_heap(val, path_name=None):
        """Builds the heap map recursively."""
        if _is_primitive(val):
            return
        
        obj_id = f"0x{id(val):x}"
        type_name = type(val).__name__

        if obj_id in heap_map:
            if path_name and path_name not in heap_map[obj_id]["references"]:
                heap_map[obj_id]["references"].append(path_name)
            return

        heap_map[obj_id] = {
            "id": obj_id,
            "type": type_name,
            "value": None,
            "references": [path_name] if path_name else []
        }

        if isinstance(val, (list, tuple)):
            serialized = []
            for i, item in enumerate(val):
                process_heap(item, f"{path_name}[{i}]" if path_name else None)
                serialized.append(get_inspector_val(item))
            heap_map[obj_id]["value"] = serialized
        elif isinstance(val, set):
            serialized = []
            for item in val:
                process_heap(item, path_name if path_name else None)
                serialized.append(get_inspector_val(item))
            heap_map[obj_id]["value"] = list(serialized)
        elif isinstance(val, dict):
            serialized = {}
            for k, v in val.items():
                process_heap(v, f"{path_name}['{k}']" if path_name else None)
                serialized[str(k)] = get_inspector_val(v)
            heap_map[obj_id]["value"] = serialized
        else:
            serialized = {}
            if hasattr(val, '__dict__'):
                for k, v in val.__dict__.items():
                    if not k.startswith('__'):
                        process_heap(v, f"{path_name}.{k}" if path_name else None)
                        serialized[k] = get_inspector_val(v)
            else:
                serialized = str(val)
            heap_map[obj_id]["value"] = serialized

    # 1. Capture local variables
    for name, value in frame.f_locals.items():
        if name.startswith('__') or name.startswith('_'):
            continue
        # Exclude functions, classes, modules, and callables
        if callable(value) or type(value).__name__ in ('module', 'function', 'method', 'type', 'classobj', 'builtin_function_or_method'):
            continue
            
        process_heap(value, name)
        val_serialized = get_inspector_val(value)
        type_name = type(value).__name__
        changed = name not in _prev_vars or _prev_vars[name] != val_serialized
        variables[name] = {
            "name": name,
            "type": type_name,
            "value": val_serialized,
            "changed": changed,
            "scope": "local"
        }
        _prev_vars[name] = val_serialized

    # 2. Capture user globals
    for name, value in frame.f_globals.items():
        if name in ('__name__', '__doc__', '__package__', '__loader__', '__spec__', '__builtins__'):
            continue
        if name.startswith('_'):
            continue
        if name in variables:
            continue
        if callable(value) or type(value).__name__ in ('module', 'function', 'method', 'type', 'classobj', 'builtin_function_or_method'):
            continue
            
        process_heap(value, name)
        val_serialized = get_inspector_val(value)
        type_name = type(value).__name__
        changed = name not in _prev_vars or _prev_vars[name] != val_serialized
        variables[name] = {
            "name": name,
            "type": type_name,
            "value": val_serialized,
            "changed": changed,
            "scope": "global"
        }
        _prev_vars[name] = val_serialized

    return variables, list(heap_map.values())

def _capture_stack(frame):
    stack = []
    curr = frame
    while curr:
        if curr.f_code.co_filename.endswith('user_code.py'):
            frame_locals = {}
            for name, val in curr.f_locals.items():
                if name.startswith('__') or name.startswith('_'):
                    continue
                if callable(val) or type(val).__name__ in ('module', 'function', 'method', 'type', 'classobj', 'builtin_function_or_method'):
                    continue
                frame_locals[name] = str(val)
            stack.append({
                "function": curr.f_code.co_name,
                "line":     curr.f_lineno,
                "file":     os.path.basename(curr.f_code.co_filename),
                "locals":   frame_locals
            })
        curr = curr.f_back
    return stack

# ─────────────────────────────────────────────────────────
#  Patched input()
# ─────────────────────────────────────────────────────────
_real_input = builtins.input

def _patched_input(prompt=""):
    global _step_count
    sys.settrace(None)

    frame = sys._getframe(1)
    variables, heap = _capture_heap_and_vars(frame)
    stack     = _capture_stack(frame)
    line      = frame.f_lineno

    _emit({
        "step":         _step_count,
        "line":         line,
        "event":        "input_waiting",
        "label":        f"Program waiting for input{' (\"' + prompt + '\")' if prompt else ''}",
        "timestamp_ms": _ts(),
        "variables":    variables,
        "stack":        stack,
        "heap":         heap,
        "stdout_delta": prompt if prompt else "",
    })
    _step_count += 1

    value = _real_input("")

    variables2, heap2 = _capture_heap_and_vars(frame)

    _emit({
        "step":         _step_count,
        "line":         line,
        "event":        "input_received",
        "label":        f"Input received → \"{value}\"",
        "timestamp_ms": _ts(),
        "variables":    variables2,
        "stack":        stack,
        "heap":         heap2,
        "stdout_delta": "",
        "stdin_value":  value,
    })
    _step_count += 1

    sys.settrace(_trace_calls)
    return value

# ─────────────────────────────────────────────────────────
#  Patched print()
# ─────────────────────────────────────────────────────────
_real_print = builtins.print

def _patched_print(*args, sep=" ", end="\n", file=None, flush=False):
    global _step_count
    text = sep.join(str(a) for a in args) + end

    if file is not None and file is not sys.stdout:
        _real_print(*args, sep=sep, end=end, file=file, flush=flush)
        return

    sys.settrace(None)

    frame     = sys._getframe(1)
    variables, heap = _capture_heap_and_vars(frame)
    stack     = _capture_stack(frame)
    line      = frame.f_lineno

    _emit({
        "step":         _step_count,
        "line":         line,
        "event":        "output",
        "label":        f"Output → {text.rstrip()}",
        "timestamp_ms": _ts(),
        "variables":    variables,
        "stack":        stack,
        "heap":         heap,
        "stdout_delta": text,
    })
    _step_count += 1

    sys.settrace(_trace_calls)

# ─────────────────────────────────────────────────────────
#  sys.settrace callback
# ─────────────────────────────────────────────────────────
_max_steps = 1000

def _trace_calls(frame, event, arg):
    global _step_count

    if _step_count >= _max_steps:
        return None

    filename = frame.f_code.co_filename
    if not filename.endswith('user_code.py'):
        return _trace_calls

    if event not in ('line', 'call', 'return'):
        return _trace_calls

    variables, heap = _capture_heap_and_vars(frame)
    stack     = _capture_stack(frame)

    label = {
        'call':   f"Enter {frame.f_code.co_name}()",
        'return': f"Return from {frame.f_code.co_name}()",
        'line':   f"Execute line {frame.f_lineno}",
    }.get(event, f"Event: {event}")

    _emit({
        "step":         _step_count,
        "line":         frame.f_lineno,
        "event":        event,
        "label":        label,
        "timestamp_ms": _ts(),
        "variables":    variables,
        "stack":        stack,
        "heap":         heap,
        "stdout_delta": "",
    })
    _step_count += 1
    return _trace_calls

# ─────────────────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────────────────
def execute_user_code():
    global _start_time, _step_count, _prev_vars

    _start_time = time.time()
    _step_count = 0
    _prev_vars  = {}

    builtins.input = _patched_input
    builtins.print = _patched_print

    try:
        with open('user_code.py', 'r') as f:
            code = f.read()

        compiled_code = compile(code, 'user_code.py', 'exec')
        exec_globals  = {"__name__": "__main__"}

        sys.settrace(_trace_calls)
        exec(compiled_code, exec_globals)
        sys.settrace(None)

        final_vars = {}
        for name, val in _prev_vars.items():
            final_vars[name] = {
                "name": name,
                "type": "str" if isinstance(val, str) else type(val).__name__,
                "value": val,
                "changed": False,
                "scope": "local"
            }

        _emit({
            "step":         _step_count,
            "line":         None,
            "event":        "program_end",
            "label":        "Program finished",
            "timestamp_ms": _ts(),
            "variables":    final_vars,
            "stack":        [],
            "heap":         [],
            "stdout_delta": "",
        })
        _snapshots_out.flush()
        sys.stdout.flush()
        time.sleep(0.05)

    except Exception as e:
        sys.settrace(None)
        _emit({
            "step":         _step_count,
            "event":        "exception",
            "label":        f"Exception: {type(e).__name__}: {e}",
            "timestamp_ms": _ts(),
            "variables":    {},
            "stack":        [],
            "heap":         [],
            "stdout_delta": "",
            "exception": {
                "type":      type(e).__name__,
                "message":   str(e),
                "traceback": traceback.format_exc(),
            },
        })
    finally:
        builtins.input = _real_input
        builtins.print = _real_print
        sys.settrace(None)

if __name__ == "__main__":
    execute_user_code()
