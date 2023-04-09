import { useCallback, useEffect, useState } from "react";
import { useWeb3Context } from "../context/";

const useAddTokenToMetaMask = () => {
  const { web3Provider, network } = useWeb3Context();
  const [isMetaMaskReady, setIsMetaMaskReady] = useState(false);

  useEffect(() => {
    const checkMetaMask = async () => {
      if (window.ethereum) {
        setIsMetaMaskReady(true);
      } else {
        setIsMetaMaskReady(false);
      }
    };
    checkMetaMask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addToken = useCallback(
    async (token) => {
      const { tokenAddress, tokenSymbol, tokenDecimals, tokenImage } = token;

      if (window?.ethereum && network?.chainId === 80001) {
        try {
          await web3Provider.send("wallet_watchAsset", {
            type: "ERC20",
            options: {
              address: tokenAddress,
              symbol: tokenSymbol,
              decimals: tokenDecimals,
              image: tokenImage,
            },
          });
        } catch (error) {
          console.error("Error adding token to MetaMask:", error);
        }
      } else {
        console.error("MetaMask provider not found");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isMetaMaskReady, web3Provider, network]
  );

  return addToken;
};

export default useAddTokenToMetaMask;
