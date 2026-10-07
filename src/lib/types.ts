export type Bi = { en: string | null; fa: string | null };
export type Location = { label: Bi; address: string | null; phone: string | null; hours: Bi };
export type Brand = {
  logo: { url: string; width: number; height: number } | null;
  colors: Record<string, string>;
  fonts: { heading: string; body: string; persian: string; faces?: { family: string; url: string; weight?: string }[] };
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
