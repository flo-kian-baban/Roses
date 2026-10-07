// Server-rendered building blocks shared by the sign-in, Team and frame. The page editor has its own client-side kit.
import type { Venue } from '@/lib/types';
import type { Session } from '@/lib/admin/auth';
import { Icon, type IconName } from './icons';

export type SP = Record<string, string | string[] | undefined>;
export const one = (sp: SP, k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;

export function Notice({ sp }: { sp: SP }) {
  const error = one(sp, 'error'); const revoked = one(sp, 'revoked'); const unlocked = one(sp, 'unlocked'); const seen = one(sp, 'seen');
  if (error) return <p role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[15px] text-red-900"><Icon name="alert" className="mt-0.5 h-5 w-5 text-red-600" /><span>{error}</span></p>;
  const ok = revoked ? 'PIN revoked.' : unlocked ? `PIN login unlocked for ${unlocked}.` : seen ? 'Alert marked as seen.' : null;
  return ok ? <p role="status" className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[15px] text-emerald-900"><Icon name="check" className="mt-0.5 h-5 w-5 text-emerald-600" /><span>{ok}</span></p> : null;
}

export type Tone = 'grey' | 'red' | 'amber' | 'green' | 'blue' | 'accent';
const PILL: Record<Tone, string> = { grey: 'bg-neutral-100 text-neutral-700', red: 'bg-red-100 text-red-800', amber: 'bg-amber-100 text-amber-900', green: 'bg-emerald-100 text-emerald-800', blue: 'bg-sky-100 text-sky-800', accent: 'bg-accent-soft text-accent-strong' };
export function Badge({ tone = 'grey', children, className = '' }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${PILL[tone]} ${className}`}>{children}</span>;
}

export const input = 'mt-1 block w-full rounded-xl border border-[#d2d2d7] bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-neutral-400 focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20';
export const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2 text-base font-semibold whitespace-nowrap transition active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100';
export const primary = `${button} bg-[linear-gradient(180deg,var(--color-accent-bright),var(--color-accent))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.28),0_8px_20px_-8px_rgba(238,106,58,.7)] hover:brightness-105`;
export const secondary = `${button} border border-line bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,.04)] hover:bg-fill`;
export const sm = 'min-h-9 px-3.5 py-1.5 text-sm';

export function Card({ id, title, description, actions, children, className = '', tone = 'default', icon }: { id?: string; title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode; className?: string; tone?: 'default' | 'danger' | 'warn'; icon?: IconName }) {
  const tones = { default: 'border-line bg-white', danger: 'border-red-200 bg-white', warn: 'border-amber-200 bg-amber-50/70' };
  return (
    <section id={id} className={`rounded-2xl border p-4 shadow-card sm:p-5 ${tones[tone]} ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {icon && <span className={`mt-0.5 rounded-[9px] p-1.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3)] ${tone === 'danger' ? 'bg-[linear-gradient(180deg,#ff6b6b,#e5484d)]' : tone === 'warn' ? 'bg-[linear-gradient(180deg,#ffb340,#f59e0b)]' : 'bg-[linear-gradient(180deg,var(--color-accent-bright),var(--color-accent))]'}`}><Icon name={icon} className="h-4 w-4" strokeWidth={2.2} /></span>}
            <div className="min-w-0">{title && <h2 className="text-[17px] font-semibold leading-tight">{title}</h2>}{description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}</div>
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
      <div className="min-w-0">
        {eyebrow && <p className="text-sm font-medium text-accent-strong">{eyebrow}</p>}
        <h1 className="text-[26px] font-semibold leading-tight sm:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-[15px] text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// A big tappable card around a native checkbox or radio (the input stays visible: forms and drills work unchanged).
export function CheckCard({ type = 'checkbox', name, value, defaultChecked, children, className = '', dense }: { type?: 'checkbox' | 'radio'; name: string; value?: string; defaultChecked?: boolean; children: React.ReactNode; className?: string; dense?: boolean }) {
  return (
    <label className={`flex min-h-12 cursor-pointer items-center rounded-[22px] border border-line bg-white py-2 transition has-checked:border-accent has-checked:bg-accent-soft ${dense ? 'gap-2 px-2.5' : 'gap-3 px-3'} ${className}`}>
      <input type={type} name={name} value={value} defaultChecked={defaultChecked} className="check" />
      <span className="min-w-0 text-[15px]">{children}</span>
    </label>
  );
}

// The venue logo on its own brand background (Senso on cream, Kebab Land white-on-dark).
export function LogoTile({ venue, className = 'h-10 w-14', pad = 'p-1.5' }: { venue: Venue; className?: string; pad?: string }) {
  const bg = venue.brand?.colors?.background || '#ffffff';
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-black/5 ${pad} ${className}`} style={{ background: bg }}>
      {venue.brand?.logo ? <img src={venue.brand.logo.url} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-sm font-semibold">{(venue.name.en || '?').slice(0, 1)}</span>}
    </span>
  );
}

export function Avatar({ name, className = 'h-9 w-9 text-sm' }: { name: string; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
  return <span className={`flex shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-accent-bright),var(--color-accent-strong))] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3)] ${className}`}>{initials}</span>;
}

export const roleLabel = (s: Session) => (s.role === 'admin' ? 'Admin' : s.role === 'owner' ? 'Owner' : 'Staff');

export function Empty({ icon = 'sparkle', title, hint, action }: { icon?: IconName; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[22px] border border-dashed border-[#d2d2d7] bg-fill/60 px-4 py-10 text-center">
      <span className="rounded-2xl bg-white p-3 text-neutral-500 shadow-card"><Icon name={icon} className="h-6 w-6" /></span>
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
