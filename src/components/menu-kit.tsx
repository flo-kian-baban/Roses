// Public menu kit (Kian, 2026-10-07): Uber Eats-style category tabs that follow the scroll, full-width item rows with a
// square photo (or, per section since 2026-10-08, a two-column grid of cards with bigger photos), and a tap-to-open item sheet.
// Display only: no cart, no ordering. No framework JavaScript on the public pages: one small inline script (menuScript)
// drives the tabs (by scroll position) and the native <dialog> sheets; everything else is HTML + CSS.
// Both venue templates compose these pieces with their own header, accent and footer. Colours are tokens (src/venues/tokens.ts)
// read through CSS variables: the Category tabs, Item rows and Item popup groups; no colour literal here.
import type { ReactNode } from 'react';
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

function PriceLine({ item }: { item: Item }) {
  if (item.price != null) return <p className="mt-1 text-[15px] text-(--c-rows-price)"><span className="shrink-0 tabular-nums">{price(item.price)}</span></p>;
  if (item.variants.length === 0) return null;
  return (
    <p className="mt-1 text-[15px] text-(--c-rows-price)">
      {item.variants.map((v, n) => <span key={n}>{n > 0 && ' · '}<Bi text={v.label} /> {v.price != null && <span className="tabular-nums">{price(v.price)}</span>}</span>)}
    </p>
  );
}

// The popup's price: the item's price, or the span of its sizes ("$7 – $120"; one figure when they agree), so the Sizes
// group below is not repeated at the top. Amounts are rendered in an isolated left-to-right <bdi> so "$15 – $30" and "+$4"
// keep their order in Persian too (Western digits in both languages).
function priceSpan(item: Item): string | null {
  if (item.price != null) return price(item.price);
  const ps = item.variants.map((v) => v.price).filter((p): p is number => p != null);
  if (!ps.length) return null;
  const lo = Math.min(...ps), hi = Math.max(...ps);
  return lo === hi ? price(lo) : `${price(lo)} – ${price(hi)}`;
}
const Amount = ({ children, extra }: { children: ReactNode; extra?: boolean }) => <bdi dir="ltr" className={extra ? 'amount extra' : 'amount'}>{children}</bdi>;

// One group of the popup (Uber Eats-style): a full-width band with the heading and a small line under it, then its rows.
function Group({ title, sub, children, ...rest }: { title: ReactNode; sub?: ReactNode; children: ReactNode; 'data-notes'?: string }) {
  return (
    <section className="sheet-group" {...rest}>
      <div className="sheet-band"><h3>{title}</h3>{sub && <p>{sub}</p>}</div>
      {children}
    </section>
  );
}

// The sheet's content travels in an inert <template> next to the row or card, so the page carries each item once and
// images in the template never load until the sheet opens. Layout (Kian, 2026-10-08, after the Uber Eats reference): the
// title block (name, the price line with "Serves", the description), then one banded group per kind: Sizes, each option
// group (Required / Optional), Includes, and the owner's notes under Good to know. Styles: .sheet-* in src/styles/public.css.
function Detail({ item }: { item: Item }) {
  const groups = new Map<string, Item['add_ons']>();
  for (const a of item.add_ons) { const k = a.group.en ?? ''; groups.set(k, [...(groups.get(k) ?? []), a]); }
  const span = priceSpan(item);
  return (
    <template className="detail">
      <div className="sheet-body">
        <div className="sheet-head">
          <Bi as="h2" text={item.name} className="sheet-title" />
          {(span || item.serves) && (
            <p className="sheet-price">
              {span && <bdi dir="ltr">{span}</bdi>}
              {item.serves && <span className="sheet-serves">{span && <span aria-hidden="true"> · </span>}<span lang="en">Serves {item.serves}</span><span lang="fa" dir="rtl">برای {item.serves} نفر</span></span>}
            </p>
          )}
          <Bi as="p" text={item.description} className="sheet-desc" />
        </div>
        {item.variants.length > 0 && (
          <Group title={<><span lang="en">Sizes</span><span lang="fa" dir="rtl">اندازه‌ها</span></>}>
            <ul className="sheet-rows">{item.variants.map((v, n) => <li key={n}><Bi text={v.label} />{v.price != null && <Amount>{price(v.price)}</Amount>}</li>)}</ul>
          </Group>
        )}
        {[...groups.entries()].map(([k, list]) => (
          <Group key={k} title={list[0].group.en ? <Bi text={list[0].group} /> : <><span lang="en">Options</span><span lang="fa" dir="rtl">گزینه‌ها</span></>} sub={list.every((a) => a.required) ? <><span lang="en">Required</span><span lang="fa" dir="rtl">الزامی</span></> : <><span lang="en">Optional</span><span lang="fa" dir="rtl">اختیاری</span></>}>
            <ul className="sheet-rows">{list.map((a, n) => <li key={n}><Bi text={a.label} />{a.price > 0 && <Amount extra>+{price(a.price)}</Amount>}</li>)}</ul>
          </Group>
        ))}
        {item.components.length > 0 && (
          <Group title={<><span lang="en">Includes</span><span lang="fa" dir="rtl">شامل</span></>}>
            <ul className="sheet-rows">{item.components.map((c, n) => <li key={n}><span>{c.qty > 1 && `${c.qty}× `}<Bi text={c.label} /></span></li>)}</ul>
          </Group>
        )}
        <GoodToKnow item={item} />
      </div>
    </template>
  );
}

