import Document, { Html, Head, Main, NextScript, type DocumentContext, type DocumentInitialProps } from 'next/document';
import { cspFor, inlineScripts } from '@/lib/csp';

// Public pages ship no runtime JavaScript (see src/pages/[venue].tsx), so NextScript renders nothing there.
// Pre-go-live audit S2-10 (the PM, 2026-11-03): each page carries its Content-Security-Policy, first in its head, allowing exactly the
// inline scripts it was rendered with (src/lib/csp.ts); a page with the welcome artwork also those the admin preview swaps in.
type Props = DocumentInitialProps & { csp: string };
export default class RosesDocument extends Document<Props> {
  static async getInitialProps(ctx: DocumentContext): Promise<Props> {
    const initial = await Document.getInitialProps(ctx);
    return { ...initial, csp: cspFor(inlineScripts(initial.html, initial.head ?? []), { preview: /\sdata-engine[=\s>]/.test(initial.html) }) };
  }
  render() {
    return (
      <Html lang="en" data-lang="en">
        <Head>
          <meta httpEquiv="Content-Security-Policy" content={this.props.csp} />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
