// The welcome screen's transitions into the menu (owner and manager via Kian, 2026-10-10: unique, beautiful, smooth). Plain data,
// no React, no database: the names, levels, durations and one-line descriptions of the ten concepts, read by the Style tab (the
// "Transition" choice in its Welcome group), the template's option (src/venues/styles.ts) and the code that builds each concept
// (src/lib/welcome-transitions.ts, server only). Senso only until Kian confirms it; Kebab Land and the default template keep
// the 200 ms fade of 2026-10-09.
// Kian's rulings: ten concepts ordered by creativity (T1–T3 subtle, T4–T7 expressive, T8–T10 bold); each built natively for every
// season with that season's own objects and motion (fall and winter on 2026-10-10; spring and summer on 2026-10-11, once their artwork
// was final: the picked blossoms and bud, the Persian sun with its sparkles, motes and dandelion seeds); total ≤ 900 ms; the menu usable
// within 300 ms of the tap (the overlay lets taps and scrolls through from the tap on; the transition reveals the menu, it never
// delays it); the chosen language applied before anything moves; reduced motion: a 150 ms fade for every concept; only the venue's
// selected transition ships in the page, for the season the page is rendered for; default T1 until the owner picks. Since 2026-10-11
// (Kian's ruling) the venue chooses one concept per season (src/venues/styles.ts: transitionFall … transitionSummer).
import type { Season } from './welcome';

export type TransitionId = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'T8' | 'T9' | 'T10';
export type TxLevel = 'subtle' | 'expressive' | 'bold';
export type TxSeason = Season;
export const TX_SEASONS: TxSeason[] = ['fall', 'winter', 'spring', 'summer'];
export const isTxSeason = (s: Season | null | undefined): s is TxSeason => !!s && (TX_SEASONS as string[]).includes(s);
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
    winter: { ms: 560, text: 'The welcome fades into the menu; each snowflake melts away on its own.' },
    spring: { ms: 560, text: 'The welcome fades into the menu; each blossom closes softly and fades as it drifts down, the far ones first.' },
    summer: { ms: 540, text: 'The welcome fades into the menu; the sunlight softens away and the seeds drift off on the breeze.' } },
  { id: 'T2', name: 'Lift', level: 'subtle',
    fall: { ms: 660, text: 'The card floats up and away while the leaves are let go and drop out of view.' },
    winter: { ms: 680, text: 'The card floats up; the warm air from inside carries the snow up and melts it.' },
    spring: { ms: 720, text: 'The card floats up; a spring breeze lifts the blossoms up and away with it.' },
    summer: { ms: 720, text: 'The card floats up; warm air carries the dandelion seeds up and out of view.' } },
  { id: 'T3', name: 'Step inside', level: 'subtle',
    fall: { ms: 700, text: 'You step through the leaves: the card opens toward you and the leaves brush past.' },
    winter: { ms: 690, text: 'You step in from the snow: the flakes stream past you from the middle of the screen.' },
    spring: { ms: 700, text: 'You step in under the blossoms: the card opens toward you and the blossoms float past on either side.' },
    summer: { ms: 700, text: 'You step in out of the sun: the card opens toward you and the seeds and sparkles drift past you.' } },
  { id: 'T4', name: 'Curtain', level: 'expressive',
    fall: { ms: 790, text: 'The cream drops like a curtain with a row of leaves tumbling along its edge.' },
    winter: { ms: 800, text: 'The cream slides down like snow off a roof, dusting flakes from its snowy edge.' },
    spring: { ms: 790, text: 'The cream drops like a curtain with a garland of blossoms along its edge.' },
    summer: { ms: 790, text: 'The cream lowers like a sunshade with sparkles on its edge while the sun sinks away; the menu shows from the top.' } },
  { id: 'T5', name: 'Gust', level: 'expressive',
    fall: { ms: 770, text: 'A gust from the left blows the leaves off the screen, tumbling, and pulls the cream with them.' },
    winter: { ms: 760, text: 'A gust of blowing snow streaks across the screen and sweeps the cream away.' },
    spring: { ms: 770, text: 'A spring breeze from the left carries the blossoms off, twirling, and pulls the cream away behind them.' },
    summer: { ms: 760, text: 'A warm breeze from the left blows the seeds across and sweeps the cream away with them.' } },
  { id: 'T6', name: 'Homecoming', level: 'expressive',
    fall: { ms: 800, text: 'The logo flies home to the top of the menu; the leaves swirl after it in its wake.' },
    winter: { ms: 820, text: 'The logo flies home to the top of the menu and lands in a soft puff of snow.' },
    spring: { ms: 820, text: 'The logo flies home to the top of the menu and lands in a little burst of blossoms.' },
    summer: { ms: 820, text: 'The logo flies home to the top of the menu with sparkles in its wake while the sun sets.' } },
  { id: 'T7', name: 'Tip back', level: 'expressive',
    fall: { ms: 800, text: 'The leaves settle at the bottom, then the welcome card tips back and lies down flat.' },
    winter: { ms: 810, text: 'The snow settles into a drift, then the welcome card tips back and lies down flat.' },
    spring: { ms: 800, text: 'The blossoms settle along the bottom like fallen petals, then the welcome card tips back and lies down flat.' },
    summer: { ms: 800, text: 'The seeds settle at the bottom, then the welcome card tips back into the warm light and lies down flat.' } },
  { id: 'T8', name: 'Storm', level: 'bold',
    fall: { ms: 820, text: 'A flurry of big leaves fills the screen, then the wind blows them apart onto the menu.' },
    winter: { ms: 820, text: 'The snow thickens into a soft white-out, then clears onto the menu.' },
    spring: { ms: 820, text: 'A shower of blossoms fills the screen, then the breeze scatters it onto the menu.' },
    summer: { ms: 820, text: 'A cloud of dandelion seeds fills the screen, then the breeze blows it apart onto the menu.' } },
  { id: 'T9', name: 'Window', level: 'bold',
    fall: { ms: 820, text: 'The leaves gather into a wreath around a clearing that opens out to the edges.' },
    winter: { ms: 820, text: 'The screen frosts over, then the frost recedes from the middle to the edges like a warming window.' },
    spring: { ms: 820, text: 'The blossoms gather into a wreath around a clearing that opens out to the edges.' },
    summer: { ms: 820, text: 'A ring of sparkling light opens a clearing in the middle that spreads out to the edges.' } },
  { id: 'T10', name: 'Scatter', level: 'bold',
    fall: { ms: 800, text: 'The welcome screen breaks into cream leaves that flutter away from your tap.' },
    winter: { ms: 790, text: 'The welcome screen crystallises into ice tiles that fall away from your tap.' },
    spring: { ms: 800, text: 'The welcome screen breaks into cream petals that flutter away from your tap.' },
    summer: { ms: 800, text: 'The welcome screen breaks into cream shards, like rays of the sun, that fall away from your tap.' } },
];
export const TRANSITION_BY_ID = Object.fromEntries(TRANSITIONS.map((t) => [t.id, t])) as Record<TransitionId, TransitionDef>;
export const isTransitionId = (v: unknown): v is TransitionId => typeof v === 'string' && v in TRANSITION_BY_ID;
