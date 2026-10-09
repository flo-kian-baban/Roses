// Welcome screen (Kian, 2026-10-09, replacing the logo intro): a full-screen overlay in the same static page, before the menu.
// The venue logo, a time-of-day greeting in both languages, two large language buttons and the season's scene. The menu is
// laid out behind it, so it opens the moment a language is tapped. Shown on every page load and refresh. Nothing but the chosen
// language (the same "roses-lang" key the header toggle writes) is stored on the device.
//
// The greeting is decided in the head script before first paint (headScript, placed in <head> by the page) by the device clock,
// which also switches the overlay on (html[data-welcome="show"]) and fills the button of the language chosen last time
// (data-lang-saved). With JavaScript off nothing sets those attributes and the menu shows directly. The season is not the
// device's: the page is rendered for the current season in America/Toronto and regenerated hourly (the PM's build decision,
// 2026-10-09, current season only: src/lib/welcome.ts seasonNow), so the HTML carries one scene, named on #welcome[data-season].
// The script inside the overlay handles the tap: it sets the language like the header toggle, stores it, fades the overlay out
// (data-welcome="done", then "off" once the 200 ms fade has ended, display none) and puts the page at the top (Kian, 2026-10-09).
// No framework JavaScript: inline script, CSS and inline SVG only (src/styles/public.css, the "Welcome screen" block).
//
// Scenes. Senso (Kian's picks of 2026-10-09, src/components/welcome-art.ts): the fall and winter scenes are the picked artwork
// with a per-load engine (engineScript): the HTML carries the symbols and an empty scene, and the inline script draws 20 particles
// (2 near, 9 middle, 9 far) with random designs, columns, sizes, timings, sway and flutter angles, started mid-flight by negative
// delays, so no two loads look alike; under reduced motion a still composition of designs resting. Every other scene (Kebab Land,
// the default template, Senso's spring and summer until their batch) is the engine of 2026-10-09, unchanged: particles generated
// at build time from a fixed seed, each an HTML element at (--x, --y) animated on transform and opacity only, symbols below.
// At most 20 particles per scene. Colours are the Welcome group's tokens (the artwork carries its own palette, src/venues/tokens.ts).
import type { CSSProperties, ReactNode } from 'react';
import type { Bi as BiText, Logo } from '@/lib/types';
import { GREETINGS, type Season } from '@/lib/welcome';
import { artScene } from './welcome-art';
import { Bi } from './Bi';
export { usesArtwork } from './welcome-art';

// Runs before first paint: restores the saved language (and marks it as the one to pre-highlight), and, when the welcome screen
// is on (`welcome`: the venue's Welcome switch), decides the greeting from the device clock, switches the overlay on and turns the
// browser's scroll restoration off so every load starts at the top behind it (Kian, 2026-10-08).
export function headScript(welcome = true): string {
  return `(function(){var h=document.documentElement,l=null;try{l=localStorage.getItem('roses-lang')}catch(e){}if(l==='fa'){h.dataset.lang='fa';h.lang='fa';h.dir='rtl';}if(l==='fa'||l==='en')h.dataset.langSaved=l;${welcome ? "var d=new Date(),t=d.getHours();h.dataset.greet=t>=5&&t<12?'morning':t>=12&&t<17?'afternoon':'evening';h.dataset.welcome='show';if('scrollRestoration' in history)history.scrollRestoration='manual';" : ''}})();`;
}

// The tap: the language like the header toggle (src/components/LangToggle.tsx), stored; the menu behind made reachable again
// (it is inert while the overlay is up); the fade (200 ms, none under reduced motion), then "off"; the page put at the top (Kian,
// 2026-10-09, later: after the choice the menu always starts from the top, even when the URL carries a section anchor, which the
// browser had scrolled to behind the overlay; the earlier rule that scrolled to the anchor after the choice is withdrawn).
const welcomeScript = `(function(){var h=document.documentElement,w=document.getElementById('welcome');if(!w||h.dataset.welcome!=='show')return;
var s=h.dataset.langSaved;if(s){var b=w.querySelector('button[data-lang="'+s+'"]');if(b)b.setAttribute('aria-pressed','true')}
var inert=function(v){var m=document.querySelector('main');if(m)m.inert=v};document.addEventListener('DOMContentLoaded',function(){if(h.dataset.welcome==='show')inert(true)});
var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var choose=function(n){h.dataset.lang=n;h.lang=n;h.dir=n==='fa'?'rtl':'ltr';try{localStorage.setItem('roses-lang',n)}catch(e){}inert(false);h.dataset.welcome='done';
var off=function(){if(h.dataset.welcome==='done')h.dataset.welcome='off'};if(reduced)off();else{w.addEventListener('transitionend',off,{once:true});setTimeout(off,320)}
window.scrollTo(0,0)};
w.querySelectorAll('button[data-lang]').forEach(function(b){b.addEventListener('click',function(){choose(b.getAttribute('data-lang'))})})})();`;

