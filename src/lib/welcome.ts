// The welcome screen's two rules and its words (Kian, 2026-10-09). Plain data, no React, no database: imported by the public
// Welcome component, the admin's Style tab and preview (the "Now" season), and read by the suite. The head script in
// src/components/Welcome.tsx applies the same two rules on the visitor's device before first paint; keep them in step.
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
