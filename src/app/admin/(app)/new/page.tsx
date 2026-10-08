import { redirect } from 'next/navigation';
import { canManage } from '@/lib/admin/auth';
import { PageHeader } from '../../_ui';
import { TopBar } from '../../_ui/TopBar';
import { Forbidden } from '../_forbidden';
import { adminContext } from '../../_ui/context';
import { NewVenue } from '../[venue]/_editor/NewVenue';

export const dynamic = 'force-dynamic';

// "+ Add venue" (owner and admin), reached from the venue dropdown.
export default async function NewVenuePage() {
  const { session, mine } = await adminContext();
  if (!session) redirect('/admin');
  if (!canManage(session)) return <TopBar session={session} venues={mine}><main className="mx-auto max-w-2xl px-4 py-8"><Forbidden what="adding a venue (owner and admin only)" /></main></TopBar>;
  return (
    <TopBar session={session} venues={mine}>
      <main className="mx-auto w-full max-w-lg px-4 pb-16 pt-6 sm:px-6">
        <PageHeader title="Add venue" subtitle="A new menu page with its own address, on the default template." />
        <NewVenue />
      </main>
    </TopBar>
  );
}
