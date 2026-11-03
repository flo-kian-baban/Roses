// The editor's calls to the JSON admin API. Every answer is { ok: true, revisions: [...], ... } or throws with the server's one-line reason.
export type Resp = { ok: true; revisions: number[] } & Record<string, unknown>;
// `extra`: whatever else the refusal carried (the readability guard's suggested colour, for the one-tap fix).
export class ApiFail extends Error { status: number; extra: Record<string, unknown>; constructor(status: number, message: string, extra: Record<string, unknown> = {}) { super(message); this.status = status; this.extra = extra; } }

// A failure that trying again can fix: no connection, or the server failed (pre-go-live audit D-01/D-02). A refusal (400/403), a sign-out
// (401) or a newer change by someone else (409) cannot be fixed by sending the same thing again.
export const retryable = (e: unknown): boolean => !(e instanceof ApiFail) || e.status === 0 || e.status >= 500;

// Pre-go-live audit (the PM's fix batch, 2026-11-03):
//   D-06  a save that gets no answer within 15 s fails like a lost connection (the red toast with Try again); before, it looked saved and
//         the item's later saves waited behind it. While a save is slow (under way for more than a second), leaving or reloading asks first.
//   D-07  every save is sent with keepalive, so one started as the page goes away (a field saved when the page is hidden) still arrives.
export const SAVE_TIMEOUT_MS = 15000;
const started = new Map<number, number>(); let seqNo = 0;
// A save under way for more than a second (the page-leave guard asks only then: an ordinary save answers well within it).
export const slowSavePending = (): boolean => [...started.values()].some((t) => Date.now() - t > 1000);
export async function call(path: string, body: Record<string, unknown>): Promise<Resp> {
  let r: Response;
  const ctl = new AbortController(); let late = false;
  const timer = setTimeout(() => { late = true; ctl.abort(); }, SAVE_TIMEOUT_MS);
  const json = JSON.stringify(body);
  const me = ++seqNo; started.set(me, Date.now());
  try { r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: json, signal: ctl.signal, keepalive: json.length < 60000 }); }
  catch { throw new ApiFail(0, late ? 'No answer from the server after 15 seconds. Check the connection and try again.' : 'No connection. Check the Wi-Fi and try again.'); }
  finally { clearTimeout(timer); started.delete(me); }
  const j = (await r.json().catch(() => null)) as (Resp & { error?: string }) | null;
  if (!r.ok || !j || !j.ok) { const { ok: _ok, error: _error, ...extra } = (j ?? {}) as Record<string, unknown>; void _ok; void _error; throw new ApiFail(r.status, j?.error || (r.status === 401 ? 'Signed out. Reload the page and sign in again.' : r.status >= 500 ? 'Something went wrong on the server. Try again.' : 'That did not work. Try again.'), extra); }
  return j;
}

// A key for one "+ Add" (pre-go-live audit D-05): the same key goes with every try of that one add, so a try whose answer was lost and
// the next one make one item, not two.
export const newKey = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

