import { route, redirect, forbidden, list, text } from '@/lib/admin/api';
import { canManage } from '@/lib/admin/auth';
import { createPin, revokePin } from '@/lib/admin/pins';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export default route({}, async ({ res, session, body, back }) => {
  const s = session!;
  if (!canManage(s)) return forbidden(res, 'PINs are managed by the owner or an admin');
  if (body._action === 'revoke') { await revokePin(body.id); return redirect(res, back, { revoked: '1' }); }
  const name = text(body, 'name'); const role = body.role === 'owner' ? 'owner' : 'staff'; const venueIds = list(body, 'venue_ids');
  if (!name) return redirect(res, back, { error: 'a name is required' });
  if (!venueIds.length) return redirect(res, back, { error: 'choose at least one venue' });
  const { pin } = await createPin({ name, role, venueIds, createdBy: s.kind === 'admin' ? s.id : null });
  // Shown once, in this response only; never in a URL, log or database.
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>New PIN</title>
<style>body{font-family:system-ui,sans-serif;margin:0;padding:24px;background:#fff;color:#111}main{max-width:28rem;margin:0 auto}.pin{font-size:3rem;letter-spacing:.3em;font-variant-numeric:tabular-nums;margin:1rem 0;padding:1rem;border:2px solid #111;border-radius:.5rem;text-align:center}a{display:inline-block;margin-top:1.5rem;padding:.75rem 1.25rem;background:#111;color:#fff;border-radius:.5rem;text-decoration:none}</style></head>
<body><main><h1>PIN for ${esc(name)}</h1><p>${role === 'owner' ? 'Owner' : 'Staff'} · ${esc(venueIds.join(', '))}</p><p class="pin">${pin}</p><p><strong>Write it down now.</strong> It is shown this once and is not stored anywhere readable. If it is lost, revoke it and create a new one.</p><a href="/admin/team">Back to Team</a></main></body></html>`);
});
