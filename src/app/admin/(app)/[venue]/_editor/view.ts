// What the preview shows (Kian, 2026-10-09: the preview control bar). Plain data shared by the editor, the preview and the bar.
// One `View` for both previews (the laptop frame and the phone overlay). Since Kian's ruling of 2026-10-10 the bar sits in the Style tab
// only, so the screen is the Style tab's; the Menu and Details tabs always show the menu.
import type { Season, Slot } from '@/lib/welcome';

export type Screen = 'welcome' | 'menu' | 'sheet' | 'list';
export const SCREENS: { id: Screen; label: string }[] = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'menu', label: 'Menu' },
  { id: 'sheet', label: 'Item popup' },
  { id: 'list', label: 'Section list' },
];
export const SLOTS: { id: Slot; label: string }[] = [{ id: 'morning', label: 'Morning' }, { id: 'afternoon', label: 'Afternoon' }, { id: 'evening', label: 'Evening' }];
// season / slot: null = the page's own (the season it was rendered for; the greeting of the device clock), as customers get it.
// replay: a counter; each increment replays the welcome animation from the start. play: a counter; each increment plays the venue's
// transition from the welcome screen into the menu (Style tab → Welcome → Transition, 2026-10-10), in the preview's season and language.
// playTx: the concept a play is for when it was just chosen (its save is still on its way): the preview plays that one in the frame on
// screen, with its code from the admin's scene API, so the frame is not swapped before it plays; null: the frame's own.
export type View = { screen: Screen; lang: 'en' | 'fa'; season: Season | null; slot: Slot | null; replay: number; play: number; playTx: string | null };
export type ViewPatch = Partial<Omit<View, 'replay' | 'play' | 'playTx'>> & { replay?: true; play?: true; playTx?: string };
// The page's own season and greeting, read from the loaded frame: the bar marks them as the defaults.
export type PageNow = { season: Season | null; slot: Slot | null };
