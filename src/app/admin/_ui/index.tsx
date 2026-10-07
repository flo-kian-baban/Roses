// Server-rendered building blocks for the admin (phone first, no client JavaScript). Pages compose these; the
// form field names, button texts and routes are the contract the API routes and the drills rely on.
import type { Bi, Venue } from '@/lib/types';
import type { Session } from '@/lib/admin/auth';
import { Icon, type IconName } from './icons';

export type SP = Record<string, string | string[] | undefined>;
export const one = (sp: SP, k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;

export function Notice({ sp }: { sp: SP }) {
  const error = one(sp, 'error'); const saved = one(sp, 'saved'); const restored = one(sp, 'restored'); const deleted = one(sp, 'deleted'); const revoked = one(sp, 'revoked'); const unlocked = one(sp, 'unlocked'); const seen = one(sp, 'seen');
  if (error) return <p role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[15px] text-red-900"><Icon name="alert" className="mt-0.5 h-5 w-5 text-red-600" /><span>{error}</span></p>;
  const ok = saved ? 'Saved.' : restored ? `Restored from history (revision ${restored}).` : deleted ? 'Deleted. It stays in the history and can be restored.' : revoked ? 'PIN revoked.' : unlocked ? `PIN login unlocked for ${unlocked}.` : seen ? 'Alert marked as seen.' : null;
  return ok ? <p role="status" className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[15px] text-emerald-900"><Icon name="check" className="mt-0.5 h-5 w-5 text-emerald-600" /><span>{ok}</span></p> : null;
}

export type Tone = 'grey' | 'red' | 'amber' | 'green' | 'blue' | 'accent';
const PILL: Record<Tone, string> = { grey: 'bg-neutral-100 text-neutral-700', red: 'bg-red-100 text-red-800', amber: 'bg-amber-100 text-amber-900', green: 'bg-emerald-100 text-emerald-800', blue: 'bg-sky-100 text-sky-800', accent: 'bg-accent-soft text-accent-strong' };
export function Badge({ tone = 'grey', children, className = '' }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${PILL[tone]} ${className}`}>{children}</span>;
}

export const input = 'mt-1 block w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-neutral-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20';
export const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-base font-medium whitespace-nowrap transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100';
export const primary = `${button} bg-accent text-white shadow-sm hover:bg-accent-strong`;
export const secondary = `${button} border border-line bg-white text-ink hover:bg-neutral-50`;
export const ghost = `${button} text-ink hover:bg-neutral-100`;
export const danger = `${button} border border-red-200 bg-white text-red-700 hover:bg-red-50`;
export const sm = 'min-h-9 rounded-lg px-3 py-1.5 text-sm';

export function Card({ id, title, description, actions, children, className = '', tone = 'default', icon }: { id?: string; title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode; className?: string; tone?: 'default' | 'danger' | 'warn'; icon?: IconName }) {
  const tones = { default: 'border-line bg-white', danger: 'border-red-200 bg-white', warn: 'border-amber-200 bg-amber-50/70' };
  return (
    <section id={id} className={`rounded-2xl border p-4 shadow-[0_1px_2px_rgba(16,16,16,.04)] sm:p-5 ${tones[tone]} ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {icon && <span className={`mt-0.5 rounded-lg p-1.5 ${tone === 'danger' ? 'bg-red-50 text-red-600' : tone === 'warn' ? 'bg-amber-100 text-amber-800' : 'bg-accent-soft text-accent-strong'}`}><Icon name={icon} className="h-4 w-4" /></span>}
            <div className="min-w-0">{title && <h2 className="text-[17px] font-semibold leading-tight">{title}</h2>}{description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}</div>
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ back, eyebrow, title, subtitle, actions }: { back?: { href: string; label: string }; eyebrow?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
      <div className="min-w-0">
        {back && <a href={back.href} className="mb-2 inline-flex min-h-8 items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink"><Icon name="back" className="h-4 w-4" />{back.label}</a>}
        {eyebrow && <p className="text-sm font-medium text-accent-strong">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-[15px] text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, icon, tone = 'grey', href, active, hint }: { label: string; value: React.ReactNode; icon?: IconName; tone?: 'grey' | 'green' | 'amber' | 'blue' | 'accent'; href?: string; active?: boolean; hint?: string }) {
  const iconTone = { grey: 'bg-neutral-100 text-neutral-600', green: 'bg-emerald-100 text-emerald-700', amber: 'bg-amber-100 text-amber-800', blue: 'bg-sky-100 text-sky-700', accent: 'bg-accent-soft text-accent-strong' }[tone];
  const cls = `block rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(16,16,16,.04)] ${active ? 'border-accent ring-2 ring-accent/20' : 'border-line'} ${href ? 'hover:border-neutral-300' : ''}`;
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium leading-tight text-ink-muted">{label}</span>
        {icon && <span className={`rounded-lg p-1.5 ${iconTone}`}><Icon name={icon} className="h-4 w-4" /></span>}
      </div>
      <p className="mt-2 text-[28px] font-semibold leading-none tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-2 text-xs text-ink-muted">{hint}</p>}
    </>
  );
  return href ? <a href={href} className={cls}>{body}</a> : <div className={cls}>{body}</div>;
}

