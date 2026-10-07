// Logo intro: in the first HTML response, removed by script within 1.5 s, skipped on repeat visits and
// under prefers-reduced-motion. The decision script runs in <head> before first paint (see VenueHead).
// `tile` puts the logo on a coloured tile (a white-on-transparent logo on the white page, e.g. Kebab Land).
export function Intro({ venueId, logo, alt, tile }: { venueId: string; logo: { url: string; width: number; height: number } | null; alt: string; tile?: string }) {
  if (!logo) return null;
  const img = <img src={logo.url} width={logo.width} height={logo.height} alt={alt} decoding="async" fetchPriority="high" />;
  return (
    <div id="intro" aria-hidden="true">
      {tile ? <span className="intro-tile" style={{ background: tile }}>{img}</span> : img}
      <script dangerouslySetInnerHTML={{ __html: `(function(){var h=document.documentElement;if(h.dataset.intro==='skip')return;var done=function(){h.dataset.intro='done';try{localStorage.setItem('roses-intro-${venueId}','1')}catch(e){}};setTimeout(done,1300);})();` }} />
    </div>
  );
}

// Runs before first paint: restores the saved language and decides whether to skip the intro.
export function headScript(venueId: string): string {
  return `(function(){var h=document.documentElement;try{var l=localStorage.getItem('roses-lang');if(l==='fa'){h.dataset.lang='fa';h.lang='fa';h.dir='rtl';}}catch(e){}var skip=false;try{skip=!!localStorage.getItem('roses-intro-${venueId}')}catch(e){}if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)skip=true;if(skip)h.dataset.intro='skip';})();`;
}
