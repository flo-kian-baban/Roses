import type { AppProps } from 'next/app';
import { montserrat, tinos, vazirmatn } from '@/app/fonts';
import '@/app/globals.css';

// Font variables on :root so the venue theme can reference them; the files are bundled by next/font/local.
export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `:root{--font-tinos:${tinos.style.fontFamily};--font-montserrat:${montserrat.style.fontFamily};--font-vazirmatn:${vazirmatn.style.fontFamily}}` }} />
      <Component {...pageProps} />
    </>
  );
}
