import { useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Header from "../pages/Header";
import NProgress from "nprogress";

const Layout = ({ children }: any) => {
  const router = useRouter();

  useEffect(() => {
    router.events.on("routeChangeStart", NProgress.start);
    router.events.on("routeChangeComplete", NProgress.done);
    return () => {
      router.events.off("routeChangeStart", NProgress.start);
      router.events.on("routeChangeComplete", NProgress.done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
        <meta
          name="description"
          content="2Wheels2Rent, plateforme décentralisée de location de vélos"
        ></meta>
        <title>2Wheels2Rent, Bienvenue sur notre Application !</title>
      </Head>
      <Header />
      {children}
    </>
  );
};

export default Layout;
