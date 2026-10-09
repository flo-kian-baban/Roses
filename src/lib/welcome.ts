// The welcome screen's rules and words (Kian, 2026-10-09). Plain data, no React, no database: imported by the public Welcome
// component, the public pages (the season), the admin's Style tab and preview, and read by the suite. The head script in
// src/components/Welcome.tsx applies the greeting rule on the visitor's device before first paint; keep them in step.
export type Season = 'fall' | 'winter' | 'spring' | 'summer';
export type Slot = 'morning' | 'afternoon' | 'evening';
export const SEASONS: { id: Season; label: string; months: string }[] = [
  { id: 'fall', label: 'Fall', months: 'September to November' },
  { id: 'winter', label: 'Winter', months: 'December to February' },
  { id: 'spring', label: 'Spring', months: 'March to May' },
  { id: 'summer', label: 'Summer', months: 'June to August' },
];
// Greeting by the device clock (Kian's ruling): 05:00–11:59 morning, 12:00–16:59 afternoon, 17:00–04:59 evening; no "Good night"
// (a farewell in English). The Persian lines are drafts for Kian's review (reports/welcome/README.md lists them).
export const GREETINGS: { slot: Slot; hours: string; en: string; fa: string }[] = [
  { slot: 'morning', hours: '05:00–11:59', en: 'Good morning', fa: 'صبح بخیر' },
  { slot: 'afternoon', hours: '12:00–16:59', en: 'Good afternoon', fa: 'ظهر بخیر' },
  { slot: 'evening', hours: '17:00–04:59', en: 'Good evening', fa: 'عصر بخیر' },
];
export const slotOf = (hour: number): Slot => (hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 17 ? 'afternoon' : 'evening');
// Northern Hemisphere by month only (0 = January), no override: Sep–Nov fall, Dec–Feb winter, Mar–May spring, Jun–Aug summer.
export const seasonOf = (month: number): Season => (month >= 8 && month <= 10 ? 'fall' : month === 11 || month <= 1 ? 'winter' : month <= 4 ? 'spring' : 'summer');

// Current season only (the PM's build decision, 2026-10-09): each page ships one season's scene, chosen when the page is rendered
// from the date in America/Toronto (the venues' time zone, not the visitor's device and not UTC), and every public page is
// regenerated at least hourly (REVALIDATE_SECONDS in its getStaticProps, standard time-based ISR), so the season flips within an
// hour of midnight on the 1st; an admin save still regenerates at once. ROSES_NOW (an ISO instant) stands in for the clock in
// the check suite's season drill only; it is never set in production.
export const TIME_ZONE = 'America/Toronto';
export const REVALIDATE_SECONDS = 3600;
export function renderNow(): Date {
  const o = typeof process !== 'undefined' ? process.env?.ROSES_NOW : undefined;
  if (o) { const d = new Date(o); if (!Number.isNaN(d.getTime())) return d; }
  return new Date();
}
export const monthIn = (d: Date, timeZone = TIME_ZONE): number => Number(new Intl.DateTimeFormat('en-US', { timeZone, month: 'numeric' }).format(d)) - 1;
export const seasonNow = (): Season => seasonOf(monthIn(renderNow()));
