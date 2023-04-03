import "@/styles/globals.css";
import "leaflet/dist/leaflet.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "animate.css";
import "react-toastify/dist/ReactToastify.css";
import type { AppProps } from "next/app";
import { Web3ContextProvider } from "../context";
import Layout from "../components/Layout";
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  useEffect(() => {
    typeof window !== "undefined" &&
      typeof document !== "undefined" &&
      require("bootstrap/dist/js/bootstrap");
  }, [router.events]);
  return (
    <Web3ContextProvider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </Web3ContextProvider>
  );
}
