import { useWeb3Context } from "../context/";
import { useEffect, useState } from "react";
import { checkIfMetamaskConnected } from "../utils";
import Image from "next/image";
import Loader from "./Loader";

interface ConnectProps {
  connect: (() => Promise<void>) | null;
}
const ConnectButton = ({ connect }: ConnectProps) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return connect ? (
    <>
      <button
        type="button"
        onClick={connect}
        className="animate__animated animate__flip btn btn-info gradient-button"
      >
        {isClient && window.ethereum && (
          <Image
            src="/Deco/metamask63badfdb20783.png"
            alt="metamask"
            width={30}
            height={30}
            style={{ width: "30px", marginTop: "6px", marginRight: "10px" }}
          />
        )}{" "}
        Connecter le Wallet{" "}
        <Image
          width={30}
          height={30}
          src="/Deco/walletconnect-afhldufg652525.png"
          alt="wallet connect"
          style={{
            width: "30px",
            borderRadius: "50%",
            marginTop: "6px",
            marginRight: "250px",
          }}
        />
      </button>
      {isClient && window.ethereum && (
        <button
          type="button"
          //onClick={addPolygonToMetamask}
          onClick={checkIfMetamaskConnected}
          className="polygon animate__animated animate__zoomIn btn btn-info gradient-button"
        >
          Passer sur Matic Amoy{" "}
          <Image
            className="poly-image"
            src="/Deco/a1f438b853a1ff294b21bd7b31f8c5d6.webp"
            alt="polygon"
            width={30}
            height={30}
            style={{ width: "30px", borderRadius: "50%", marginTop: "-12px" }}
          />{" "}
          <Image
            className="polygon-image"
            src="/Deco/metamask63badfdb20783.png"
            alt="metamask"
            width={30}
            height={30}
            style={{ width: "0px" }}
          />
        </button>
      )}
    </>
  ) : (
    <>
      <Loader />
    </>
  );
};

interface DisconnectProps {
  disconnect: (() => Promise<void>) | null;
}

const DisconnectButton = ({ disconnect }: DisconnectProps) => {
  return disconnect ? (
    <button
      type="button"
      onClick={disconnect}
      className="animate__animated animate__flip"
      style={{
        boxShadow: "0 0 3px 3px red",
        borderRadius: "5px",
        height: "45px",
        width: "300px",
        margin: "20px",
      }}
    >
      Disconnect
    </button>
  ) : (
    <>
      <Loader />
    </>
  );
};

export function Web3Button() {
  const { web3Provider, connect, disconnect } = useWeb3Context();

  return web3Provider ? (
    <DisconnectButton disconnect={disconnect} />
  ) : (
    <ConnectButton connect={connect} />
  );
}