// The artwork engine (Senso; the scene element names its kind, leaves or snow, and the picked designs). Three depth layers, each
// [count, size min, size max (× the base size), fall duration min, max (s), opacity min, max, sway width min, max (px), sway period
// min, max (s), drift (± fraction of the width), flutter or turn period min, max (s)]: far small, slow and faint; middle; near
// larger and a little faster, at most 2. Every particle: a column (--x), a size, a fall (--d, started --l earlier so the scene is
// full and mid-flight on the first frame), a pendulum sway (--sw, --sp, dipping --dip through the centre), a drift (--dr) and, for
// leaves, a 3D flutter (--rx/--ry/--rz over --fp); snow turns slowly instead (W10 not at all). Reduced motion: a still composition
// of designs resting (leaves low and along the sides, snow scattered), placed by --y and --rs. The stylesheet does the rest
// (the "Artwork engine" rules in src/styles/public.css). Nothing is stored; Math.random draws a new scene on every load.
export const engineScript = `(function(){var w=document.getElementById('welcome'),s=w&&w.querySelector('.scene[data-engine]');if(!s||!s.getAttribute('data-designs'))return;
var snow=s.getAttribute('data-engine')==='snow',D=s.getAttribute('data-designs').split(','),soft=['W8','W9','W10'];
var L=snow?{b:26,far:[9,.45,.65,14,20,.4,.6,4,8,3.5,6,.06,30,48],mid:[9,.7,.95,10,14,.7,.9,6,12,3,5,.1,24,40],near:[2,1,1.3,8,11,.85,1,8,16,2.8,4.4,.14,20,32]}:{b:44,far:[9,.42,.6,15,22,.35,.55,6,12,3.4,5.2,.1,3.6,5.5],mid:[9,.65,.9,10,15,.7,.9,12,22,2.8,4.2,.16,2.8,4.4],near:[2,1,1.3,7.5,10.5,.85,.95,20,34,2.4,3.6,.22,2.2,3.6]};
var R=function(a,b){return a+Math.random()*(b-a)},r1=function(n){return Math.round(n*10)/10},h='';
var one=function(l,x,y){var c=L[l],d=D[Math.floor(Math.random()*D.length)],sf=soft.indexOf(d)>=0,sz=Math.round(L.b*R(c[1],c[2])*(sf?1.4:1)),du=r1(R(c[3],c[4]));
h+='<i class="p '+l+(sf?' soft':'')+'" style="--x:'+r1(x*100)+'vw;--s:'+sz+'px;--d:'+du+'s;--l:'+r1(-R(.5,du))+'s;--o:'+Math.round(R(c[5],c[6])*100)/100+';--sw:'+Math.round(R(c[7],c[8]))+'px;--sp:'+r1(R(c[9],c[10]))+'s;--dr:'+r1(R(-c[11],c[11])*100)+'vw;--rx:'+Math.round(R(25,60))+'deg;--ry:'+Math.round(R(30,70))+'deg;--rz:'+Math.round(R(15,45))+'deg;--fp:'+r1(R(c[12],c[13]))+'s;--dip:'+(snow?0:Math.round(R(4,10)))+'px'+(y==null?'':';--y:'+r1(y*100)+'vh;--rs:'+Math.round(R(-60,60))+'deg')+'"><b class="y"><b class="s"><svg class="w" viewBox="0 0 64 64" focusable="false"><use href="#'+d+'"/></svg></b></b></i>'};
if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches){s.className+=' still';var P=snow?[[.1,.08],[.5,.05],[.85,.12],[.25,.25],[.7,.3],[.08,.45],[.92,.5],[.3,.7],[.6,.78],[.15,.9],[.8,.92],[.45,.95]]:[[.08,.86],[.22,.93],[.38,.9],[.56,.95],[.72,.88],[.9,.92],[.05,.3],[.94,.55],[.9,.12],[.12,.6]];for(var i=0;i<P.length;i++)one(i<2?'near':i<6?'mid':'far',P[i][0]+R(-.03,.03),P[i][1]+R(-.03,.03))}
else{for(var k in L)if(k!=='b')for(var j=0;j<L[k][0];j++)one(k,R(.02,.98))}
s.innerHTML=h})();`;

