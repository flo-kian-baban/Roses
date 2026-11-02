# UI/UX audit: method and limits

Part B of the pre-go-live audit (the PM's brief, 2026-11-02). Report only: nothing in the product was changed for it; Kian rules on every proposed fix.

## What ran

`reports/ui-audit/ui-audit.mjs` (evidence script, not a step of the check suite), on a scratch copy of the working database (`roses_ux`, a `pg_dump` copy taken 2026-11-02 with its own copy of the uploads) served by a production build of 046a2ba (`next start`, the version the owner confirmed), never the working database or port 3000.

- **Public walk**, 32 runs: Senso and Kebab Land × English and Persian × four viewports × Chromium and WebKit (Playwright 1.63). Each run is the brief's path with a still at every step: welcome → language → browse (1.6 screens down) → Fall Menu → item popup → the popup scrolled to its end → closed → an item with sizes or choices (closed with Escape) → section list → the sixth section → footer with the tap-to-call links. Measured on the way: horizontal overflow, every visible tap target's size, text contrast (WCAG 2.x formula, text colour blended over the first opaque background, opacity included; text over photos or gradients is skipped and counted), the active tab, RTL placement of the controls.
- **Viewports**: iPhone SE at 375 × 548 (Safari's visible area with the bottom tab bar, as the touch drill measures it), iPhone 13 at 390 × 664, iPhone 17 Pro Max at 440 × 763 (the large iPhone), Galaxy S24 at 360 × 780 (the Android; 360 px is the narrowest common Android width). The engines are not the phones' own: WebKit stands in for Safari, Chromium for Chrome on Android.
- **Focus order**: keyboard Tab from the first load, through the welcome screen, a language chosen with Enter, 24 Tabs through the menu, an item opened with Enter and closed with Escape, the section list likewise; Chromium and WebKit, both venues, both languages.
- **Reduced motion**: WebKit with `prefers-reduced-motion: reduce`, stills of the welcome screen at 300 ms and 1.8 s, the menu after the tap, the popup 120 ms after the tap.
- **Bigger text**: iOS's *Larger Text* setting (Dynamic Type) does not reach web pages unless they opt in (`font: -apple-system-body`); these pages do not, so customers who need bigger text use Safari's *aA* page zoom, and Android's font size reaches Chrome as page zoom. Both reflow the page as if the screen were narrower, which is what was run: the iPhone 13 at 150 % (260 × 443 CSS px) and 200 % (195 × 332), both venues, both languages, both engines.
- **Slow network**: Chromium only (the throttling is a Chromium feature), Slow 4G exactly as the check suite applies it (562.5 ms latency, 1.47 Mbps down) with CPU 4×; stills from the first markup to 3 s after scrolling two screens.
- **Photo hosts down**: every request to a host other than our server aborted (the linked photos live on the venues' own sites and the ordering service's storage), WebKit.
- **404**: `/nope`, `/senso/nope`, `/admin/nope` signed out, a missing upload, `/kebab-land/`.
- **Admin as staff on a phone**: a throwaway staff PIN for Senso in the scratch copy; WebKit on the iPhone 13 and Chromium on the Galaxy S24: the sign-in link with a wrong PIN, the Menu tab, + Add item, the editor, Allergens & diet as staff, a photo, a price in place, the Shown/Hidden switch, letters typed as a price, an item added without a price and then shown, a search with no results, a price saved with no connection, the account menu.
- **Link previews**: the `<head>` of both pages read for what WhatsApp and iMessage use (title, description, Open Graph, icons); nothing is hosted, so no real preview could be fetched by those apps.

## Limits

- Playwright's WebKit is close to Safari but not Safari on an iPhone: no real touch scrolling, no browser toolbars, no iOS text rendering. Everything marked "verify on the phone" is in `docs/real-phone-test.md`.
- Contrast is computed from CSS colours, not from pixels: text over the photo fade or the welcome scene's artwork is not measured (the readability guard covers the welcome card's own colours).
- The stills are in `reports/ui-audit/shots/` on this laptop only (gitignored: they show the photos and the venues' phone numbers). The numbers are in `reports/ui-audit/data/`, phone digits masked.
