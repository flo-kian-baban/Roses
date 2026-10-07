import { redirect } from 'next/navigation';
import { Empty, Notice, type SP } from '../_ui';
import { TopBar } from '../_ui/TopBar';
import { SignIn } from '../_ui/SignIn';
import { adminContext } from '../_ui/context';

export const dynamic = 'force-dynamic';

// /admin: the venue picker when signed out; signed in, straight to the first venue's page editor (one screen per venue).
export default async function Home({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { session, all, mine } = await adminContext();
  if (!session) return <SignIn venues={all} sp={sp} path="/admin" />;
  if (mine.length) redirect(`/admin/${mine[0].id}`);
  return (
    <TopBar session={session} venues={mine}>
      <main className="mx-auto max-w-2xl px-4 py-8"><Notice sp={sp} /><Empty icon="shield" title="No venue on this PIN" hint="Ask the owner or an admin to add a venue to your PIN." /></main>
    </TopBar>
  );
}
