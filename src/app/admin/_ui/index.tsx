// Small server-rendered building blocks for the admin (phone first, no client JavaScript).
import type { Bi } from '@/lib/types';

export function Notice({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const error = one('error'); const saved = one('saved'); const restored = one('restored'); const deleted = one('deleted'); const revoked = one('revoked'); const unlocked = one('unlocked');
  if (error) return <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-900">{error}</p>;
  const ok = saved ? 'Saved.' : restored ? `Restored from history (revision ${restored}).` : deleted ? 'Deleted. It stays in the history and can be restored.' : revoked ? 'PIN revoked.' : unlocked ? `PIN login unlocked for ${unlocked}.` : null;
  return ok ? <p role="status" className="mb-4 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-green-900">{ok}</p> : null;
}

export function Badge({ tone = 'grey', children }: { tone?: 'grey' | 'red' | 'amber' | 'green' | 'blue'; children: React.ReactNode }) {
  const c = { grey: 'bg-neutral-200 text-neutral-800', red: 'bg-red-100 text-red-900', amber: 'bg-amber-100 text-amber-900', green: 'bg-green-100 text-green-900', blue: 'bg-blue-100 text-blue-900' }[tone];
  return <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${c}`}>{children}</span>;
}

export const input = 'mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base';
export const button = 'inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-base font-medium';
export const primary = `${button} bg-neutral-900 text-white`;
export const secondary = `${button} border border-neutral-300 bg-white text-neutral-900`;
export const danger = `${button} border border-red-300 bg-white text-red-800`;

export function Field({ label, name, value, type = 'text', hint, dir, required, inputMode }: { label: string; name: string; value?: string | number | null; type?: string; hint?: string; dir?: 'rtl' | 'ltr'; required?: boolean; inputMode?: 'numeric' | 'decimal' | 'text' | 'url' }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}{required && ' *'}</span>
      <input className={input} name={name} type={type} defaultValue={value ?? ''} dir={dir} required={required} inputMode={inputMode} />
      {hint && <span className="mt-1 block text-xs text-neutral-600">{hint}</span>}
    </label>
  );
}

export function BiFields({ label, name, value, long, missing }: { label: string; name: string; value: Bi | null | undefined; long?: boolean; missing?: boolean }) {
  const Tag = long ? 'textarea' : 'input';
  const cls = long ? `${input} min-h-24` : input;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block"><span className="text-sm font-medium">{label} (English)</span><Tag className={cls} name={`${name}_en`} defaultValue={value?.en ?? ''} /></label>
      <label className="block"><span className="text-sm font-medium">{label} (فارسی) {missing && <Badge tone="amber">Persian missing</Badge>}</span><Tag className={cls} name={`${name}_fa`} defaultValue={value?.fa ?? ''} dir="rtl" lang="fa" /></label>
    </div>
  );
}

export function When({ at }: { at: string | Date }) {
  const d = new Date(at);
  return <time dateTime={d.toISOString()}>{d.toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}</time>;
}
