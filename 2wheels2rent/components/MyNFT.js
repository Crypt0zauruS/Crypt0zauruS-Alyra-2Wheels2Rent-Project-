import { useEffect, useState, useCallback } from "react";
import { Contract } from "ethers";
import TwoWheels2RentLender from "../contracts/TwoWheels2RentLender.json";
import TwoWheels2RentRenter from "../contracts/TwoWheels2RentRenter.json";
import { useWeb3Context } from "../context/";
import Image from "next/image";
import goldenBike from "../private/goldenBike.png";

const MyNFT = ({ userInfos, setModalNFT, role }) => {
  const { NFTId } = userInfos;
  const { address, network, web3Provider } = useWeb3Context();
  const [metadata, setMetadata] = useState({});
  const lenderNFTAbi = TwoWheels2RentLender.abi;
  const [lenderNFTAddress, setLenderNFTAddress] = useState("");
  const renterNFTAbi = TwoWheels2RentRenter.abi;
  const [renterNFTAddress, setRenterNFTAddress] = useState("");

  const getNFTInfos = useCallback(
    async (NFTAddress, NFTAbi) => {
      try {
        const signer = web3Provider?.getSigner();
        const NFTContract = new Contract(NFTAddress, NFTAbi, signer);
        const NFTinfos = await NFTContract.tokenURI(NFTId);
        const response = await fetch(NFTinfos);
        const data = await response.json();
        setMetadata(data);
      } catch (error) {
        console.log(error);
      }
    },
    [NFTId, web3Provider]
  );

  useEffect(() => {
    if (address && network) {
      if (role === "loueur") {
        setLenderNFTAddress(
          TwoWheels2RentLender.networks[network.chainId].address
        );
      } else if (role === "emprunteur") {
        setRenterNFTAddress(
          TwoWheels2RentRenter.networks[network.chainId].address
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network, address]);

  useEffect(() => {
    if (role === "loueur" && lenderNFTAddress && NFTId) {
      getNFTInfos(lenderNFTAddress, lenderNFTAbi);
    } else if (role === "emprunteur" && renterNFTAddress && NFTId) {
      getNFTInfos(renterNFTAddress, renterNFTAbi);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lenderNFTAddress, renterNFTAddress, NFTId]);

  const loaderProp = ({ src, width, quality }) => {
    console.log(src, width, quality);
    return `${src}?w=${width}&q=${quality || 75}`;
  };

  return (
    <div className="modalNFT">
      <div className="modalNFTContent">
        <button
          type="button"
          className="closeButton btn btn-success"
          onClick={() => setModalNFT(false)}
        >
          &times;
        </button>
        <Image
          className="modalNFTImage"
          width={500}
          height={500}
          src={
            metadata.image
              ? "https://ipfs.io/ipfs/" +
                metadata?.image?.replace("ipfs://", "")
              : goldenBike
          }
          alt="NFT Image"
          quality={75}
          loader={loaderProp}
        />
        <h2>{metadata.name ? metadata?.name : "loading..."}</h2>
        <p>
          {metadata.description
            ? metadata?.description + " #" + NFTId
            : "loading..."}
        </p>
        <ul className="attributes">
          {metadata.attributes
            ? metadata.attributes.map((attr, index) => (
                <li key={index}>
                  <span className="attributeType">{attr.trait_type}: </span>
                  <span className="attributeValue">{attr.value}</span>
                </li>
              ))
            : "loading..."}
        </ul>
        {network.chainId === 80002 && (
          <h2 className="fs-5" style={{ color: "orange" }}>
            Contrat du NFT :{" "}
            <a
              style={{ color: "cyan", wordBreak: "break-all" }}
              rel="noreferrer noopener"
              target="_blank"
              href={`https://testnets.opensea.io/assets/amoy/${
                role === "loueur"
                  ? lenderNFTAddress
                  : role === "emprunteur"
                  ? renterNFTAddress
                  : null
              }/${NFTId}`}
            >
              {role === "loueur"
                ? lenderNFTAddress
                : role === "emprunteur"
                ? renterNFTAddress
                : null}
            </a>
          </h2>
        )}
      </div>
    </div>
  );
};

export default MyNFT;
