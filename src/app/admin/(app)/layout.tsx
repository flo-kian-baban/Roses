import { redirect } from 'next/navigation';
import { getSession } from '@/lib/admin/session';
import { listVenueRows } from '@/lib/admin/venue';
import { canEditVenue, isAdmin } from '@/lib/admin/auth';
import { secondary } from '../_ui';

export const dynamic = 'force-dynamic';

export default async function AdminShell({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/admin/login');
  const venues = (await listVenueRows()).filter((v) => canEditVenue(session, v.id));
  return (
    <>
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <a href="/admin" className="font-semibold">Menu admin</a>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            {venues.map((v) => <a key={v.id} href={`/admin/${v.id}`} className="rounded-full border border-neutral-300 px-3 py-1">{v.name.en}</a>)}
            {isAdmin(session) && <a href="/admin/pins" className="rounded-full border border-neutral-300 px-3 py-1">PINs</a>}
          </nav>
          <form method="post" action="/api/admin/logout" className="flex items-center gap-2 text-sm">
            <span className="text-neutral-600">{session.name} · {session.role}</span>
            <button className={`${secondary} min-h-9 px-3 py-1 text-sm`} type="submit">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </>
  );
}
