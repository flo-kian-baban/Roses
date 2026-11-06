// Server-rendered building blocks shared by the sign-in, Team and frame, in the admin's look (./look.ts; the admin-wide clean-up of
// 2026-11-06). The page editor has its own client-side kit, in the same look.
import type { Venue } from '@/lib/types';
import type { Session } from '@/lib/admin/auth';
import { Icon, type IconName } from './icons';
import { messageOf } from '@/lib/admin/messages';
import { card, caption, field, headingCls, headingStyle, pageTitle, primaryBtn, quietBtn } from './look';

export type SP = Record<string, string | string[] | undefined>;
export const one = (sp: SP, k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;

// A form post's outcome: the error code's own wording (src/lib/admin/messages.ts; never the text of the address), or a success line.
// An error in red (red marks Delete and errors only); a success in ink with the accent's check.
export function Notice({ sp }: { sp: SP }) {
  const error = one(sp, 'error'); const revoked = one(sp, 'revoked'); const unlocked = one(sp, 'unlocked'); const seen = one(sp, 'seen');
  if (error) return <p role="alert" className={`${card} mb-5 flex items-start gap-3 px-4 py-3 text-base text-danger`}><Icon name="alert" className="mt-0.5 h-5 w-5" /><span>{messageOf(error, { at: one(sp, 'at'), left: one(sp, 'left'), paused: one(sp, 'paused') })}</span></p>;
  const ok = revoked ? 'PIN revoked.' : unlocked === 'admin-pins' ? 'Admin PINs work again.' : unlocked && /^[a-z0-9-]{1,60}$/.test(unlocked) ? `PIN sign-in unlocked for ${unlocked}.` : seen ? 'Alert marked as seen.' : null;
  return ok ? <p role="status" className={`${card} mb-5 flex items-start gap-3 px-4 py-3 text-base text-ink`}><Icon name="check" className="mt-0.5 h-5 w-5 text-accent-ink" /><span>{ok}</span></p> : null;
}

// A short tag in a row (Owner, PIN set, a kind of alert…): 13 px text, no box; red only for an error.
export type Tone = 'grey' | 'red' | 'amber' | 'green' | 'blue' | 'accent';
export function Badge({ tone = 'grey', children, className = '' }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 text-[13px] whitespace-nowrap ${tone === 'red' ? 'font-semibold text-danger' : 'text-ink-muted'} ${className}`}>{children}</span>;
}

export const input = `${field} mt-1`;
export const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50';
export const primary = primaryBtn;
export const secondary = quietBtn;
export const sm = 'px-3.5';

// A group: its small grey heading (and what it holds in one line), then a white card. tone 'danger': the heading in red (alerts, errors).
export function Card({ id, title, description, actions, children, className = '', tone = 'default', bare }: { id?: string; title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode; className?: string; tone?: 'default' | 'danger' | 'warn'; icon?: IconName; bare?: boolean }) {
  return (
    <section id={id} className={className}>
      {(title || actions) && (
        <div className="flex flex-wrap items-end justify-between gap-x-3 px-3 pb-1.5">
          {title && <h2 className={`${headingCls} ${tone === 'danger' ? 'text-danger' : ''}`} style={headingStyle}>{title}</h2>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {description && <p className={`${caption} px-3 pb-2`}>{description}</p>}
      <div className={bare ? card : `${card} p-4`}>{children}</div>
    </section>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 px-3">
      <div className="min-w-0">
        {eyebrow && <p className={headingCls} style={headingStyle}>{eyebrow}</p>}
        <h1 className={pageTitle}>{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-base text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// A row of a card around a native checkbox or radio (the input stays visible: forms and drills work unchanged); chosen, it takes the
// accent's soft ground. The card around the rows (checkList) clips their corners.
export function CheckCard({ type = 'checkbox', name, value, defaultChecked, children, className = '' }: { type?: 'checkbox' | 'radio'; name: string; value?: string; defaultChecked?: boolean; children: React.ReactNode; className?: string; dense?: boolean }) {
  return (
    <label className={`flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 has-checked:bg-accent-soft ${className}`}>
      <input type={type} name={name} value={value} defaultChecked={defaultChecked} className="check" />
      <span className="min-w-0 text-base">{children}</span>
    </label>
  );
}
export const checkList = `${card} overflow-hidden`;

// The venue logo on its own brand background (Senso on cream, Kebab Land white-on-dark): the brand colour is the venue's, not the admin's.
export function LogoTile({ venue, className = 'h-10 w-14', pad = 'p-1.5' }: { venue: Venue; className?: string; pad?: string }) {
  const bg = venue.brand?.colors?.background || 'var(--color-canvas)';
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line ${pad} ${className}`} style={{ background: bg }}>
      {venue.brand?.logo ? <img src={venue.brand.logo.url} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[13px] font-semibold">{(venue.name.en || '?').slice(0, 1)}</span>}
    </span>
  );
}

// A person's initials in their circle (the one round thing the admin draws besides the switch).
export function Avatar({ name, className = 'h-9 w-9' }: { name: string; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
  return <span data-avatar="" className={`flex shrink-0 items-center justify-center rounded-full bg-accent-ink text-[13px] font-semibold text-canvas ${className}`}>{initials}</span>;
}

export const roleLabel = (s: Session) => (s.role === 'admin' ? 'Admin' : s.role === 'owner' ? 'Owner' : 'Staff');

export function Empty({ icon = 'sparkle', title, hint, action }: { icon?: IconName; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className={`${card} flex flex-col items-center px-4 py-10 text-center`}>
      <span className="rounded-xl bg-fill p-3 text-ink-muted"><Icon name={icon} className="h-6 w-6" /></span>
      <p className="mt-3 text-base font-semibold">{title}</p>
      {hint && <p className={`mt-1 max-w-sm ${caption}`}>{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function When({ at, style = 'full' }: { at: string | Date; style?: 'full' | 'time' | 'date' }) {
  const d = new Date(at);
  const text = style === 'time' ? d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }) : style === 'date' ? d.toLocaleDateString('en-CA', { dateStyle: 'medium' }) : d.toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' });
  return <time dateTime={d.toISOString()}>{text}</time>;
}
