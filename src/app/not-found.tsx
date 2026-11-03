import { listVenueRows } from '@/lib/admin/venue';
import { BackToMenu } from './not-found-link';

// The page for an address that does not exist (pre-go-live audit, Part B #9; the PM's fix batch A2, 2026-11-03): a short line in both
// languages and, when the address starts with a venue's own (/senso/…), a link back to that venue's menu. Never a list of the venues (ruling
// 5: no page links them together). The venues are read when the page is built; a venue added later gets its link at the next build.
export default async function NotFound() {
  let venues: { id: string; name: string }[] = [];
  try { venues = (await listVenueRows()).map((v) => ({ id: v.id, name: v.name.en ?? v.id })); } catch { /* no database at hand: no link */ }
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-16 text-center text-ink">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p lang="fa" dir="rtl" className="mt-1 text-xl font-semibold">صفحه پیدا نشد</p>
      <p className="mt-4 text-[15px] text-ink-muted">This address is not on the menu.</p>
      <p lang="fa" dir="rtl" className="mt-1 text-[15px] text-ink-muted">این نشانی در منو نیست.</p>
      <BackToMenu venues={venues} />
    </main>
  );
}
