// Language toggle without React on the client: a button plus one inline script.
// The head script (Intro.tsx) restores the saved language before first paint.
export function LangToggle() {
  return (
    <>
      <button type="button" id="lang-toggle" className="rounded-full border border-current/30 px-3 py-1 text-sm font-medium" aria-label="Switch language / تغییر زبان">
        <span lang="en">فارسی</span>
        <span lang="fa">English</span>
      </button>
      <script dangerouslySetInnerHTML={{ __html: `document.getElementById('lang-toggle').addEventListener('click',function(){var h=document.documentElement;var n=h.dataset.lang==='fa'?'en':'fa';h.dataset.lang=n;h.lang=n;h.dir=n==='fa'?'rtl':'ltr';try{localStorage.setItem('roses-lang',n)}catch(e){}});` }} />
    </>
  );
}