export function Field({ label, name, value, type = 'text', hint, dir, required, inputMode, placeholder, prefix }: { label: string; name: string; value?: string | number | null; type?: string; hint?: string; dir?: 'rtl' | 'ltr'; required?: boolean; inputMode?: 'numeric' | 'decimal' | 'text' | 'url'; placeholder?: string; prefix?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}{required && ' *'}</span>
      {prefix ? (
        <span className="relative block"><span className="pointer-events-none absolute inset-y-0 left-3.5 top-1 flex items-center text-neutral-500">{prefix}</span><input className={`${input} pl-8`} name={name} type={type} defaultValue={value ?? ''} dir={dir} required={required} inputMode={inputMode} placeholder={placeholder} /></span>
      ) : (
        <input className={input} name={name} type={type} defaultValue={value ?? ''} dir={dir} required={required} inputMode={inputMode} placeholder={placeholder} lang={dir === 'rtl' ? 'fa' : undefined} />
      )}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

export function BiFields({ label, name, value, long, missing, required }: { label: string; name: string; value: Bi | null | undefined; long?: boolean; missing?: boolean; required?: boolean }) {
  const Tag = long ? 'textarea' : 'input';
  const cls = long ? `${input} min-h-28` : input;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block"><span className="text-sm font-medium">{label} <span className="text-ink-muted">(English)</span>{required && ' *'}</span><Tag className={cls} name={`${name}_en`} defaultValue={value?.en ?? ''} required={required} /></label>
      <label className="block"><span className="flex items-center gap-2 text-sm font-medium"><span>{label} <span className="text-ink-muted">(فارسی)</span></span>{missing && <Badge tone="amber">Persian missing</Badge>}</span><Tag className={cls} name={`${name}_fa`} defaultValue={value?.fa ?? ''} dir="rtl" lang="fa" /></label>
    </div>
  );
}

// A native checkbox drawn as a toggle (see .switch in globals.css).
export function Switch({ name, label, hint, defaultChecked, disabled, title, value }: { name: string; label: React.ReactNode; hint?: React.ReactNode; defaultChecked?: boolean; disabled?: boolean; title?: string; value?: string }) {
  return (
    <label className={`flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-xl border border-line bg-white px-4 py-3 ${disabled ? 'cursor-not-allowed' : ''}`} title={title}>
      <span className="min-w-0"><span className="block font-medium">{label}</span>{hint && <span className="mt-0.5 block text-xs text-ink-muted">{hint}</span>}</span>
      <input type="checkbox" name={name} value={value} className="switch" defaultChecked={defaultChecked} disabled={disabled} />
    </label>
  );
}

// A big tappable card around a native checkbox or radio (the input stays visible: forms and drills work unchanged).
export function CheckCard({ type = 'checkbox', name, value, defaultChecked, children, className = '', dense }: { type?: 'checkbox' | 'radio'; name: string; value?: string; defaultChecked?: boolean; children: React.ReactNode; className?: string; dense?: boolean }) {
  return (
    <label className={`flex min-h-12 cursor-pointer items-center rounded-xl border border-line bg-white py-2 has-checked:border-accent has-checked:bg-accent-soft ${dense ? 'gap-2 px-2.5' : 'gap-3 px-3'} ${className}`}>
      <input type={type} name={name} value={value} defaultChecked={defaultChecked} className="h-5 w-5 shrink-0 accent-accent" />
      <span className="min-w-0 text-[15px]">{children}</span>
    </label>
  );
}

export function Photo({ url, alt = '', className = '' }: { url?: string | null; alt?: string; className?: string }) {
  return url
    ? <img src={url} alt={alt} loading="lazy" decoding="async" className={`object-cover ${className}`} />
    : <div className={`flex items-center justify-center bg-[linear-gradient(135deg,#f4f2ec,#e9e6de)] text-neutral-400 ${className}`}><Icon name="image" className="h-6 w-6" /></div>;
}

// The venue logo on its own brand background (Senso on cream, Kebab Land white-on-dark).
export function LogoTile({ venue, className = 'h-10 w-14', pad = 'p-1.5' }: { venue: Venue; className?: string; pad?: string }) {
  const bg = venue.brand?.colors?.background || '#ffffff';
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line ${pad} ${className}`} style={{ background: bg }}>
      {venue.brand?.logo ? <img src={venue.brand.logo.url} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-sm font-semibold">{(venue.name.en || '?').slice(0, 1)}</span>}
    </span>
  );
}

export function Avatar({ name, className = 'h-9 w-9 text-sm' }: { name: string; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
  return <span className={`flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-strong ${className}`}>{initials}</span>;
}

export const roleLabel = (s: Session) => (s.role === 'admin' ? 'Admin' : s.role === 'owner' ? 'Owner' : 'Staff');

export function Empty({ icon = 'sparkle', title, hint, action }: { icon?: IconName; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-neutral-300 bg-white/60 px-4 py-10 text-center">
      <span className="rounded-2xl bg-neutral-100 p-3 text-neutral-500"><Icon name={icon} className="h-6 w-6" /></span>
      <p className="mt-3 font-medium">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-ink-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function When({ at, style = 'full' }: { at: string | Date; style?: 'full' | 'time' | 'date' }) {
  const d = new Date(at);
  const text = style === 'time' ? d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }) : style === 'date' ? d.toLocaleDateString('en-CA', { dateStyle: 'medium' }) : d.toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' });
  return <time dateTime={d.toISOString()}>{text}</time>;
}

export const dayKey = (at: string | Date) => new Date(at).toLocaleDateString('en-CA', { dateStyle: 'full' });
