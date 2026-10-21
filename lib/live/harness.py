# Task helpers for browser-harness. Executed inside `browser-harness <<PY ... PY` where cdp(), js(), etc. are
# pre-imported. Every call carries an explicit session_id so we never depend on the daemon's "current" tab
# (which follows Chrome's focused tab). Never activates the user's tabs; works in its own window.
#
# Window hygiene: open_window() records every target it creates in OPENED; close() forgets it; the runner
# (lib/live/runner.ts) wraps each snippet in try/finally: close_all(), so a snippet that throws still closes
# its windows. A snippet that is SIGKILLed on timeout cannot run that finally and may leave a window open.
import json, time
from urllib.parse import urlparse

OPENED = []

class LiveFailure(Exception):
    """A deliberate, user-facing abort; the runner turns it into a LiveError with this message."""

def fail(msg):
    raise LiveFailure(msg)

def targets():
    return [t for t in cdp("Target.getTargets")["targetInfos"] if t["type"] == "page"]

def find_target(host):
    """Exact-host match only (never a substring of the URL), and https."""
    for t in targets():
        u = urlparse(t["url"])
        if u.scheme == "https" and u.hostname == host:
            return t
    return None

def attach(tid):
    return cdp("Target.attachToTarget", targetId=tid, flatten=True)["sessionId"]

def evaluate(sid, expr, timeout_s=60):
    r = cdp("Runtime.evaluate", session_id=sid, expression=expr, returnByValue=True, awaitPromise=True, timeout=timeout_s * 1000)
    if "exceptionDetails" in r:
        raise RuntimeError(r["exceptionDetails"].get("text", "evaluate failed") + ": " + json.dumps(r["exceptionDetails"].get("exception", {}).get("description", ""))[:300])
    return r.get("result", {}).get("value")

def wait_ready(sid, timeout_s=30):
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        try:
            if evaluate(sid, "document.readyState") == "complete":
                return True
        except Exception:
            pass
        time.sleep(0.5)
    return False

def open_window(url, timeout_s=30):
    """Own window on about:blank, then navigate (a window created directly on the URL can vanish)."""
    tid = cdp("Target.createTarget", url="about:blank", newWindow=True)["targetId"]
    OPENED.append(tid)
    sid = attach(tid)
    cdp("Page.enable", session_id=sid)
    cdp("Page.navigate", session_id=sid, url=url)
    wait_ready(sid, timeout_s)
    return tid, sid

def close(tid):
    try:
        cdp("Target.closeTarget", targetId=tid)
    except Exception:
        pass
    if tid in OPENED:
        OPENED.remove(tid)

def close_all():
    """Close every window this snippet opened and has not closed yet (runner calls it in finally)."""
    for tid in list(OPENED):
        close(tid)

def current_url(sid):
    return evaluate(sid, "location.href")

def page_text(sid, selector="body"):
    return evaluate(sid, "(document.querySelector(%s)||document.body).innerText" % json.dumps(selector))

# The SIS page shell (psp/...) renders the app inside #main_iframe; fall back to the first iframe, then the
# top window (the class-details page sometimes renders without a frame).
IFRAME = "(document.querySelector('#main_iframe')||document.querySelector('iframe'))"

def frame_text(sid):
    """innerText of the SIS content frame; '' while it is not ready."""
    return evaluate(sid, "(function(){const f=" + IFRAME + ";const w=f?f.contentWindow:window;try{return w.document.body?w.document.body.innerText:''}catch(e){return ''}})()") or ""

def frame_js(sid, expr, timeout_s=60):
    """Evaluate a JS expression with `w` / `d` bound to the SIS content frame's window / document."""
    return evaluate(sid, "(function(){const f=" + IFRAME + ";const w=f?f.contentWindow:window;const d=w.document;return (" + expr + ")})()", timeout_s)

def emit(obj):
    print("@@JSON@@" + json.dumps(obj) + "@@END@@")
