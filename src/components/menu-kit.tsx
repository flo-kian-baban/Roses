// Public menu kit (Kian, 2026-10-07): Uber Eats-style category tabs that follow the scroll, full-width item rows with a
// square photo, and a tap-to-open item sheet. Display only: no cart, no ordering. No framework JavaScript on the public
// pages: one small inline script (menuScript) drives the tabs and the native <dialog> sheets; everything else is HTML + CSS.
// Both venue templates compose these pieces with their own header, accent and footer.
import type { Item, Section } from '@/lib/types';
import { price } from '@/lib/format';
import { Bi } from './Bi';

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-|-$/g, '');
const sid = (s: Section) => slug(s.name.en ?? s.id);

const ListIcon = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>;
const CloseIcon = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>;

export function SectionTabs({ sections }: { sections: Section[] }) {
  return (
    <nav id="tabs" aria-label="Sections" className="sticky top-0 z-20 bg-white">
      <div className="mx-auto flex max-w-2xl items-stretch border-b border-black/10">
        <button type="button" id="tabs-list" className="flex shrink-0 items-center px-4 text-black" aria-label="All sections"><ListIcon /></button>
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
  if (item.price != null) return <p className={big ? 'mt-1 text-[20px] tabular-nums' : 'mt-1 text-[15px]'}><span className="shrink-0 tabular-nums">{price(item.price)}</span></p>;
  if (item.variants.length === 0) return null;
  return (
    <p className={`mt-1 ${big ? 'text-[17px]' : 'text-[15px]'}`}>
      {item.variants.map((v, n) => <span key={n}>{n > 0 && ' · '}<Bi text={v.label} /> {v.price != null && <span className="tabular-nums">{price(v.price)}</span>}</span>)}
    </p>
  );
}

// One row of the list. The whole row opens the sheet; the sheet's content travels in an inert <template> next to it,
// so the page carries each item once and images in the template never load until the sheet opens.
export function ItemRow({ item, eager, photos = true }: { item: Item; eager: boolean; photos?: boolean }) {
  const groups = new Map<string, Item['add_ons']>();
  for (const a of item.add_ons) { const k = a.group.en ?? ''; groups.set(k, [...(groups.get(k) ?? []), a]); }
  return (
    <li className="item flex items-start justify-between gap-4 border-b border-black/10 py-4" tabIndex={0} role="button" aria-haspopup="dialog" data-id={item.id} data-photo={item.photo?.url ?? undefined}>
      <div className="min-w-0 flex-1">
        <Bi as="h3" text={item.name} className="text-[17px] font-semibold leading-snug" />
        <PriceLine item={item} />
        <Bi as="p" text={item.description} className="mt-1 line-clamp-2 text-[14px] leading-snug text-[#6b6b6b]" />
        {item.serves && <p className="mt-2"><Serves item={item} /></p>}
      </div>
      {photos && item.photo && (
        <img src={item.photo.url} alt={item.photo.alt?.en ?? ''} width={96} height={96} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined} decoding="async" className="h-24 w-24 shrink-0 rounded-lg bg-[#f3f3f3] object-cover" style={{ aspectRatio: '1 / 1' }} />
      )}
      <template className="detail">
        <div className="px-5 pb-10 pt-5">
          <Bi as="h2" text={item.name} className="text-[26px] font-bold leading-tight" />
          <PriceLine item={item} big />
          {item.serves && <p className="mt-2"><Serves item={item} /></p>}
          <Bi as="p" text={item.description} className="mt-3 text-[16px] leading-relaxed text-[#545454] whitespace-pre-line" />
          {item.variants.length > 0 && (
            <div className="mt-6">
              <h3 className="text-[17px] font-semibold"><span lang="en">Sizes</span><span lang="fa" dir="rtl">اندازه‌ها</span></h3>
              <ul className="mt-1 divide-y divide-black/10">{item.variants.map((v, n) => <li key={n} className="flex items-center justify-between gap-3 py-3 text-[15px]"><Bi text={v.label} />{v.price != null && <span className="tabular-nums">{price(v.price)}</span>}</li>)}</ul>
            </div>
          )}
          {[...groups.entries()].map(([k, list]) => (
            <div key={k} className="mt-6">
              <h3 className="text-[17px] font-semibold">{list[0].group.en ? <Bi text={list[0].group} /> : <><span lang="en">Options</span><span lang="fa" dir="rtl">گزینه‌ها</span></>}</h3>
              <ul className="mt-1 divide-y divide-black/10">{list.map((a, n) => <li key={n} className="flex items-center justify-between gap-3 py-3 text-[15px]"><Bi text={a.label} />{a.price > 0 && <span className="tabular-nums text-[#6b6b6b]">+{price(a.price)}</span>}</li>)}</ul>
            </div>
          ))}
          {item.components.length > 0 && (
            <div className="mt-6">
              <h3 className="text-[17px] font-semibold"><span lang="en">Includes</span><span lang="fa" dir="rtl">شامل</span></h3>
              <ul className="mt-1 divide-y divide-black/10">{item.components.map((c, n) => <li key={n} className="py-3 text-[15px]">{c.qty > 1 && `${c.qty}× `}<Bi text={c.label} /></li>)}</ul>
            </div>
          )}
        </div>
      </template>
    </li>
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
        <p className="px-5 pt-4 pb-2 text-[13px] font-semibold uppercase tracking-wide text-[#6b6b6b]"><span lang="en">Menu</span><span lang="fa" dir="rtl">منو</span></p>
        <ul tabIndex={-1} autoFocus>{sections.map((s) => <li key={s.id}><a href={`#${sid(s)}`} className="block px-5 py-3 text-[17px] font-semibold"><Bi text={s.name} /></a></li>)}</ul>
      </dialog>
      <script dangerouslySetInnerHTML={{ __html: menuScript }} />
    </>
  );
}

