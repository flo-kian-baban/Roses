// Public menu kit (Kian, 2026-10-07): Uber Eats-style category tabs that follow the scroll, full-width item rows with a
// square photo (or, per section since 2026-10-08, a two-column grid of cards with bigger photos), and a tap-to-open item sheet.
// Display only: no cart, no ordering. No framework JavaScript on the public pages: one small inline script (menuScript)
// drives the tabs (by scroll position) and the native <dialog> sheets; everything else is HTML + CSS.
// Both venue templates compose these pieces with their own header, accent and footer. Colours are tokens (src/venues/tokens.ts)
// read through CSS variables: the Category tabs, Item rows and Item popup groups; no colour literal here.
import type { Item, Section } from '@/lib/types';
import { price } from '@/lib/format';
import { Bi } from './Bi';

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-|-$/g, '');
const sid = (s: Section) => slug(s.name.en ?? s.id);

const ListIcon = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>;
const CloseIcon = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>;

export function SectionTabs({ sections }: { sections: Section[] }) {
  return (
    <nav id="tabs" aria-label="Sections" className="sticky top-0 z-20">
      <div className="mx-auto flex max-w-2xl items-stretch border-b border-(--c-tabs-line)">
        <button type="button" id="tabs-list" className="flex shrink-0 items-center px-4 text-(--c-tabs-list)" aria-label="All sections"><ListIcon /></button>
        <ul className="no-scrollbar flex flex-1 overflow-x-auto">
          {sections.map((s) => <li key={s.id} className="shrink-0"><a href={`#${sid(s)}`} data-tab={sid(s)} className="tab"><Bi text={s.name} /></a></li>)}
        </ul>
      </div>
    </nav>
  );
}

function Serves({ item }: { item: Item }) {
  return item.serves ? <span className="chip"><span lang="en">Serves {item.serves}</span><span lang="fa" dir="rtl">برای {item.serves} نفر</span></span> : null;
}

function PriceLine({ item, big }: { item: Item; big?: boolean }) {
  const color = big ? 'text-(--c-sheet-price)' : 'text-(--c-rows-price)';
  if (item.price != null) return <p className={`${big ? 'mt-1 text-[20px] tabular-nums' : 'mt-1 text-[15px]'} ${color}`}><span className="shrink-0 tabular-nums">{price(item.price)}</span></p>;
  if (item.variants.length === 0) return null;
  return (
    <p className={`mt-1 ${big ? 'text-[17px]' : 'text-[15px]'} ${color}`}>
      {item.variants.map((v, n) => <span key={n}>{n > 0 && ' · '}<Bi text={v.label} /> {v.price != null && <span className="tabular-nums">{price(v.price)}</span>}</span>)}
    </p>
  );
}

// The sheet's content travels in an inert <template> next to the row or card, so the page carries each item once and
// images in the template never load until the sheet opens.
function Detail({ item }: { item: Item }) {
  const groups = new Map<string, Item['add_ons']>();
  for (const a of item.add_ons) { const k = a.group.en ?? ''; groups.set(k, [...(groups.get(k) ?? []), a]); }
  return (
    <template className="detail">
      <div className="px-5 pb-10 pt-5">
        <Bi as="h2" text={item.name} className="text-[26px] font-bold leading-tight text-(--c-sheet-title)" />
        <PriceLine item={item} big />
        {item.serves && <p className="mt-2"><Serves item={item} /></p>}
        <Bi as="p" text={item.description} className="mt-3 text-[16px] leading-relaxed text-(--c-sheet-body) whitespace-pre-line" />
        {item.variants.length > 0 && (
          <div className="mt-6">
            <h3 className="text-[17px] font-semibold text-(--c-sheet-title)"><span lang="en">Sizes</span><span lang="fa" dir="rtl">اندازه‌ها</span></h3>
            <ul className="mt-1 divide-y divide-(--c-sheet-line) text-(--c-sheet-price)">{item.variants.map((v, n) => <li key={n} className="flex items-center justify-between gap-3 py-3 text-[15px]"><Bi text={v.label} />{v.price != null && <span className="tabular-nums">{price(v.price)}</span>}</li>)}</ul>
          </div>
        )}
        {[...groups.entries()].map(([k, list]) => (
          <div key={k} className="mt-6">
            <h3 className="text-[17px] font-semibold text-(--c-sheet-title)">{list[0].group.en ? <Bi text={list[0].group} /> : <><span lang="en">Options</span><span lang="fa" dir="rtl">گزینه‌ها</span></>}</h3>
            <ul className="mt-1 divide-y divide-(--c-sheet-line) text-(--c-sheet-price)">{list.map((a, n) => <li key={n} className="flex items-center justify-between gap-3 py-3 text-[15px]"><Bi text={a.label} />{a.price > 0 && <span className="tabular-nums text-(--c-sheet-muted)">+{price(a.price)}</span>}</li>)}</ul>
          </div>
        ))}
        {item.components.length > 0 && (
          <div className="mt-6">
            <h3 className="text-[17px] font-semibold text-(--c-sheet-title)"><span lang="en">Includes</span><span lang="fa" dir="rtl">شامل</span></h3>
            <ul className="mt-1 divide-y divide-(--c-sheet-line) text-(--c-sheet-price)">{item.components.map((c, n) => <li key={n} className="py-3 text-[15px]">{c.qty > 1 && `${c.qty}× `}<Bi text={c.label} /></li>)}</ul>
          </div>
        )}
      </div>
    </template>
  );
}

