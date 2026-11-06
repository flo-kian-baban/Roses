// The admin's look (the PM's admin-wide clean-up, 2026-11-06, extending the item editor's rules of 2026-11-04 to every screen): white
// cards with thin dividers on the grey page, small grey headings over them, labels on the left and values on the right; one accent
// (accent-ink) for actions and selected states, green only on toggles, red for Delete and errors only; text 13, 16 and 17 px plus the page
// title (28 px); one corner radius (12 px; the iOS switch keeps its pill, a person's initials their circle); tap targets of 44 × 44 at least.
// Class names only, with the admin's colour tokens (src/app/globals.css, the one place its colours are defined): imported by the
// server-rendered screens (sign-in, Team, the top bar) and the page editor's client components alike, so no hooks and no 'use client'.

// A card, and a row in it.
export const card = 'rounded-xl bg-canvas divide-y divide-line';
export const row = 'flex min-h-11 items-center gap-3 px-3';
// The small grey heading over a card (13 px, uppercase), and the page title.
export const headingCls = 'text-[13px] uppercase leading-5 text-ink-muted';
export const headingStyle = { fontWeight: 500, letterSpacing: '.04em' } as const;
export const pageTitle = 'text-[28px] font-semibold leading-tight';
export const caption = 'text-[13px] text-ink-muted';
// Actions: plain accent text; the one filled button of a screen; a quiet one (Cancel); Delete in red, text or filled for a confirmation.
export const textBtn = 'inline-flex min-h-11 items-center gap-1.5 text-base font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-50';
export const dangerText = 'inline-flex min-h-11 items-center gap-1.5 text-base font-semibold text-danger disabled:cursor-not-allowed disabled:opacity-50';
export const primaryBtn = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent-ink px-5 text-base font-semibold whitespace-nowrap text-canvas disabled:cursor-not-allowed disabled:opacity-50';
export const quietBtn = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-fill px-5 text-base font-semibold whitespace-nowrap text-ink disabled:cursor-not-allowed disabled:opacity-50';
export const dangerBtn = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-danger px-5 text-base font-semibold whitespace-nowrap text-canvas disabled:cursor-not-allowed disabled:opacity-50';
// A field on its own (sign-in, a sheet): filled grey, no border; in a card the item editor's borderless cells are used instead.
export const field = 'block w-full min-w-0 rounded-xl bg-fill px-3 py-2.5 text-base text-ink placeholder:text-ink-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-ink/40';
// A choice that is on or off, and one of a row of equal choices (13 px, so five fit on a 360 px phone).
// onGrey: the chip sits on a grey ground (an open row), so off it is white instead of grey.
export const chipCls = (on: boolean, onGrey = false) => `inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl px-3 text-base ${on ? 'bg-accent-soft font-semibold text-accent-ink' : onGrey ? 'bg-canvas text-ink' : 'bg-fill text-ink'}`;
export const segCls = (on: boolean) => `flex h-11 min-w-0 items-center justify-center rounded-xl px-1 text-[13px] ${on ? 'bg-accent-soft font-semibold text-accent-ink' : 'bg-fill text-ink'} disabled:cursor-not-allowed`;
// A popover menu (venue switcher, account, a section's menu): a card floating over the page.
export const popover = 'rounded-xl bg-canvas p-1 shadow-pop';
export const popoverItem = 'flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-base hover:bg-fill disabled:opacity-40';
// A small tag in a row (Hidden, Needs price, Owner…): 13 px text, no box.
export const tag = 'text-[13px] text-ink-muted whitespace-nowrap';
