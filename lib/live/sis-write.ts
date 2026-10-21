/**
 * SIS cart actions driven through the page's own UI in the user's signed-in Chrome.
 * We never handle the app's request token: the page's buttons do the POSTs. Every action here is
 * gated at the tool layer (confirm:true + confirm_token) and never clicks anything matching /enroll/i.
 *
 * Fail-closed rules (H1–H4):
 *  - term switch must be verified (dropdown value === wanted term AND the page re-rendered) or we abort;
 *  - row selection is read back from the DOM and must equal the requested set exactly, or we abort;
 *  - Delete's confirmation click is scoped to the dialog, and the result is verified by a readCart diff;
 *  - Add only proceeds when the options dialog contains nothing but an optional waitlist checkbox and one
 *    confirm button; any text input / radio / select / units control aborts and returns the dialog text.
 * Tested in this repo: Validate (read-only, 2026-10-20). Add/Delete follow the same UI but have not been
 * exercised from a build session — run them on a spare section first.
 */
import { LiveError, runPy } from "./runner";
import { SIS_PSP, readCart } from "./sis";

const CART_URL = SIS_PSP + "WEBLIB_HCX_EN.H_SHOPPING_CART.FieldFormula.IScript_Main";
/** JS regex source for the term dropdown's input value ("2027 Spring"). No backslashes: avoids Python escapes. */
const TERM_RE = "/^20[0-9][0-9] (Fall|Spring|January|Summer)$/";
const ROW_SEL = "'tr,[role=row],li,.row'";

/** Python: dialog helpers shared by the cart page and the class-details page. `ijs` must be defined first. */
const DIALOG_HELPERS = `
DIALOG = "(()=>{const ds=[...d.querySelectorAll('[role=dialog],dialog[open],.modal.show,.modal.in')];return ds.length?ds[ds.length-1]:null})()"
def wait_dialog(timeout_s=10):
    for _ in range(int(timeout_s * 2)):
        if ijs("!!" + DIALOG): return True
        time.sleep(0.5)
    return False
def dialog_text():
    return ijs("((" + DIALOG + ")||{}).innerText||''") or ""
def dialog_click(pattern):
    # exactly one enabled button inside the dialog may match; never anything whose text mentions enroll
    return ijs("(()=>{const dlg=" + DIALOG + ";if(!dlg)return 'nodialog';const bs=[...dlg.querySelectorAll('button')].filter(b=>new RegExp(" + json.dumps(pattern) + ",'i').test(b.textContent.trim())&&!b.disabled&&!/enroll/i.test(b.textContent));if(bs.length!==1)return 'count:'+bs.length;bs[0].click();return 'ok'})()")
`;