// The owner's allergen, dietary and halal notes (ruling 10: optional per item, set by the owner or an admin; Kian, 2026-10-08:
// shown to customers in the popup). The last group of the popup, under Good to know; only what is set appears: halal as a
// chip, each dietary word as a chip, the allergens as "Contains …", then the free note in both languages. Nothing of it on
// the rows or cards.
function GoodToKnow({ item }: { item: Item }) {
  const n = item.notes;
  if (!n) return null;
  const chips = [...(n.halal === true ? [{ en: 'Halal', fa: 'حلال' }] : n.halal === false ? [{ en: 'Not halal', fa: 'غیر حلال' }] : []), ...n.dietary.map((d) => ({ en: d, fa: d }))];
  const hasText = !!(n.text?.en || n.text?.fa);
  if (!chips.length && !n.allergens.length && !hasText) return null;
  return (
    <Group data-notes="" title={<><span lang="en">Good to know</span><span lang="fa" dir="rtl">نکات</span></>}>
      <div className="sheet-notes">
        {chips.length > 0 && <p className="chips">{chips.map((c, i) => <span key={i} className="chip"><span lang="en">{c.en}</span><span lang="fa" dir="rtl">{c.fa}</span></span>)}</p>}
        {n.allergens.length > 0 && <p className="contains"><span lang="en">Contains {n.allergens.join(', ')}</span><span lang="fa" dir="rtl">حاوی {n.allergens.join('، ')}</span></p>}
        {hasText && <Bi as="p" text={n.text} className="note" />}
      </div>
    </Group>
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
// The grid carries its own breathing room (Kian, 2026-10-08): rows bring 16 px of padding above and below themselves, cards
// do not, so the grid starts 16 px under the heading and ends 24 px above the band to the next section.
export function ItemList({ section: s, first, photos = true, className = '' }: { section: Section; first: boolean; photos?: boolean; className?: string }) {
  const grid = s.layout === 'grid';
  return (
    <ul className={`${grid ? 'mt-4 grid grid-cols-2 gap-x-3 gap-y-6 pb-6' : 'mt-3'} ${className}`.trim()} data-layout={grid ? 'grid' : 'list'}>
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
      {/* The section list (Kian, 2026-10-08): slides up like the item sheet, a Close button on the language's start side (left in
          English, right in Persian), at most three quarters of the screen so the page and its tab bar stay visible behind it,
          scrollable inside; a tap on a section closes it while the page scrolls there. */}
      <dialog id="sections-dialog" className="list" aria-label="Sections">
        <div className="list-top">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-(--c-sheet-muted)"><span lang="en">Menu</span><span lang="fa" dir="rtl">منو</span></p>
          <button type="button" id="list-close" className="sheet-close list-close" aria-label="Close"><CloseIcon /></button>
        </div>
        <ul tabIndex={-1} autoFocus className="pb-2">{sections.map((s) => <li key={s.id}><a href={`#${sid(s)}`} className="block px-5 py-3 text-[17px] font-semibold"><Bi text={s.name} /></a></li>)}</ul>
      </dialog>
      <script dangerouslySetInnerHTML={{ __html: menuScript }} />
    </>
  );
}

// Rows open the sheet (native <dialog>; it slides in, and slides out before it closes: the Close button, a tap on the dim, Escape
// and Back all go through hide(), which keeps the dialog open under .closing until the exit animation ends); Back closes it (history
// state). The section list behaves the same way (hideList); a tap on a section starts its exit and the page's smooth scroll together. Tabs follow the scroll by position (Kian, 2026-10-08,
// replacing the IntersectionObserver band): the current section is the last one whose top has reached the bar's bottom edge,
// so the tie at a section boundary goes to the section that just arrived; at the end of a page that has scrolled it is the last
// section (a page too short to scroll keeps its first tab). A tap
// lights its tab at once and locks it while the page scrolls there (the tabs in between never light up); the lock lifts when the
// scroll settles (160 ms without a scroll event) or the customer takes over (touch, wheel, keys). The strip scrolls itself to
// centre the active tab; it never scrolls the page. A tap writes no #hash into the URL (Kian, 2026-10-08: a reload used to jump
// to the tapped section, hiding the header); a link straight to a section still opens on it.
const menuScript = `(function(){var sheet=document.getElementById('sheet'),hero=document.getElementById('sheet-hero'),content=document.getElementById('sheet-content');
var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(sheet&&sheet.showModal){var closing=false;
var hide=function(){if(!sheet.open||closing)return;if(reduced){sheet.close();return}closing=true;sheet.classList.add('closing');var done=function(){if(!closing)return;closing=false;sheet.classList.remove('closing');sheet.close()};sheet.addEventListener('animationend',done,{once:true});setTimeout(done,400)};
var open=function(li){var tpl=li.querySelector('template.detail');if(!tpl)return;content.replaceChildren(tpl.content.cloneNode(true));hero.replaceChildren();var p=li.getAttribute('data-photo');if(p){var img=document.createElement('img');img.src=p;img.alt='';img.decoding='async';hero.appendChild(img);hero.hidden=false}else{hero.hidden=true}sheet.classList.toggle('has-photo',!!p);if(closing){closing=false;sheet.classList.remove('closing')}if(!sheet.open){sheet.showModal();history.pushState({sheet:1},'')}sheet.scrollTop=0};
document.querySelectorAll('li.item').forEach(function(li){li.addEventListener('click',function(){open(li)});li.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();open(li)}})});
document.getElementById('sheet-close').addEventListener('click',function(){hide()});sheet.addEventListener('click',function(e){if(e.target===sheet)hide()});sheet.addEventListener('cancel',function(e){e.preventDefault();hide()});
sheet.addEventListener('close',function(){if(history.state&&history.state.sheet)history.back()});window.addEventListener('popstate',function(){if(sheet.open)hide()});
var list=document.getElementById('sections-dialog'),btn=document.getElementById('tabs-list');if(list&&btn&&list.showModal){var listClosing=false;
var hideList=function(){if(!list.open||listClosing)return;if(reduced){list.close();return}listClosing=true;list.classList.add('closing');var done=function(){if(!listClosing)return;listClosing=false;list.classList.remove('closing');list.close()};list.addEventListener('animationend',done,{once:true});setTimeout(done,400)};
btn.addEventListener('click',function(){if(listClosing){listClosing=false;list.classList.remove('closing')}if(!list.open){list.showModal();history.pushState({list:1},'')}list.scrollTop=0});
list.addEventListener('click',function(e){if(e.target===list||e.target.closest('a')||e.target.closest('#list-close'))hideList()});list.addEventListener('cancel',function(e){e.preventDefault();hideList()});
list.addEventListener('close',function(){if(history.state&&history.state.list)history.back()});window.addEventListener('popstate',function(){if(list.open)hideList()})}}
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
