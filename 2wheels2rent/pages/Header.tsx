import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import { Web3Button } from "../components/";
import { useWeb3Context } from "../context/";
import { useScrollBlock } from "../hooks/useScrollBlock";

export default function Header() {
  const myNav = useRef<HTMLDivElement>(null);
  const toHide = useRef<HTMLDivElement>(null);
  const [prevScrollPos, setPrevScrollPos] = useState(0);
  const [blockScroll, allowScroll] = useScrollBlock() as any;
  const [pognon, setPognon] = useState("");
  const { address, disconnect, balance } = useWeb3Context() as any;

  const openNav = () => {
    if (myNav.current) myNav.current.style.height = "100%";
  };

  const closeNav = () => {
    if (myNav.current) myNav.current.style.height = "0%";
    allowScroll();
  };

  const handleScroll = useCallback(() => {
    const { scrollY } = window;
    if (scrollY > prevScrollPos) {
      if (toHide.current) toHide.current.style.marginTop = "-200px";
    } else {
      if (toHide.current) toHide.current.style.marginTop = "-25px";
    }
    setPrevScrollPos(scrollY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatBalance = (balance: ethers.BigNumberish) => {
    if (!balance) {
      setPognon("Unavailable");
      return;
    }
    setPognon(
      ethers.utils.formatEther(balance).split(".")[0] +
        "." +
        ethers.utils.formatEther(balance).split(".")[1].slice(0, 4)
    );
  };

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true } as any);
    return () =>
      window.removeEventListener("scroll", handleScroll, {
        passive: true,
      } as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (balance) {
      formatBalance(balance);
    }
  }, [balance]);

  return (
    <div>
      <header className="to-hide" ref={toHide}>
        <div className="container-fluid">
          <div className="row">
            <div className="col-xs-12">
              <h1 className="animate__animated animate__backInRight">
                <Link href="/">
                  <br />
                  <span style={{ color: "rgb(8, 201, 118)" }}>2</span>
                  <span style={{ color: "rgb(8, 88, 162)" }}>Wheels</span>
                  <span style={{ color: "rgb(8, 201, 118)" }}>2</span>
                  <span style={{ color: "rgb(8, 88, 162)" }}>Rent</span> 🚲
                </Link>
              </h1>
            </div>
            {/* menu tablette PC */}

            <>
              <div className="col-xs-12">
                <nav className="user">
                  <ul>
                    <li className="animate__animated animate__fadeInLeft">
                      {!address ? (
                        <Web3Button />
                      ) : (
                        <h2>
                          compte:{" "}
                          <span style={{ color: "orange" }}>
                            {address.slice(0, 6) + "..." + address.slice(-4)}
                          </span>{" "}
                          - balance:{" "}
                          <span style={{ color: "orange" }}>
                            {pognon} MATIC
                          </span>
                        </h2>
                      )}
                    </li>
                    <li className="animate__animated animate__fadeInLeft">
                      {address && (
                        <Link href="/dex">
                          <h2>DEX</h2>
                        </Link>
                      )}
                    </li>
                    <li className="animate__animated animate__fadeInLeft">
                      {address && <h2 onClick={disconnect}>Déconnexion</h2>}
                    </li>
                  </ul>
                </nav>

                {/* menu smartphone */}
                <div ref={myNav} className="overlay">
                  <a href="#" className="closebtn" onClick={closeNav}>
                    &times;
                  </a>
                  <br />
                  <div className="overlay-content">
                    {!address ? (
                      <Web3Button />
                    ) : (
                      <h2>
                        compte:{" "}
                        {address.slice(0, 6) + "..." + address.slice(-4)} -
                        balance: {pognon} MATIC
                      </h2>
                    )}
                  </div>
                  <br />
                  <div>
                    {address && (
                      <Link href="/dex">
                        <h2 style={{ cursor: "pointer" }}>DEX</h2>
                      </Link>
                    )}
                  </div>
                  <br />
                  <div>
                    {address && (
                      <h2 onClick={disconnect} style={{ cursor: "pointer" }}>
                        Déconnexion
                      </h2>
                    )}
                  </div>
                </div>
                <h2
                  id="regenerate"
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    openNav();
                    setTimeout(() => {
                      blockScroll();
                    }, 800);
                  }}
                >
                  Menu
                </h2>
              </div>
            </>
          </div>
        </div>
      </header>
    </div>
  );
}
