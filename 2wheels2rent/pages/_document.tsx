import { Html, Head, Main, NextScript } from "next/document";
import nprogress from "nprogress";

export default function Document() {
  return (
    <Html lang="fr">
      <Head />
      <link
        rel="stylesheet"
        href={`https://cdnjs.cloudflare.com/ajax/libs/nprogress/${nprogress.version}/nprogress.min.css`}
      />

      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