// One row of the list layout: text on the left, a small square photo on the right. The whole row opens the sheet.
export function ItemRow({ item, eager, photos = true }: { item: Item; eager: boolean; photos?: boolean }) {
  return (
    <li className="item flex items-start justify-between gap-4 border-b border-(--c-rows-line) bg-(--c-rows-bg) py-4" tabIndex={0} role="button" aria-haspopup="dialog" data-id={item.id} data-photo={item.photo?.url ?? undefined}>
      <div className="min-w-0 flex-1">
        <Bi as="h3" text={item.name} className="text-[17px] font-semibold leading-snug text-(--c-rows-name)" />
        <PriceLine item={item} />
        <Bi as="p" text={item.description} className="mt-1 line-clamp-2 text-[14px] leading-snug text-(--c-rows-desc)" />
        {item.serves && <p className="mt-2"><Serves item={item} /></p>}
      </div>
      {photos && item.photo && (
        <img src={item.photo.url} alt={item.photo.alt?.en ?? ''} width={96} height={96} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined} decoding="async" className="h-24 w-24 shrink-0 rounded-lg bg-(--c-rows-photo) object-cover" style={{ aspectRatio: '1 / 1' }} />
      )}
      <Detail item={item} />
    </li>
  );
}

// One card of the grid layout (Kian, 2026-10-08; Uber Eats-style): a big square photo on top, then the name and the price
// only; the description shows in the sheet once the card is tapped (Kian, same day). An item without a photo keeps the
// photo's place as a placeholder so the two columns stay even. Same tokens as the rows, same sheet on tap.
export function ItemCard({ item, eager, photos = true }: { item: Item; eager: boolean; photos?: boolean }) {
  return (
    <li className="item card flex min-w-0 flex-col gap-2 bg-(--c-rows-bg)" tabIndex={0} role="button" aria-haspopup="dialog" data-id={item.id} data-photo={item.photo?.url ?? undefined}>
      {photos && (item.photo
        ? <img src={item.photo.url} alt={item.photo.alt?.en ?? ''} width={400} height={400} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined} decoding="async" className="aspect-square w-full rounded-xl bg-(--c-rows-photo) object-cover" />
        : <div className="aspect-square w-full rounded-xl bg-(--c-rows-photo)" aria-hidden="true" />)}
      <div className="min-w-0">
        <Bi as="h3" text={item.name} className="text-[15px] font-semibold leading-snug text-(--c-rows-name)" />
        <PriceLine item={item} />
        {item.serves && <p className="mt-2"><Serves item={item} /></p>}
      </div>
      <Detail item={item} />
    </li>
  );
}

// A section's items in the layout chosen for it in the admin: the list (rows) or the two-column grid (cards). `first`
// marks the first section of the page: its first row (or its first two cards, side by side) load their photo eagerly.
export function ItemList({ section: s, first, photos = true, className = '' }: { section: Section; first: boolean; photos?: boolean; className?: string }) {
  const grid = s.layout === 'grid';
  return (
    <ul className={`mt-3 ${grid ? 'grid grid-cols-2 gap-x-3 gap-y-5' : ''} ${className}`.trim()} data-layout={grid ? 'grid' : 'list'}>
      {s.items.map((i, n) => (grid ? <ItemCard key={i.id} item={i} eager={first && n < 2} photos={photos} /> : <ItemRow key={i.id} item={i} eager={first && n < 1} photos={photos} />))}
    </ul>
  );
}

// The two native dialogs (item sheet, section list) and the one inline script. Rendered after <main>.
export function MenuDialogs({ sections }: { sections: Section[] }) {
  return (
    <>
      <dialog id="sheet" className="sheet" aria-label="Item">
        <div className="sheet-top"><div id="sheet-hero" className="sheet-hero" /><button type="button" id="sheet-close" className="sheet-close" aria-label="Close"><CloseIcon /></button></div>
        <div id="sheet-content" tabIndex={-1} autoFocus />
      </dialog>
      <dialog id="sections-dialog" className="list" aria-label="Sections">
        <p className="px-5 pt-4 pb-2 text-[13px] font-semibold uppercase tracking-wide text-(--c-sheet-muted)"><span lang="en">Menu</span><span lang="fa" dir="rtl">منو</span></p>
        <ul tabIndex={-1} autoFocus>{sections.map((s) => <li key={s.id}><a href={`#${sid(s)}`} className="block px-5 py-3 text-[17px] font-semibold"><Bi text={s.name} /></a></li>)}</ul>
      </dialog>
      <script dangerouslySetInnerHTML={{ __html: menuScript }} />
    </>
  );
}

