export type Bi = { en: string | null; fa: string | null };
export type Location = { label: Bi; address: string | null; phone: string | null; hours: Bi; confirm?: string[] }; // confirm: fields still "to confirm" with the owner (admin only)
// An uploaded file carries its storage key (so it can be found and removed later); a linked photo has a URL only.
export type Photo = { url: string; alt: Bi; key?: string | null; width?: number | null; height?: number | null };
export type Logo = { url: string; width: number; height: number; key?: string | null; sourceUrl?: string; sha256?: string; copiedAt?: string };
export type StyleValues = Record<string, string | boolean>;
export type Brand = {
  logo: Logo | null;
  colors: Record<string, string>;
  fonts: { heading: string; body: string; persian: string; faces?: { family: string; url: string; weight?: string }[]; site?: { heading: string; body: string } };
  sources?: { token: string; value: string; source: string }[];
};
export type Venue = { id: string; name: Bi; tagline: Bi; locations: Location[]; brand: Brand; settings: { showPersianDrafts: boolean }; template: string; style: StyleValues };
export type AddOn = { group: Bi; label: Bi; price: number; required: boolean };
export type Variant = { label: Bi; price: number | null };
export type Component = { item_id: string | null; label: Bi; qty: number };
export type Item = {
  id: string; name: Bi; description: Bi; price: number | null; variants: Variant[]; add_ons: AddOn[]; components: Component[];
  serves: string | null; photo: Photo | null; listed: boolean; fa_draft: string[]; position: number;
};
// How a section is shown to customers (Kian, 2026-10-08): 'list' = full-width rows with a small square photo; 'grid' = two columns with bigger photos.
export type SectionLayout = 'list' | 'grid';
export type Section = { id: string; name: Bi; note: Bi; position: number; listed: boolean; fa_draft: string[]; layout: SectionLayout; items: Item[] };

// ---- Page editor payload (admin). Plain data, safe for client components: no database imports here. ----
export type Notes = { allergens: string[]; dietary: string[]; halal: boolean | null; text: Bi };
export type Placement = { section_id: string; position: number };
export type EditorItem = {
  id: string; name: Bi; description: Bi; price: number | null; variants: Variant[]; add_ons: AddOn[]; components: Component[];
  serves: string | null; photo: Photo | null; notes: Notes; listed: boolean; fa_draft: string[]; placements: Placement[];
};
export type EditorSection = { id: string; name: Bi; note: Bi; position: number; listed: boolean; fa_draft: string[]; layout: SectionLayout; item_ids: string[] };
export type EditorMenu = { sections: EditorSection[]; items: Record<string, EditorItem>; orphans: string[] };
// Venue details as the Details and Style tabs hold them (plain data for client components).
export type EditorVenue = { id: string; name: Bi; tagline: Bi; locations: Location[]; logo: Logo | null; settings: { showPersianDrafts: boolean }; template: string; style: StyleValues; brandColors: Record<string, string> };