// Tabs follow the scroll (IntersectionObserver); rows open the sheet (native <dialog>); Back closes it (history state).
const menuScript = `(function(){var sheet=document.getElementById('sheet'),hero=document.getElementById('sheet-hero'),content=document.getElementById('sheet-content');
if(sheet&&sheet.showModal){var open=function(li){var tpl=li.querySelector('template.detail');if(!tpl)return;content.replaceChildren(tpl.content.cloneNode(true));hero.replaceChildren();var p=li.getAttribute('data-photo');if(p){var img=document.createElement('img');img.src=p;img.alt='';img.decoding='async';hero.appendChild(img);hero.hidden=false}else{hero.hidden=true}sheet.showModal();sheet.scrollTop=0;history.pushState({sheet:1},'')};
document.querySelectorAll('li.item').forEach(function(li){li.addEventListener('click',function(){open(li)});li.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();open(li)}})});
document.getElementById('sheet-close').addEventListener('click',function(){sheet.close()});sheet.addEventListener('click',function(e){if(e.target===sheet)sheet.close()});
sheet.addEventListener('close',function(){if(history.state&&history.state.sheet)history.back()});window.addEventListener('popstate',function(){if(sheet.open)sheet.close()});
var list=document.getElementById('sections-dialog'),btn=document.getElementById('tabs-list');if(list&&btn&&list.showModal){btn.addEventListener('click',function(){list.showModal()});list.addEventListener('click',function(e){if(e.target===list||e.target.closest('a'))list.close()})}}
var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href^="#"]');if(!a)return;var t=document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));if(!t)return;e.preventDefault();t.scrollIntoView({behavior:reduced?'auto':'smooth',block:'start'});history.replaceState(null,'',a.getAttribute('href'))});
var tabs=[].slice.call(document.querySelectorAll('#tabs a[data-tab]')),byId={};tabs.forEach(function(a){byId[a.getAttribute('data-tab')]=a});var current=null;
var setActive=function(id){if(current===id)return;current=id;tabs.forEach(function(a){a.classList.toggle('active',a.getAttribute('data-tab')===id)});var a=byId[id];if(a&&a.scrollIntoView)a.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'})};
var secs=[].slice.call(document.querySelectorAll('main section[id]'));if(secs.length){setActive(secs[0].id);if('IntersectionObserver' in window){var vis={};var io=new IntersectionObserver(function(entries){entries.forEach(function(en){vis[en.target.id]=en.isIntersecting});for(var i=0;i<secs.length;i++){if(vis[secs[i].id]){setActive(secs[i].id);break}}},{rootMargin:'-56px 0px -65% 0px',threshold:0});secs.forEach(function(s){io.observe(s)})}}})();`;