/** Python: open our own cart window, verify the term, and define row/button helpers (`tid` is closed by the caller). */
const CART_PROLOGUE = (term: string) => `
import json, time
want_term = ${JSON.stringify(term)}
tid, sid = open_window(${JSON.stringify(CART_URL)})
def itext():
    return frame_text(sid)
def ijs(expr):
    return frame_js(sid, expr)
${DIALOG_HELPERS}
def term_input_value():
    return ijs("(([...d.querySelectorAll('input')].find(i=>${TERM_RE}.test(i.value||''))||{}).value||'')") or ""
def row_set():
    return ijs("[...d.querySelectorAll('button')].map(b=>(b.id||'').trim()||b.textContent.trim()).filter(t=>/^[0-9]{4,5}$/.test(t))") or []
def wait_loaded(timeout_s=30):
    for _ in range(int(timeout_s)):
        if "Finished Loading" in itext(): return True
        time.sleep(1)
    return False
def checked_rows():
    # read back from the DOM: every checked checkbox -> the class-number button in its row ('unknown' if none)
    return ijs("[...d.querySelectorAll('input[type=checkbox]')].filter(c=>c.checked).map(c=>{const row=c.closest(${ROW_SEL});const b=row&&[...row.querySelectorAll('button')].find(b=>/^[0-9]{4,5}$/.test((b.id||'').trim()||b.textContent.trim()));return b?((b.id||'').trim()||b.textContent.trim()):'unknown'})") or []
def select_rows(nbrs):
    want = sorted(set(str(n) for n in nbrs))
    res = ijs("(()=>{const want=" + json.dumps(want) + ";const out={missing:[],multi:[]};for(const n of want){const b=[...d.querySelectorAll('button')].find(b=>(b.id||'').trim()===n||b.textContent.trim()===n);const row=b&&b.closest(${ROW_SEL});if(!row){out.missing.push(n);continue}const cbs=row.querySelectorAll('input[type=checkbox]');if(cbs.length!==1){out.multi.push(n+' has '+cbs.length+' checkboxes');continue}if(!cbs[0].checked)cbs[0].click()}return out})()") or {}
    if res.get("missing"): fail("Not in the SIS cart for %s: %s. Nothing was changed." % (want_term, ", ".join(res["missing"])))
    if res.get("multi"): fail("Could not select rows safely (%s). Nothing was changed." % "; ".join(res["multi"]))
    time.sleep(0.5)
    got = sorted(set(checked_rows()))
    if got != want: fail("Row selection mismatch: asked for %s but the cart shows %s checked. Nothing was changed." % (", ".join(want), ", ".join(got) or "nothing"))
    return [int(n) for n in got]
def click_button(pattern):
    return ijs("(()=>{const b=[...d.querySelectorAll('button')].find(b=>new RegExp(" + json.dumps(pattern) + ",'i').test(b.textContent.trim())&&!b.disabled&&!/enroll/i.test(b.textContent));if(!b)return 'nf';b.click();return 'ok'})()")
if not wait_loaded(30):
    fail("The SIS cart page did not finish loading within 30 s (session expired?). Sign in to SIS in Chrome and retry.")
cur = term_input_value()
if cur != want_term:
    if not cur: fail("Could not find the term dropdown on the SIS cart page; aborting before any change.")
    before_rows = sorted(row_set())
    # blank the status text so we can tell a fresh "Finished Loading" from the old one
    ijs("(()=>{for(const el of d.querySelectorAll('*')){if(el.childElementCount===0&&el.textContent.trim()==='Finished Loading')el.textContent=''}return 'ok'})()")
    r = ijs("(()=>{const inp=[...d.querySelectorAll('input')].find(i=>${TERM_RE}.test(i.value||''));if(!inp)return 'no';inp.click();inp.focus();inp.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));return 'ok'})()")
    if r != "ok": fail("Could not open the term dropdown on the SIS cart page; aborting before any change.")
    time.sleep(1.5)
    r = ijs("(()=>{const el=[...d.querySelectorAll('[role=option],li,.option,.item,div')].find(e=>e.childElementCount===0&&e.textContent.trim()===" + json.dumps(want_term) + ");if(!el)return 'nf';el.click();return 'ok'})()")
    if r != "ok": fail("Term %s is not offered in the SIS cart term dropdown (currently %s); aborting before any change." % (want_term, cur))
    switched = False
    for _ in range(40):
        time.sleep(0.5)
        if term_input_value() == want_term and ("Finished Loading" in itext() or sorted(row_set()) != before_rows):
            switched = True; break
    if not switched:
        fail("The SIS cart did not switch to %s within 20 s (dropdown shows %r); aborting before any change." % (want_term, term_input_value()))
    time.sleep(1)
`;

export async function validateViaUi(termDescr: string, classNbrs: number[]): Promise<string> {
  const { json } = await runPy(`${CART_PROLOGUE(termDescr)}
try:
    selected = select_rows(${JSON.stringify(classNbrs)})
    time.sleep(1)
    if click_button("^Validate") != "ok": fail("Could not click Validate in the SIS cart (%d rows selected)." % len(selected))
    txt = ""
    for _ in range(20):
        time.sleep(1)
        txt = itext()
        if "Validation results" in txt: break
    i = txt.find("Validation results")
    emit({"selected": selected, "term": term_input_value(), "text": txt[i:] if i >= 0 else txt[-1500:]})
finally:
    close(tid)`, 180_000);
  const j = json as { selected: number[]; term: string; text: string };
  if (!j.text.includes("Validation results")) throw new LiveError(`Validate was clicked for ${j.selected.join(", ")} but no "Validation results" dialog appeared (term shown: ${j.term}). Tail of page: ${j.text.slice(-500)}`);
  return j.text.replace(/\n{2,}/g, "\n").trim();
}