// `tile`: the logo on the venue's tile (the Header group's token), for a white-on-transparent logo on a light welcome background;
// the page passes it only when the welcome background is light (on a dark one the logo sits straight on it, so nothing cuts the scene).
// `season`: the one the page was rendered for; `art`: the venue uses the picked artwork (Senso only until Kian confirms it).
export function Welcome({ logo, name, tile, season, art = false }: { logo: Logo | null; name: BiText; tile?: boolean; season: Season; art?: boolean }) {
  const alt = name.en ?? '';
  const img = logo && <img src={logo.url} width={logo.width} height={logo.height} alt={alt} decoding="async" fetchPriority="high" className={tile ? undefined : 'welcome-logo'} />;
  const engine = !!artScene(season, art);
  return (
    <div id="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-greet" data-season={season}>
      <Scene season={season} art={art} />
      {/* The engine runs right after the scene, before the card is parsed: the particles are in the DOM before anything of the overlay is painted (negative delays start them mid-flight). */}
      {engine && <script dangerouslySetInnerHTML={{ __html: engineScript }} />}
      <div className="welcome-card">
        {logo ? (tile ? <span className="welcome-tile">{img}</span> : img) : <Bi as="p" text={name} className="welcome-name" />}
        {/* All three greetings are in the HTML, in both languages; CSS shows the one html[data-greet] names. */}
        <p id="welcome-greet" className="welcome-greet">
          {GREETINGS.map((g) => <span key={g.slot} className="g" data-g={g.slot}><span lang="en">{g.en}</span><span lang="fa" dir="rtl">{g.fa}</span></span>)}
        </p>
        <div className="welcome-buttons">
          <button type="button" data-lang="en" lang="en">English</button>
          <button type="button" data-lang="fa" lang="fa" dir="rtl">فارسی</button>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: welcomeScript }} />
    </div>
  );
}

