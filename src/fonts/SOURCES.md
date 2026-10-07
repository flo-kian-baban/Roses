# Bundled fonts

Bundled by `src/app/fonts.ts`: Tinos 700, Montserrat 400/500, Vazirmatn 400/600. Tinos 400 and Montserrat 600 are kept only for `scripts/font-comparison.mjs`.

Self-hosted; no runtime request leaves the app for fonts. Files copied from the npm packages on 2026-10-07.

| Family | Files | Licence | Source | Stands in for |
| --- | --- | --- | --- | --- |
| Tinos 400, 700 | tinos-latin-{400,700}-normal.woff2 | SIL OFL 1.1 (LICENSE-tinos.txt, the file shipped with the font) | @fontsource/tinos 5.3.0 (upstream Google Fonts, Steve Matteson) | Senso heading font DUTCHI (a Times-style serif) |
| Montserrat 400, 500, 600 | montserrat-latin-{400,500,600}-normal.woff2 | SIL OFL 1.1 (LICENSE-montserrat.txt) | @fontsource/montserrat 5.3.0 (upstream Google Fonts, Julieta Ulanovsky) | Senso body font Proxima Nova (commercial, not copied) |
| Vazirmatn 400, 600 | vazirmatn-arabic-{400,600}-normal.woff2 | SIL OFL 1.1 (LICENSE-vazirmatn.txt) | @fontsource/vazirmatn 5.3.0 (upstream Saber Rastikerdar) | Persian text; the client's sites have no Persian typeface |
