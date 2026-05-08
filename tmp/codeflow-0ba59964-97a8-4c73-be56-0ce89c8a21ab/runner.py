import sys
import json
import time
import traceback
import os
import io
import builtins

# ─────────────────────────────────────────────────────────
#  Globals written to by the patched built-ins
# ─────────────────────────────────────────────────────────
_snapshots_out = sys.stdout   # always the real stdout
_start_time    = 0.0
_step_count    = 0
_prev_vars     = {}
_pending_events = []          # queued synthetic events


def _ts():
    return (time.time() - _start_time) * 1000


def _emit(snapshot: dict):
    """Write a snapshot to the real stdout."""
    _snapshots_out.write("---SNAPSHOT---" + json.dumps(snapshot) + "\n")
    _snapshots_out.flush()


def _get_serializable(obj):
    if isinstance(obj, (int, float, str, bool, type(None))):
        return obj
    if isinstance(obj, (list, tuple)):
        return [_get_serializable(i) for i in obj]
    if isinstance(obj, dict):
        return {str(k): _get_serializable(v) for k, v in obj.items()}
    return str(obj)


def _capture_vars(frame):
    global _prev_vars
    variables = {}
    for name, value in frame.f_locals.items():
        if name.startswith('__'):
            continue
        val = _get_serializable(value)
        type_name = type(value).__name__
        changed = name not in _prev_vars or _prev_vars[name] != val
        variables[name] = {
            "name":    name,
            "type":    type_name,
            "value":   val,
            "changed": changed,
            "scope":   "local",
        }
        _prev_vars[name] = val
    return variables


def _capture_stack(frame):
    stack = []
    curr = frame
    while curr:
        if curr.f_code.co_filename.endswith('user_code.py'):
            stack.append({
                "function": curr.f_code.co_name,
                "line":     curr.f_lineno,
                "file":     os.path.basename(curr.f_code.co_filename),
            })
        curr = curr.f_back
    return stack


# ─────────────────────────────────────────────────────────
#  Patched input() – emits two synthetic events:
#    1. input_waiting  (before blocking)
#    2. input_received (after the value is read)
# ─────────────────────────────────────────────────────────
_real_input = builtins.input

def _patched_input(prompt=""):
    global _step_count

    # Suspend tracing so internal I/O isn't traced
    sys.settrace(None)

    # Locate the caller frame (user_code.py)
    frame = sys._getframe(1)
    variables = _capture_vars(frame)
    stack     = _capture_stack(frame)
    line      = frame.f_lineno

    # Step: waiting for input
    _emit({
        "step":         _step_count,
        "line":         line,
        "event":        "input_waiting",
        "label":        f"Program waiting for input{' (\"' + prompt + '\")' if prompt else ''}",
        "timestamp_ms": _ts(),
        "variables":    variables,
        "stack":        stack,
        "heap":         [],
        "stdout_delta": prompt if prompt else "",
    })
    _step_count += 1

    # Actually read the value (blocks until stdin provides it)
    value = _real_input("")

    # Re-capture vars (they haven't changed yet, but this is consistent)
    variables2 = _capture_vars(frame)

    # Step: input received
    _emit({
        "step":         _step_count,
        "line":         line,
        "event":        "input_received",
        "label":        f"Input received → \"{value}\"",
        "timestamp_ms": _ts(),
        "variables":    variables2,
        "stack":        stack,
        "heap":         [],
        "stdout_delta": "",
        "stdin_value":  value,
    })
    _step_count += 1

    # Re-enable tracing
    sys.settrace(_trace_calls)
    return value


# ─────────────────────────────────────────────────────────
#  Patched print() – emits an output event
# ─────────────────────────────────────────────────────────
_real_print = builtins.print

def _patched_print(*args, sep=" ", end="\n", file=None, flush=False):
    global _step_count

    # Build the text exactly as print() would
    text = sep.join(str(a) for a in args) + end

    # Suspend tracing
    sys.settrace(None)

    frame     = sys._getframe(1)
    variables = _capture_vars(frame)
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
        "heap":         [],
        "stdout_delta": text,
    })
    _step_count += 1

    # Re-enable tracing
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
        return _trace_calls   # still trace sub-calls but don't emit

    # Only emit for 'line' events (one per executed statement)
    # Skip 'call'/'return' to avoid noise — those are represented by the
    # special input_waiting/input_received/output events plus natural lines.
    if event not in ('line', 'call', 'return'):
        return _trace_calls

    variables = _capture_vars(frame)
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
        "heap":         [],
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

    # Patch builtins BEFORE exec
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

        # Emit a clean "program end" step
        # Note: We use _capture_vars(None) if we don't have a frame, 
        # but here we can't easily get the local frame of the exec.
        # However, _prev_vars has the last values, so we rebuild the objects.
        final_vars = {}
        for name, val in _prev_vars.items():
            final_vars[name] = {
                "name": name,
                "type": type(val).__name__,
                "value": val,
                "changed": false,
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
        # Restore builtins
        builtins.input = _real_input
        builtins.print = _real_print
        sys.settrace(None)


if __name__ == "__main__":
    execute_user_code()
