// The welcome screen's transitions into the menu (owner and manager via Kian, 2026-10-10: unique, beautiful, smooth). Plain data,
// no React, no database: the names, levels, durations and one-line descriptions of the ten concepts, read by the Style tab (the
// "Transition" choice in its Welcome group), the template's option (src/venues/styles.ts) and the code that builds each concept
// (src/lib/welcome-transitions.ts, server only). Senso only until Kian confirms it; Kebab Land and the default template keep
// the 200 ms fade of 2026-10-09.
// Kian's rulings: ten concepts ordered by creativity (T1–T3 subtle, T4–T7 expressive, T8–T10 bold); each built natively for every
// season it ships in with that season's own objects and motion (fall and winter now; spring and summer only for the concepts the
// manager picks, after their artwork is final: until then those seasons keep the 200 ms fade); total ≤ 900 ms; the menu usable
// within 300 ms of the tap (the overlay lets taps and scrolls through from the tap on; the transition reveals the menu, it never
// delays it); the chosen language applied before anything moves; reduced motion: a 150 ms fade for every concept; only the venue's
// selected transition ships in the page, for the season the page is rendered for; default T1 until the owner picks.
import type { Season } from './welcome';

export type TransitionId = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'T8' | 'T9' | 'T10';
export type TxLevel = 'subtle' | 'expressive' | 'bold';
export type TxSeason = 'fall' | 'winter';
export const TX_SEASONS: TxSeason[] = ['fall', 'winter'];
export const isTxSeason = (s: Season | null | undefined): s is TxSeason => s === 'fall' || s === 'winter';
// ms: the concept's own length, from its first frame to the end of its last animation, when the overlay goes (display none); a phone
// starts it a frame or a few after the tap, and the overlay goes 880 ms after the tap at the latest (src/lib/welcome-transitions.ts CAP_MS).
export type TxSeasonDef = { ms: number; text: string };
export type TransitionDef = { id: TransitionId; name: string; level: TxLevel } & Record<TxSeason, TxSeasonDef>;
export const DEFAULT_TRANSITION: TransitionId = 'T1';
export const REDUCED_MS = 150;
export const LEVELS: Record<TxLevel, string> = { subtle: 'Subtle', expressive: 'Expressive', bold: 'Bold' };

export const TRANSITIONS: TransitionDef[] = [
  { id: 'T1', name: 'Dissolve', level: 'subtle',
    fall: { ms: 540, text: 'The welcome fades into the menu; each leaf fades as it falls, the far ones first.' },
    winter: { ms: 560, text: 'The welcome fades into the menu; each snowflake melts away on its own.' } },
  { id: 'T2', name: 'Lift', level: 'subtle',
    fall: { ms: 660, text: 'The card floats up and away while the leaves are let go and drop out of view.' },
    winter: { ms: 680, text: 'The card floats up; the warm air from inside carries the snow up and melts it.' } },
  { id: 'T3', name: 'Step inside', level: 'subtle',
    fall: { ms: 700, text: 'You step through the leaves: the card opens toward you and the leaves brush past.' },
    winter: { ms: 690, text: 'You step in from the snow: the flakes stream past you from the middle of the screen.' } },
  { id: 'T4', name: 'Curtain', level: 'expressive',
    fall: { ms: 790, text: 'The cream drops like a curtain with a row of leaves tumbling along its edge.' },
    winter: { ms: 800, text: 'The cream slides down like snow off a roof, dusting flakes from its snowy edge.' } },
  { id: 'T5', name: 'Gust', level: 'expressive',
    fall: { ms: 770, text: 'A gust from the left blows the leaves off the screen, tumbling, and pulls the cream with them.' },
    winter: { ms: 760, text: 'A gust of blowing snow streaks across the screen and sweeps the cream away.' } },
  { id: 'T6', name: 'Homecoming', level: 'expressive',
    fall: { ms: 800, text: 'The logo flies home to the top of the menu; the leaves swirl after it in its wake.' },
    winter: { ms: 820, text: 'The logo flies home to the top of the menu and lands in a soft puff of snow.' } },
  { id: 'T7', name: 'Tip back', level: 'expressive',
    fall: { ms: 800, text: 'The leaves settle at the bottom, then the welcome card tips back and lies down flat.' },
    winter: { ms: 810, text: 'The snow settles into a drift, then the welcome card tips back and lies down flat.' } },
  { id: 'T8', name: 'Storm', level: 'bold',
    fall: { ms: 820, text: 'A flurry of big leaves fills the screen, then the wind blows them apart onto the menu.' },
    winter: { ms: 820, text: 'The snow thickens into a soft white-out, then clears onto the menu.' } },
  { id: 'T9', name: 'Window', level: 'bold',
    fall: { ms: 820, text: 'The leaves gather into a wreath around a clearing that opens out to the edges.' },
    winter: { ms: 820, text: 'The screen frosts over, then the frost recedes from the middle to the edges like a warming window.' } },
  { id: 'T10', name: 'Scatter', level: 'bold',
    fall: { ms: 800, text: 'The welcome screen breaks into cream leaves that flutter away from your tap.' },
    winter: { ms: 790, text: 'The welcome screen crystallises into ice tiles that fall away from your tap.' } },
];
export const TRANSITION_BY_ID = Object.fromEntries(TRANSITIONS.map((t) => [t.id, t])) as Record<TransitionId, TransitionDef>;
export const isTransitionId = (v: unknown): v is TransitionId => typeof v === 'string' && v in TRANSITION_BY_ID;