// ---- the scenes ----
type Particle = { sym: string; size: number; style: CSSProperties };
// mulberry32: a tiny deterministic generator, so every build renders the same scatter.
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r1 = (n: number) => Math.round(n * 10) / 10;
const vars = (o: Record<string, string | number>) => o as CSSProperties;
type Spec = { n: number; syms: { id: string; size: [number, number] }[]; d: [number, number]; w: [number, number]; rot: [number, number]; sx: number; o: [number, number] };
// Falling scenes: n particles, the symbols in turn with their size range in px, fall duration d (s), sway period w (s), flutter
// angle rot (deg), horizontal drift over a fall ±sx (vw), opacity o. Snow falls slower and barely turns; blossoms tumble more than they sway.
const FALLING: Record<Exclude<Season, 'summer'>, Spec> = {
  fall: { n: 18, syms: [{ id: 'wl1', size: [24, 38] }, { id: 'wl2', size: [18, 30] }, { id: 'wl1', size: [20, 32] }, { id: 'wl3', size: [16, 26] }], d: [7, 13], w: [2.2, 3.6], rot: [25, 70], sx: 12, o: [0.55, 0.95] },
  winter: { n: 20, syms: [{ id: 'ws1', size: [14, 26] }, { id: 'ws2', size: [5, 12] }, { id: 'ws2', size: [5, 12] }], d: [9, 16], w: [3, 5], rot: [10, 40], sx: 8, o: [0.5, 0.95] },
  spring: { n: 16, syms: [{ id: 'wp1', size: [12, 22] }, { id: 'wp1', size: [12, 22] }, { id: 'wp2', size: [18, 28] }], d: [8, 14], w: [2.2, 3.4], rot: [30, 90], sx: 10, o: [0.55, 0.9] },
};
function particles(season: Season): Particle[] {
  const r = rng({ fall: 7, winter: 11, spring: 13, summer: 17 }[season]);
  const between = (lo: number, hi: number) => lo + (hi - lo) * r();
  const out: Particle[] = [];
  const add = (sym: string, size: number, o: number, extra: Record<string, string | number>) => out.push({ sym, size, style: vars({ '--x': `${r1(between(2, 94))}vw`, '--y': `${r1(between(0, 100))}vh`, '--o': Math.round(o * 100) / 100, ...extra }) });
  if (season === 'summer') {
    // the sun's halo high in the middle, nine soft orbs of light drifting slowly, six sparks
    out.push({ sym: 'wg', size: 320, style: vars({ '--x': 'calc(50vw - 160px)', '--y': '-150px', '--o': 0.7, '--d': '9s', '--l': '-2s', '--w': '5s', '--sx': '0px' }) });
    for (let i = 0; i < 9; i++) add('wg', Math.round(between(90, 220)), between(0.3, 0.55), { '--d': `${r1(between(6, 11))}s`, '--l': `${r1(-between(0, 8))}s`, '--w': `${r1(between(3, 6))}s`, '--sx': `${r1(between(-8, 8))}vw` });
    for (let i = 0; i < 6; i++) add('wk', Math.round(between(4, 9)), between(0.5, 0.9), { '--d': `${r1(between(4, 8))}s`, '--l': `${r1(-between(0, 6))}s`, '--w': `${r1(between(1.6, 3))}s`, '--sx': `${r1(between(-3, 3))}vw` });
    return out;
  }
  const S = FALLING[season];
  for (let i = 0; i < S.n; i++) {
    const d = between(S.d[0], S.d[1]), sym = S.syms[i % S.syms.length];
    add(sym.id, Math.round(between(sym.size[0], sym.size[1])), between(S.o[0], S.o[1]), { '--d': `${r1(d)}s`, '--l': `${r1(-between(0, d))}s`, '--w': `${r1(between(S.w[0], S.w[1]))}s`, '--r': `${Math.round(between(S.rot[0], S.rot[1]))}deg`, '--sx': `${r1(between(-S.sx, S.sx))}vw` });
  }
  return out;
}

