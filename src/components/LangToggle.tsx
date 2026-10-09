// Language toggle without React on the client: a button plus one inline script.
// The head script (Welcome.tsx) restores the saved language before first paint; the welcome screen's buttons set it the same way. Colours: the Header group's
// "Language button" and "Language button text" tokens (src/venues/tokens.ts).
export function LangToggle() {
  return (
    <>
      <button type="button" id="lang-toggle" className="rounded-full bg-(--c-header-lang-bg) px-3.5 py-1.5 text-sm font-medium text-(--c-header-lang-text) transition" aria-label="Switch language / تغییر زبان">
        <span lang="en">فارسی</span>
        <span lang="fa">English</span>
      </button>
      <script dangerouslySetInnerHTML={{ __html: `document.getElementById('lang-toggle').addEventListener('click',function(){var h=document.documentElement;var n=h.dataset.lang==='fa'?'en':'fa';h.dataset.lang=n;h.lang=n;h.dir=n==='fa'?'rtl':'ltr';try{localStorage.setItem('roses-lang',n)}catch(e){}});` }} />
    </>
  );
}
