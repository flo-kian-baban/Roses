// The customers' pages' Content-Security-Policy (pre-go-live audit S2-10, the PM's fix batch of 2026-11-03: "a public CSP with hashes of
// the constant inline scripts"). Server only. The pages run no framework JavaScript, only their own inline scripts, so the policy allows
// exactly those by their SHA-256 hashes and nothing else: no script from anywhere else, no inline event attribute, no eval. It is written
// into each page as a <meta> when the page is rendered (pages/_document.tsx), from the scripts the page actually carries, so it can never
// fall out of step with them; a page with the welcome artwork also allows the scripts the admin's preview swaps into it (the other
// seasons' artwork engines and every transition, the code that /api/admin/welcome-scene answers). Photos: this site and the three hosts
// the menus' linked photos come from (src/lib/rules.ts PHOTO_HOSTS). Styles stay inline (the pages' colour tokens and the menu kit
// set them). frame-ancestors cannot be set by a <meta>: next.config.ts sends it as a header (the admin preview frames the page).
import { createHash } from 'node:crypto';
import { engineFor } from '@/components/Welcome';
import { transitionCode } from '@/lib/welcome-transitions';
import { TX_SEASONS, type TransitionId } from '@/lib/transitions';
import { PHOTO_HOSTS } from '@/lib/rules';

const hash = (code: string) => `'sha256-${createHash('sha256').update(code, 'utf8').digest('base64')}'`;
const IDS: TransitionId[] = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10'];
let previewHashes: string[] | null = null;
function forPreview(): string[] {
  if (previewHashes) return previewHashes;
  const code = new Set<string>();
  for (const k of ['leaves', 'snow', 'sun', 'bloom'] as const) code.add(engineFor(k));
  for (const id of IDS) for (const s of TX_SEASONS) { const t = transitionCode(id, s); if (t) code.add(t.js); }
  return (previewHashes = [...code].map(hash));
}

export function cspFor(scripts: string[], opts: { preview?: boolean } = {}): string {
  const allowed = [...new Set([...scripts.map(hash), ...(opts.preview ? forPreview() : [])])];
  return [
    "default-src 'self'",
    `script-src ${allowed.length ? allowed.join(' ') : "'none'"}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: ${PHOTO_HOSTS.map((h) => `https://${h}`).join(' ')}`,
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

// The inline scripts of a rendered page: the body's <script> elements without src, and those next/head put in the head.
export function inlineScripts(html: string, head: unknown[]): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)) out.push(m[1]);
  for (const el of head) {
    const e = el as { type?: unknown; props?: { dangerouslySetInnerHTML?: { __html?: unknown }; children?: unknown } } | null;
    if (e?.type === 'script' && typeof e.props?.dangerouslySetInnerHTML?.__html === 'string') out.push(e.props.dangerouslySetInnerHTML.__html);
  }
  return out;
}