const nbrList = (ns: number[]) => ns.map((n) => `#${n}`).join(", ");

/** Delete rows from the cart: verified by a readCart diff; reports exactly what was removed. */
export async function deleteViaUi(term: string, termDescr: string, classNbrs: number[]): Promise<string> {
  const before = (await readCart(term)).cart.classes.map((c) => c.class_nbr);
  const absent = classNbrs.filter((n) => !before.includes(n));
  if (absent.length) throw new LiveError(`Not in the SIS cart for ${termDescr}: ${nbrList(absent)}. Nothing was changed.`);
  const { json } = await runPy(`${CART_PROLOGUE(termDescr)}
try:
    selected = select_rows(${JSON.stringify(classNbrs)})
    time.sleep(0.5)
    if click_button("^Delete") != "ok": fail("Could not find the Delete button in the SIS cart; nothing was deleted.")
    had_dialog = wait_dialog(10)
    dtext = ""
    if had_dialog:
        dtext = dialog_text()
        c = dialog_click("^(Yes|Delete|Confirm|OK)$")
        if c != "ok": fail("The Delete confirmation dialog did not have exactly one Yes/Delete/Confirm/OK button (%s); nothing confirmed. Dialog text: %s" % (c, dtext[:400]))
    time.sleep(4)
    emit({"selected": selected, "dialog": had_dialog, "dialog_text": dtext[:600]})
finally:
    close(tid)`, 180_000);
  const j = json as { selected: number[]; dialog: boolean; dialog_text: string };
  const after = (await readCart(term)).cart.classes.map((c) => c.class_nbr);
  const removed = before.filter((n) => !after.includes(n));
  const still = classNbrs.filter((n) => after.includes(n));
  const unexpected = removed.filter((n) => !classNbrs.includes(n));
  const parts: string[] = [];
  if (removed.length) parts.push(`Removed from the ${termDescr} SIS cart: ${nbrList(removed)}.`);
  if (still.length) parts.push(`Still in the cart after Delete (${j.dialog ? "confirmation dialog was accepted" : "no confirmation dialog appeared"}): ${nbrList(still)}. Check the cart in SIS.`);
  if (unexpected.length) parts.push(`WARNING: rows not requested also disappeared: ${nbrList(unexpected)}. Tell the student to check their cart.`);
  parts.push(`Cart now: ${nbrList(after) || "empty"}.`);
  return parts.join(" ");
}

/**
 * Add one class by class number: open the HCX class-details page (it has an Add to Cart button), press it,
 * inspect the options dialog, and only confirm when it asks nothing beyond a waitlist checkbox.
 */
