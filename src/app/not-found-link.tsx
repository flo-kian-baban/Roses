'use client';
import { useEffect, useState } from 'react';

// The link back to the venue whose address was mistyped (/senso/… → /senso), shown only when the first part of the address is a venue.
export function BackToMenu({ venues }: { venues: { id: string; name: string }[] }) {
  const [venue, setVenue] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => { const first = window.location.pathname.split('/')[1] ?? ''; setVenue(venues.find((v) => v.id === first) ?? null); }, [venues]);
  if (!venue) return null;
  return (
    <a href={`/${venue.id}`} data-back-to-menu={venue.id} className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-semibold text-white">
      <span>Back to the {venue.name} menu</span><span aria-hidden="true">·</span><span lang="fa" dir="rtl">بازگشت به منو</span>
    </a>
  );
}
