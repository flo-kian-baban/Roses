// Logo intro: in the first HTML response, removed by script within 1.5 s, skipped on repeat visits and
// under prefers-reduced-motion. The decision script runs in <head> before first paint (see VenueHead).
export function Intro({ venueId, logo, alt }: { venueId: string; logo: { url: string; width: number; height: number } | null; alt: string }) {
  if (!logo) return null;
  return (
    <div id="intro" aria-hidden="true">
      <img src={logo.url} width={logo.width} height={logo.height} alt={alt} decoding="async" fetchPriority="high" />
      <script dangerouslySetInnerHTML={{ __html: `(function(){var h=document.documentElement;if(h.dataset.intro==='skip')return;var done=function(){h.dataset.intro='done';try{localStorage.setItem('roses-intro-${venueId}','1')}catch(e){}};setTimeout(done,1300);})();` }} />
    </div>
  );
}

// Runs before first paint: restores the saved language and decides whether to skip the intro.
export function headScript(venueId: string): string {
  return `(function(){var h=document.documentElement;try{var l=localStorage.getItem('roses-lang');if(l==='fa'){h.dataset.lang='fa';h.lang='fa';h.dir='rtl';}}catch(e){}var skip=false;try{skip=!!localStorage.getItem('roses-intro-${venueId}')}catch(e){}if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)skip=true;if(skip)h.dataset.intro='skip';})();`;
}
