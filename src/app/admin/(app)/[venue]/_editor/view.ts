// What the preview shows (Kian, 2026-10-09: the preview control bar). Plain data shared by the editor, the preview and the bar.
// One `View` for both previews (the laptop frame and the phone overlay); the screen is remembered per tab by the editor.
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
// item: the item whose popup the "Item popup" screen opens (null = the first item of the page). replay: a counter; each increment
// replays the welcome animation from the start.
export type View = { screen: Screen; lang: 'en' | 'fa'; season: Season | null; slot: Slot | null; item: string | null; replay: number };
export type ViewPatch = Partial<Omit<View, 'replay'>> & { replay?: true };
// The page's own season and greeting, read from the loaded frame: the bar marks them as the defaults.
export type PageNow = { season: Season | null; slot: Slot | null };