export async function addViaUi(term: string, termDescr: string, classNbr: number, waitlistOk: boolean): Promise<string> {
  const before = (await readCart(term)).cart.classes.map((c) => c.class_nbr);
  if (before.includes(classNbr)) return `#${classNbr} is already in the ${termDescr} SIS cart; nothing changed.`;
  const url = `${SIS_PSP}WEBLIB_HCX_CM.H_CLASS_DETAILS.FieldFormula.IScript_Main?institution=UVA01&term=${term}&class_nbr=${classNbr}`;
  const { json } = await runPy(`
import json, time
tid, sid = open_window(${JSON.stringify(url)})
def itext():
    return frame_text(sid)
def ijs(expr):
    return frame_js(sid, expr)
${DIALOG_HELPERS}
ADD_BTN = "[...d.querySelectorAll('button,a')].find(b=>/add to cart/i.test(b.textContent)&&!b.disabled&&!/enroll/i.test(b.textContent))"
try:
    found = False
    for _ in range(40):
        if ijs("!!" + ADD_BTN): found = True; break
        time.sleep(0.5)
    if not found: fail("No 'Add to Cart' button appeared for class ${classNbr} within 20 s (not offered in ${termDescr}, or the SIS session expired). Nothing was changed.")
    ijs("(()=>{" + ADD_BTN + ".click();return 'ok'})()")
    if not wait_dialog(10): fail("Add to Cart did not open its options dialog within 10 s; nothing was confirmed. Page tail: " + itext()[-500:])
    info = ijs("(()=>{const dlg=" + DIALOG + ";const q=s=>dlg.querySelectorAll(s).length;return {text:dlg.innerText.slice(0,1500),inputs:q('input:not([type]),input[type=text],input[type=number],textarea,[role=textbox],[role=spinbutton]'),choices:q('input[type=radio],select,[role=radio],[role=combobox],[role=listbox]'),checkboxes:q('input[type=checkbox]'),buttons:[...dlg.querySelectorAll('button')].map(b=>b.textContent.trim())}})()")
    if info["inputs"] or info["choices"]:
        emit({"aborted": "The Add to Cart dialog asks for more than a waitlist choice (permission number, related section or units); nothing was clicked.", "dialog": info})
    elif info["checkboxes"] > 1:
        emit({"aborted": "The Add to Cart dialog has %d checkboxes (expected at most one, waitlist); nothing was clicked." % info["checkboxes"], "dialog": info})
    else:
        if info["checkboxes"] == 1:
            cb = ijs("(()=>{const dlg=" + DIALOG + ";const cb=dlg.querySelector('input[type=checkbox]');const lbl=((cb.labels&&cb.labels[0]&&cb.labels[0].textContent)||cb.getAttribute('aria-label')||(cb.parentElement&&cb.parentElement.textContent)||'');if(!/wait/i.test(lbl))return 'notwait:'+lbl.trim().slice(0,80);const want=${waitlistOk ? "true" : "false"};if(cb.checked!==want)cb.click();return cb.checked===want?'ok':'stuck'})()")
            if cb != "ok": fail("Could not set the waitlist checkbox (%s); nothing was confirmed." % cb)
        c = dialog_click("^(add to cart|add|save|confirm|ok|yes)$")
        if c != "ok": fail("The Add dialog did not have exactly one confirm button (%s); nothing was confirmed. Buttons: %s" % (c, ", ".join(info["buttons"])))
        time.sleep(4)
        emit({"clicked": True, "dialog": info, "text": itext()[-1200:]})
finally:
    close(tid)`, 180_000);
  const j = json as { aborted?: string; clicked?: boolean; dialog: { text: string; buttons: string[] }; text?: string };
  if (j.aborted) return `#${classNbr} NOT added: ${j.aborted} Dialog text: ${j.dialog.text.replace(/\n+/g, " | ").slice(0, 800)}`;
  const after = (await readCart(term)).cart.classes.map((c) => c.class_nbr);
  const added = after.filter((n) => !before.includes(n));
  const msg = j.text?.match(/(added to|has been added|already in your|cannot|error|not added|success)[^\n]*/i)?.[0];
  if (!after.includes(classNbr)) return `#${classNbr} NOT in the cart after Add (confirm button was clicked). ${msg ? `SIS said: ${msg}. ` : ""}${added.length ? `Rows that did appear: ${nbrList(added)}. ` : ""}Cart now: ${nbrList(after) || "empty"}.`;
  const extra = added.filter((n) => n !== classNbr);
  return `Added #${classNbr} to the ${termDescr} SIS cart${waitlistOk ? " (waitlist allowed)" : ""}${extra.length ? `; SIS also added related rows ${nbrList(extra)}` : ""}.${msg ? ` SIS said: ${msg}.` : ""} Cart now: ${nbrList(after)}.`;
}
