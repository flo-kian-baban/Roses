'use client';
import { useEffect, useState } from 'react';

const KEY = 'roses-lang';

export function LangToggle() {
  const [lang, setLang] = useState<'en' | 'fa'>('en');
  useEffect(() => { setLang((document.documentElement.dataset.lang as 'en' | 'fa') || 'en'); }, []);
  function toggle() {
    const next = lang === 'en' ? 'fa' : 'en';
    const html = document.documentElement;
    html.dataset.lang = next; html.lang = next; html.dir = next === 'fa' ? 'rtl' : 'ltr';
    try { localStorage.setItem(KEY, next); } catch {}
    setLang(next);
  }
  return (
    <button type="button" onClick={toggle} aria-label={lang === 'en' ? 'نمایش منو به فارسی' : 'Show menu in English'}
      className="rounded-full border border-current/30 px-3 py-1 text-sm font-medium">
      {lang === 'en' ? 'فارسی' : 'English'}
    </button>
  );
}