// The symbols of the scenes of 2026-10-09 (original artwork, 24 × 24): three leaves (a maple, an oval leaf and a round one, each
// with a vein in the background colour), a six-armed snowflake and a soft dot, a petal and a five-petal blossom, a radial glow and
// a spark; each season's set is rendered on its own now that a page carries one scene. Styling inside a symbol: a stylesheet class
// never reaches the content a <use> clones (Chromium), so strokes and fills are presentation attributes; `currentColor` inherits
// from the particle (the scene's colour), and a part drawn in the background colour carries that colour as an inline `color`
// (custom properties inherit into the clone). The glow's gradient reads its colour from its own `color` (#wgrad in the stylesheet).
const VEIN: CSSProperties = { color: 'var(--c-welcome-bg)' };
const SYMBOLS: Record<Season, ReactNode> = {
  fall: <>
    <symbol id="wl1" viewBox="0 0 24 24"><path d="M12 1c.6 2.6 1.6 4.6 2.8 6.2 2-1.4 4.5-1.8 7.2-1.2-1.8 1.9-3.5 3.6-5.2 5.6 2.1 1.1 3 3 2.8 5.2-2.3-1.1-4.4-1.4-6.4-1.2L12.6 23h-1.2l-.6-7.4c-2-.2-4.1.1-6.4 1.2-.2-2.2.7-4.1 2.8-5.2C5.5 9.6 3.8 7.9 2 6c2.7-.6 5.2-.2 7.2 1.2C10.4 5.6 11.4 3.6 12 1z" /><path style={VEIN} fill="none" stroke="currentColor" strokeOpacity=".6" strokeWidth="1.3" strokeLinecap="round" d="M12 15.5V3.5m0 8L5.5 8m6.5 3.5L18.5 8M12 14.5 7 15.5m5-1 5 1" /></symbol>
    <symbol id="wl2" viewBox="0 0 24 24"><path d="M12 1.5C5.5 6 4 12.5 6.5 18c1.8 3.5 4.5 4.5 5.5 4.5s3.7-1 5.5-4.5C20 12.5 18.5 6 12 1.5z" /><path style={VEIN} fill="none" stroke="currentColor" strokeOpacity=".6" strokeWidth="1.3" strokeLinecap="round" d="M12 4.5v16M12 9l3 2.5M12 9 9 11.5m3 4 3 2.5m-3-2.5-3 2.5" /></symbol>
    <symbol id="wl3" viewBox="0 0 24 24"><path d="M12 2.5c5.5 0 9 4 9 9s-4 9.5-9 10.5C7 21 3 16.5 3 11.5s3.5-9 9-9z" /><path style={VEIN} fill="none" stroke="currentColor" strokeOpacity=".6" strokeWidth="1.3" strokeLinecap="round" d="M12 5v15.5M12 10l3.5-2M12 10 8.5 8m3.5 6 3.5 2m-3.5-2L8.5 16" /></symbol>
  </>,
  winter: <>
    <symbol id="ws1" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7" /><path d="M12 5.5 9.8 7.7M12 5.5l2.2 2.2M12 18.5l-2.2-2.2m2.2 2.2 2.2-2.2M5.2 9.5l3 .8m-3-.8.8-3m12.8 10.5-3-.8m3 .8-.8 3M5.2 14.5l3-.8m-3 .8.8 3m12.8-10.5-3 .8m3-.8-.8-3" /></g></symbol>
    <symbol id="ws2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" /></symbol>
  </>,
  spring: <>
    <symbol id="wp1" viewBox="0 0 24 24"><path d="M12 2c4.5 4.5 7 8.5 7 12.5a7 7 0 0 1-14 0C5 10.5 7.5 6.5 12 2z" /></symbol>
    <symbol id="wp2" viewBox="0 0 24 24"><ellipse cx="12" cy="6.5" rx="3.2" ry="5.2" /><ellipse cx="12" cy="6.5" rx="3.2" ry="5.2" transform="rotate(72 12 12)" /><ellipse cx="12" cy="6.5" rx="3.2" ry="5.2" transform="rotate(144 12 12)" /><ellipse cx="12" cy="6.5" rx="3.2" ry="5.2" transform="rotate(216 12 12)" /><ellipse cx="12" cy="6.5" rx="3.2" ry="5.2" transform="rotate(288 12 12)" /><circle style={VEIN} fill="currentColor" fillOpacity=".6" cx="12" cy="12" r="2.2" /></symbol>
  </>,
  summer: <>
    <radialGradient id="wgrad"><stop offset="0" stopColor="currentColor" stopOpacity=".55" /><stop offset=".5" stopColor="currentColor" stopOpacity=".2" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></radialGradient>
    <symbol id="wg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="url(#wgrad)" /></symbol>
    <symbol id="wk" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></symbol>
  </>,
};
// One season's scene: the artwork's symbols and an empty scene for the engine to fill, or the 2026-10-09 scene with its particles.
// Also rendered by the admin API for the preview's season switch (src/pages/api/admin/welcome-scene.ts).
export function Scene({ season, art }: { season: Season; art: boolean }) {
  const a = artScene(season, art);
  return (
    <div className="welcome-scene" aria-hidden="true">
      <svg width="0" height="0" style={{ position: 'absolute' }} focusable="false">
        {a ? <defs dangerouslySetInnerHTML={{ __html: a.defs }} /> : <defs>{SYMBOLS[season]}</defs>}
      </svg>
      {a
        ? <div className={`scene scene-${season}`} data-scene={season} data-engine={a.kind} data-designs={a.designs.join(',')} />
        : <div className={`scene scene-${season}`} data-scene={season}>{particles(season).map((p, i) => <i key={i} className="p" style={p.style}><b className="y"><svg className="w" width={p.size} height={p.size} viewBox="0 0 24 24" focusable="false"><use href={`#${p.sym}`} /></svg></b></i>)}</div>}
    </div>
  );
}
