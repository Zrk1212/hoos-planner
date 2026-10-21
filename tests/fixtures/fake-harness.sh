#!/bin/sh
# Fake browser-harness for unit tests: NEVER touches Chrome. Like the real daemon it reads the task script from
# stdin and executes it with cdp() pre-defined; this stub records closed targets on stdout instead.
exec python3 -I -c '
import sys
src = sys.stdin.read()
def cdp(method, **kw):
    if method == "Target.closeTarget":
        print("@@CLOSED " + str(kw.get("targetId", "?")) + "@@")
    return {"targetInfos": [], "sessionId": "sid", "targetId": "t-new", "result": {"value": None}}
exec(src)
'
