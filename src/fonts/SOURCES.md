# Bundled fonts

Bundled by `src/app/fonts.ts`: Vazirmatn 400/600, for Persian text. Latin text uses the system sans on every page.

Self-hosted; no runtime request leaves the app for fonts. Files copied from the npm packages on 2026-10-07.

| Family | Files | Licence | Source | Stands in for |
| --- | --- | --- | --- | --- |
| Vazirmatn 400, 600 | vazirmatn-arabic-{400,600}-normal.woff2 | SIL OFL 1.1 (LICENSE-vazirmatn.txt) | @fontsource/vazirmatn 5.3.0 (upstream Saber Rastikerdar) | Persian text; the client's sites have no Persian typeface |

Removed at the pre-go-live audit (the PM's fix batch, 2026-11-03, H-17): Tinos 400/700 and Montserrat 400/500/600 (stand-ins for Senso's
DUTCHI and Proxima Nova, from the font-matching work Kian cancelled on 2026-10-07). Their `@font-face` rules were on every page and no page
used them; they and their licence files are in git history if the redesign wants them back.
