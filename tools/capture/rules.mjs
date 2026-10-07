// Shared rules: what is not menu content and must never be saved (Kian's decision, 2026-10-07).
// Used by capture.mjs (new runs), purge.mjs (existing captures) and analyze.mjs.

// Responses that are account, ordering or location configuration rather than menu content.
export const NON_MENU_URL = [
  { re: /[?&]dataCategory=0\b/i, reason: 'location configuration payload (contact details, hardware addresses, tax, payment and delivery settings): not menu content' },
  { re: /\/BusinessAccounts\/[0-9a-f-]{36}/i, reason: 'account settings and contact details: not menu content' },
  { re: /OnlineOrderingHours/i, reason: 'ordering hours: account setting, not menu content' },
  { re: /\/orders\//i, reason: 'ordering configuration: not menu content' },
];

// The account lookup is kept only for the ids that identify the menu payloads and the public venue name.
export const ACCOUNT_LOOKUP_URL = /BusinessAccounts\?xRefCode=/i;
export const ACCOUNT_KEEP_KEYS = ['BusinessAccountId', 'BusinessLocationId', 'BusinessAccountName', 'ClientNamespace', 'SupportedLanguages', 'PrimaryLanguageId'];

// Contact details and network addresses are masked wherever they appear in saved text.
export const CONTACT_PATTERNS = [
  { name: 'email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, mask: () => '[EMAIL REMOVED]' },
  { name: 'tel-link', re: /\b(tel|callto|sms):\s*\+?[\d\s().-]{7,}/gi, mask: (m, scheme) => `${scheme}: [PHONE REMOVED]` },
  { name: 'phone', re: /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g, mask: () => '[PHONE REMOVED]' },
  { name: 'ipv4', re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, mask: () => '[IP REMOVED]' },
];

export function maskContact(text) {
  const counts = {};
  for (const p of CONTACT_PATTERNS) text = text.replace(p.re, (...args) => { counts[p.name] = (counts[p.name] || 0) + 1; return p.mask(...args); });
  return { text, counts };
}
export function contactFindings(text) {
  const out = {};
  for (const p of CONTACT_PATTERNS) { const n = (text.match(p.re) || []).length; if (n) out[p.name] = n; }
  return out;
}
export function digitsOf(s) { return String(s || '').replace(/\D/g, ''); }

// Walks a JSON value and masks every string; returns the total counts.
export function maskDeep(value, counts = {}) {
  if (typeof value === 'string') { const r = maskContact(value); for (const [k, v] of Object.entries(r.counts)) counts[k] = (counts[k] || 0) + v; return r.text; }
  if (Array.isArray(value)) return value.map((v) => maskDeep(v, counts));
  if (value && typeof value === 'object') { for (const k of Object.keys(value)) value[k] = maskDeep(value[k], counts); return value; }
  return value;
}