// Rows open the sheet (native <dialog>); Back closes it (history state). Tabs follow the scroll by position (Kian, 2026-10-08,
// replacing the IntersectionObserver band): the current section is the last one whose top has reached the bar's bottom edge,
// so the tie at a section boundary goes to the section that just arrived; at the end of a page that has scrolled it is the last
// section (a page too short to scroll keeps its first tab). A tap
// lights its tab at once and locks it while the page scrolls there (the tabs in between never light up); the lock lifts when the
// scroll settles (160 ms without a scroll event) or the customer takes over (touch, wheel, keys). The strip scrolls itself to
// centre the active tab; it never scrolls the page. A tap writes no #hash into the URL (Kian, 2026-10-08: a reload used to jump
// to the tapped section, hiding the header); a link straight to a section still opens on it.
const menuScript = `(function(){var sheet=document.getElementById('sheet'),hero=document.getElementById('sheet-hero'),content=document.getElementById('sheet-content');
if(sheet&&sheet.showModal){var open=function(li){var tpl=li.querySelector('template.detail');if(!tpl)return;content.replaceChildren(tpl.content.cloneNode(true));hero.replaceChildren();var p=li.getAttribute('data-photo');if(p){var img=document.createElement('img');img.src=p;img.alt='';img.decoding='async';hero.appendChild(img);hero.hidden=false}else{hero.hidden=true}sheet.showModal();sheet.scrollTop=0;history.pushState({sheet:1},'')};
document.querySelectorAll('li.item').forEach(function(li){li.addEventListener('click',function(){open(li)});li.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();open(li)}})});
document.getElementById('sheet-close').addEventListener('click',function(){sheet.close()});sheet.addEventListener('click',function(e){if(e.target===sheet)sheet.close()});
sheet.addEventListener('close',function(){if(history.state&&history.state.sheet)history.back()});window.addEventListener('popstate',function(){if(sheet.open)sheet.close()});
var list=document.getElementById('sections-dialog'),btn=document.getElementById('tabs-list');if(list&&btn&&list.showModal){btn.addEventListener('click',function(){list.showModal()});list.addEventListener('click',function(e){if(e.target===list||e.target.closest('a'))list.close()})}}
var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var nav=document.getElementById('tabs'),strip=nav&&nav.querySelector('ul'),tabs=[].slice.call(document.querySelectorAll('#tabs a[data-tab]')),byId={};tabs.forEach(function(a){byId[a.getAttribute('data-tab')]=a});
var secs=[].slice.call(document.querySelectorAll('main section[id]')),current=null,lock=null,lockTimer=null,queued=false;
var setActive=function(id,instant){if(current===id)return;current=id;tabs.forEach(function(a){a.classList.toggle('active',a.getAttribute('data-tab')===id)});var a=byId[id];if(a&&strip){var r=a.getBoundingClientRect(),s=strip.getBoundingClientRect(),d=r.left+r.width/2-(s.left+s.width/2);if(strip.scrollBy)strip.scrollBy({left:d,behavior:instant||reduced?'auto':'smooth'});else strip.scrollLeft+=d}};
var sectionAt=function(){var b=(nav?nav.getBoundingClientRect().bottom:0)+1,id=secs[0].id;for(var i=0;i<secs.length;i++)if(secs[i].getBoundingClientRect().top<=b)id=secs[i].id;if(window.scrollY>0&&window.scrollY+window.innerHeight>=document.documentElement.scrollHeight-1)id=secs[secs.length-1].id;return id};
var update=function(instant){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;if(lock===null&&secs.length)setActive(sectionAt(),instant)})};
var release=function(){clearTimeout(lockTimer);lockTimer=null;lock=null};var settle=function(){clearTimeout(lockTimer);lockTimer=setTimeout(release,160)};
window.addEventListener('scroll',function(){if(lock!==null)settle();else update()},{passive:true});window.addEventListener('resize',function(){update()});
['touchstart','wheel','keydown','pointerdown'].forEach(function(t){window.addEventListener(t,function(e){if(lock!==null&&!(nav&&nav.contains(e.target))){release();update()}},{passive:true})});
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href^="#"]');if(!a)return;var id=decodeURIComponent(a.getAttribute('href').slice(1)),t=document.getElementById(id);if(!t)return;e.preventDefault();if(byId[id]){lock=id;setActive(id);settle()}window.scrollTo({top:window.scrollY+t.getBoundingClientRect().top-(nav?nav.offsetHeight:0),behavior:reduced?'auto':'smooth'})});
if(secs.length)update(true)})();`;
