export type Bi = { en: string | null; fa: string | null };
export type Location = { label: Bi; address: string | null; phone: string | null; hours: Bi; confirm?: string[] }; // confirm: fields still "to confirm" with the owner (admin only)
export type Brand = {
  logo: { url: string; width: number; height: number } | null;
  colors: Record<string, string>;
  fonts: { heading: string; body: string; persian: string; faces?: { family: string; url: string; weight?: string }[]; site?: { heading: string; body: string } };
  sources?: { token: string; value: string; source: string }[];
};
export type Venue = { id: string; name: Bi; tagline: Bi; locations: Location[]; brand: Brand; settings: { showPersianDrafts: boolean } };
export type AddOn = { group: Bi; label: Bi; price: number; required: boolean };
export type Variant = { label: Bi; price: number | null };
export type Component = { item_id: string | null; label: Bi; qty: number };
export type Item = {
  id: string; name: Bi; description: Bi; price: number | null; variants: Variant[]; add_ons: AddOn[]; components: Component[];
  serves: string | null; photo: { url: string; alt: Bi } | null; listed: boolean; fa_draft: string[]; position: number;
};
export type Section = { id: string; name: Bi; note: Bi; position: number; listed: boolean; fa_draft: string[]; items: Item[] };

// ---- Page editor payload (admin). Plain data, safe for client components: no database imports here. ----
export type Notes = { allergens: string[]; dietary: string[]; halal: boolean | null; text: Bi };
export type Placement = { section_id: string; position: number };
export type EditorItem = {
  id: string; name: Bi; description: Bi; price: number | null; variants: Variant[]; add_ons: AddOn[]; components: Component[];
  serves: string | null; photo: { url: string; alt: Bi } | null; notes: Notes; listed: boolean; fa_draft: string[]; placements: Placement[];
};
export type EditorSection = { id: string; name: Bi; note: Bi; position: number; listed: boolean; fa_draft: string[]; item_ids: string[] };
export type EditorMenu = { sections: EditorSection[]; items: Record<string, EditorItem>; orphans: string[] };
