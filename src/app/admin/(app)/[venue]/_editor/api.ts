// The editor's calls to the JSON admin API. Every answer is { ok: true, revisions: [...], ... } or throws with the server's one-line reason.
export type Resp = { ok: true; revisions: number[] } & Record<string, unknown>;
// `extra`: whatever else the refusal carried (the readability guard's suggested colour, for the one-tap fix).
export class ApiFail extends Error { status: number; extra: Record<string, unknown>; constructor(status: number, message: string, extra: Record<string, unknown> = {}) { super(message); this.status = status; this.extra = extra; } }

// A failure that trying again can fix: no connection, or the server failed (pre-go-live audit D-01/D-02). A refusal (400/403), a sign-out
// (401) or a newer change by someone else (409) cannot be fixed by sending the same thing again.
export const retryable = (e: unknown): boolean => !(e instanceof ApiFail) || e.status === 0 || e.status >= 500;

export async function call(path: string, body: Record<string, unknown>): Promise<Resp> {
  let r: Response;
  try { r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) }); }
  catch { throw new ApiFail(0, 'No connection. Check the Wi-Fi and try again.'); }
  const j = (await r.json().catch(() => null)) as (Resp & { error?: string }) | null;
  if (!r.ok || !j || !j.ok) { const { ok: _ok, error: _error, ...extra } = (j ?? {}) as Record<string, unknown>; void _ok; void _error; throw new ApiFail(r.status, j?.error || (r.status === 401 ? 'Signed out. Reload the page and sign in again.' : `Something went wrong (${r.status})`), extra); }
  return j;
}
