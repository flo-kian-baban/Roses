import { Html, Head, Main, NextScript } from 'next/document';

// Public pages ship no runtime JavaScript (see src/pages/[venue].tsx), so NextScript renders nothing there.
export default function Document() {
  return (
    <Html lang="en" data-lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
