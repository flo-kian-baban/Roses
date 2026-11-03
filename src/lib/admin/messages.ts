// What the sign-in, Team and alert pages say after a form post. The routes send a code (?error=<code>, with the time a lock ends and the
// tries left as their own parameters); the page shows its own wording for that code, or one plain line for a code it does not know
// (pre-go-live audit S2-18: before, any ?error= text was shown as it came, so a link could put words of anyone's choosing on the sign-in page).
type Params = { at?: string; left?: string; paused?: string };
const AT = /^\d{1,2}:\d{2}(\s?[ap]\.?\s?m\.?)?$/i;
const MESSAGES: Record<string, (p: Params) => string> = {
  'choose-venue': () => 'Choose your venue.',
  locked: (p) => `Too many wrong PINs from this device.${p.at && AT.test(p.at) ? ` Try again at ${p.at}.` : ' Try again in 15 minutes.'}`,
  'wrong-pin': (p) => {
    const left = p.left && /^\d$/.test(p.left) ? Number(p.left) : null;
    const paused = p.paused === '1' ? ' Admin PINs are paused for now after many wrong PINs; admins can sign in with email and password.' : '';
    if (p.at && AT.test(p.at)) return `Wrong PIN. Too many wrong tries from this device: try again at ${p.at}.${paused}`;
    return `Wrong PIN${left == null ? '' : ` (${left} ${left === 1 ? 'try' : 'tries'} left)`}.${paused}`;
  },
  'locked-password': (p) => `Too many failed sign-ins.${p.at && AT.test(p.at) ? ` Try again at ${p.at}.` : ' Try again in 15 minutes.'}`,
  'wrong-password': (p) => `Wrong email or password.${p.at && AT.test(p.at) ? ` Too many failed sign-ins: try again at ${p.at}.` : ''}`,
  'pin-not-found': () => 'That PIN was not found.',
  'name-required': () => 'A name is required.',
  'name-too-long': () => 'The name is too long (at most 100 characters).',
  'venue-required': () => 'Choose at least one venue.',
  'venue-unknown': () => 'That venue does not exist.',
  'unknown-action': () => 'That did not work. Try again.',
  server: () => 'Something went wrong on the server. Try again.',
};
export function messageOf(code: string, p: Params = {}): string {
  return Object.hasOwn(MESSAGES, code) ? MESSAGES[code](p) : 'Something went wrong. Try again.';
}
