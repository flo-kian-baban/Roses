import type { AppProps } from 'next/app';
import { vazirmatn } from '@/app/fonts';
import '@/styles/public.css';

// The customers' pages (Pages Router). Font variables on :root so the venue theme can reference them; the files are
// bundled by next/font/local. The stylesheet is the public one (language switch, welcome screen, menu kit; colours by tokens).
export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `:root{--font-vazirmatn:${vazirmatn.style.fontFamily}}` }} />
      <Component {...pageProps} />
    </>
  );
}
