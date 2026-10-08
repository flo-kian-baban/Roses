// Logo intro: in the first HTML response, removed by script within 1.5 s, played on every page load (Kian,
// 2026-10-07: on each refresh, not only the first visit) and skipped only under prefers-reduced-motion. The
// decision script runs in <head> before first paint (see VenueHead). Nothing about the intro is stored on the device.
// The overlay fades from 1000 to 1350 ms while the page slides in behind it (globals.css); the script hides it at 1350 ms.
// `tile` puts the logo on a coloured tile (a white-on-transparent logo on the white page, e.g. Kebab Land).
export function Intro({ logo, alt, tile }: { logo: { url: string; width: number; height: number } | null; alt: string; tile?: string }) {
  if (!logo) return null;
  const img = <img src={logo.url} width={logo.width} height={logo.height} alt={alt} decoding="async" fetchPriority="high" />;
  return (
    <div id="intro" aria-hidden="true">
      {tile ? <span className="intro-tile" style={{ background: tile }}>{img}</span> : img}
      <script dangerouslySetInnerHTML={{ __html: `(function(){var h=document.documentElement;if(h.dataset.intro==='skip')return;setTimeout(function(){h.dataset.intro='done'},1350);})();` }} />
    </div>
  );
}

// Runs before first paint: restores the saved language and skips the intro when the device has reduced motion on.
export function headScript(): string {
  return `(function(){var h=document.documentElement;try{var l=localStorage.getItem('roses-lang');if(l==='fa'){h.dataset.lang='fa';h.lang='fa';h.dir='rtl';}}catch(e){}if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)h.dataset.intro='skip';})();`;
}
