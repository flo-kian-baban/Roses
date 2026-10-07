import localFont from 'next/font/local';

// Self-hosted with next/font/local: files are bundled at build time, preloaded where they matter for
// the first paint, served from this app's own origin. See src/fonts/SOURCES.md for licences.
export const tinos = localFont({
  src: [
    { path: '../fonts/tinos-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap', variable: '--font-tinos', preload: true, fallback: ['Times New Roman', 'serif'],
});

export const montserrat = localFont({
  src: [
    { path: '../fonts/montserrat-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/montserrat-latin-500-normal.woff2', weight: '500', style: 'normal' },
  ],
  display: 'swap', variable: '--font-montserrat', preload: true, fallback: ['system-ui', 'sans-serif'],
});

export const vazirmatn = localFont({
  src: [
    { path: '../fonts/vazirmatn-arabic-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/vazirmatn-arabic-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap', variable: '--font-vazirmatn', preload: false, fallback: ['system-ui', 'sans-serif'],
});
