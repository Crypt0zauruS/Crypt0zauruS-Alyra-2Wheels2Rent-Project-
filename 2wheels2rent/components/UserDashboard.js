import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useWeb3Context } from "../context/";
import SpecialLoader from "./SpecialLoader";
import Loader from "./Loader";
import MakeProposal from "./MakeAProposal";
import CheckProposals from "./CheckProposals";
import CheckMyProposals from "./CheckMyProposals";
import { Contract, ethers } from "ethers";
import MyNFT from "./MyNFT";
import MyContract from "./MyContract";
import W2R from "../contracts/W2R.json";
import BikeShare from "../contracts/BikeShare.json";
import BikeRent from "../contracts/BikeRent.json";
import RenterRentals from "./RenterRentals";
import LenderRentals from "./LenderRentals";
import Footer from "./Footer";
import W2Rmini from "../private/W2Rmini.png";
import useAddTokenToMetaMask from "../hooks/useAddTokenToMetamask";

const NearbyUsersMap = dynamic(() => import("../components/NearbyUsersMap"), {
  ssr: false,
});

const UserDashboard = ({ props }) => {
  const {
    role,
    showToast,
    renterWhitelistAddress,
    renterWhitelistAbi,
    lenderWhitelistAddress,
    lenderWhitelistAbi,
    checkPhotoLender,
    name,
  } = props;

  const [loaded, setLoaded] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [userCoordinates, setUserCoordinates] = useState([
    -48.876667, -123.393333,
  ]);
  const [rad, setRad] = useState(10000);
  const [tempRad, setTempRad] = useState(10000);
  const [loader, setLoader] = useState(false);
  const [smallLoader, setSmallLoader] = useState(false);
  const [newRDV, setNewRDV] = useState(["", ""]);
  const [updateGPS, setUpdateGPS] = useState(false);
  const [distanceMax, setDistanceMax] = useState(10000);
  const [nearbyLoader, setNearbyLoader] = useState(false);
  const [modalNFT, setModalNFT] = useState(false);
  const [modalContract, setModalContract] = useState(false);
  const [loaderContract, setLoaderContract] = useState(false);
  const { address, web3Provider, network, disconnect } = useWeb3Context();
  const [w2Rcontract, setW2Rcontract] = useState(null);
  const [w2rUserBalance, setW2rUserBalance] = useState(null);
  const [makeProposal, setMakeProposal] = useState(false);
  const [checkProposals, setCheckProposals] = useState(false);
  const [checkMyProposals, setCheckMyProposals] = useState(false);
  const [lenderRentals, setLenderRentals] = useState(false);
  const [renterRentals, setRenterRentals] = useState(false);
  const [proposalAddress, setProposalAddress] = useState("");
  const [activated, setActivated] = useState(false);
  const [userInfos, setUserInfos] = useState({
    contractAddress: "",
    NFTId: null,
  });

  const [whitelistContract] = useState(
    new Contract(
      role === "loueur"
        ? lenderWhitelistAddress
        : role === "emprunteur"
        ? renterWhitelistAddress
        : null,
      role === "loueur"
        ? lenderWhitelistAbi
        : role === "emprunteur"
        ? renterWhitelistAbi
        : null,
      web3Provider?.getSigner()
    )
  );
  const bikeShareAbi = BikeShare.abi;
  const bikeRentAbi = BikeRent.abi;
  const w2rAddress = W2R.networks[network.chainId]?.address;
  const [contract, setContract] = useState(null);
  const addToken = useAddTokenToMetaMask();
  const [w2rToken, setW2RToken] = useState({});

  const fetchTokenInfo = async () => {
    if (w2Rcontract && w2rAddress) {
      const [w2rSymbol, w2rDecimals] = await Promise.all([
        w2Rcontract.symbol(),
        w2Rcontract.decimals(),
      ]);

      setW2RToken({
        tokenAddress: w2rAddress,
        tokenSymbol: w2rSymbol,
        tokenDecimals: w2rDecimals,
        tokenImage: W2Rmini,
      });
    }
  };

  const getWhitelistedInfos = useCallback(async () => {
    if (!address) return;
    try {
      const infos = await whitelistContract.whitelistedAddresses(address);
      setUserInfos({
        contractAddress: infos[1],
        NFTId: parseInt(infos[2]._hex),
      });
      setContract(
        new Contract(
          infos[1],
          role === "loueur"
            ? bikeShareAbi
            : role === "emprunteur"
            ? bikeRentAbi
            : null,
          web3Provider?.getSigner()
        )
      );
    } catch (error) {
      console.log(error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, web3Provider]);

  const getNearbyUsers = async () => {
    if (!address) return;
    try {
      !loaded ? setLoader(true) : setNearbyLoader(true);
      const response = await fetch("/api/getNearbyAddresses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ethereumAddress: address,
          rad,
        }),
      });

      if (response.ok) {
        const { userCoordinates, nearbyUsers } = await response.json();
        setUserCoordinates([userCoordinates[0], userCoordinates[1]]);
        setNearbyUsers(nearbyUsers);
      } else {
        throw new Error("Erreur lors de la récupération des 2Wheelers");
      }
    } catch (error) {
      showToast("Erreur lors de la récupération des 2Wheelers");
    } finally {
      !loaded ? setLoader(false) : setNearbyLoader(false);
    }
  };

  const unsubscribe = async () => {
    if (!address) return;
    if (role !== "loueur" && role !== "emprunteur") return;
    if (
      (role === "loueur" || role === "emprunteur") &&
      !userInfos.contractAddress
    ) {
      return;
    }
    setLoaderContract(true);
    try {
      const safeDate = await contract.safeDate();
      if (Number(safeDate) > Date.now() / 1000) {
        showToast(
          "Vous ne pouvez pas vous désinscrire avant un délai de 2 jours après la fin de votre dernière location. Vous pourrez le faire le " +
            new Date(Number(safeDate) * 1000).toLocaleDateString("fr-FR") +
            "à" +
            new Date(Number(safeDate) * 1000).toLocaleTimeString("fr-FR") +
            ". Vous pouvez peut-être annuler votre location si le vélo n'a pas encore été pris, puis vous désinscrire.",
          true
        );
        return;
      }
      const balance = await w2Rcontract.balanceOf(userInfos.contractAddress);
      const decimals = await w2Rcontract.decimals();
      const formattedBalance = Number(
        ethers.utils.formatUnits(balance, decimals)
      );
      const tx = await whitelistContract.removeAddressFromWhitelist();
      await tx.wait();
      whitelistContract.once(
        role === "loueur"
          ? "LenderRemovedFromWhitelist"
          : "RenterRemovedFromWhitelist",
        (owner, NFTId) => {
          console.log("owner", owner, "NFtId", NFTId);
          showToast(`Votre NFT a bien été détruit`);
        }
      );
      contract.once("ContractDestroyed", (owner, date, contract) => {
        console.log("owner", owner, "date", date, "contract", contract);
        showToast(`Votre contrat ${contract} a bien été détruit`);
      });
      formattedBalance &&
        showToast(
          `Votre balance de ${formattedBalance} W2R a été transférée sur votre wallet`
        );
    } catch (error) {
      console.log(error);
      showToast("Erreur lors de la destruction du contrat et du NFT", true);
      setLoaderContract(false);
      return;
    }
    try {
      const response = await fetch("/api/removeUser", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ethereumAddress: address,
        }),
      });
      if (response.ok) {
        showToast("Vous avez bien été désinscrit");
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      }
    } catch (error) {
      console.log(error);
      showToast("Erreur lors de la désinscription", true);
    } finally {
      setLoaderContract(false);
    }
  };

  const getW2Rbalance = useCallback(async () => {
    if (!address) return;
    if (!w2Rcontract) return;
    try {
      const balance = await w2Rcontract.balanceOf(address);
      setW2rUserBalance(Number(ethers.utils.formatEther(balance)).toFixed(2));
    } catch (error) {
      console.log(error);
    }
  }, [address, w2Rcontract]);

  const updateRDV = async () => {
    // Vérifier si l'adresse et le rôle sont définis
    if (!address || !role) return;
    if (!contract) return;
    // Vérifier si les coordonnées sont valides
    const isCoordinateValid =
      typeof newRDV[0] === "string" && typeof newRDV[1] === "string";
    if (!isCoordinateValid) return;
    const isEmptyCoordinate = newRDV[0] === "" || newRDV[1] === "";
    const isPointNemo =
      newRDV[0] === "-48.876667" && newRDV[1] === "-123.393333";
    const latRegex =
      /^(\+|-)?(?:90(?:(?:\.0{1,6})?)|(?:[0-9]|[1-8][0-9])(?:(?:\.[0-9]{1,6})?))$/;
    const lonRegex =
      /^(\+|-)?(?:180(?:(?:\.0{1,6})?)|(?:[0-9]|[1-9][0-9]|1[0-7][0-9])(?:(?:\.[0-9]{1,6})?))$/;
    const isInvalidGPS = !latRegex.test(newRDV[0]) || !lonRegex.test(newRDV[1]);

    if (isEmptyCoordinate) {
      showToast("Données GPS manquantes", true);
      return;
    }
    if (isPointNemo) {
      showToast("Le point Nemo n'est pas praticable à vélo", true);
      return;
    }
    if (isInvalidGPS) {
      showToast("Données GPS invalides", true);
      return;
    }
    // Mettre à jour le lieu de RDV dans le contrat
    setSmallLoader(true);
    try {
      const tx = await contract.setGPS(newRDV[0], newRDV[1]);
      await tx.wait();
      contract.once(
        "GPSupdated",
        (owner, date, latitude, longitude, contract) => {
          console.log(
            "owner",
            owner,
            "date",
            date,
            "latitude",
            latitude,
            "longitude",
            longitude,
            "contrat",
            contract
          );
          showToast(
            `Votre lieu de RDV a bien été mis à jour: ${latitude}, ${longitude}, contrat ${contract}`
          );
        }
      );
    } catch (error) {
      console.log(error);
      showToast(
        "Erreur lors de la mise à jour du lieu de RDV dans votre contrat",
        true
      );
      setSmallLoader(false);
      return;
    }
    // Mettre à jour le lieu de RDV dans la base de données
    try {
      const response = await fetch("/api/registerUser", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ethereumAddress: address,
          role,
          latitude: newRDV[0],
          longitude: newRDV[1],
          update: true,
        }),
      });
      if (response.ok) {
        showToast("Veuillez vous reconnecter");
        setTimeout(() => {
          disconnect();
        }, 3000);
      }
    } catch (error) {
      console.log(error);
      showToast("Erreur lors de la mise à jour du lieu de RDV", true);
    } finally {
      setSmallLoader(false);
    }
  };

  useEffect(() => {
    const handleCheckActivated = async () => {
      setActivated(!(await contract?.isDeactivated()));
    };
    handleCheckActivated();
  }, [contract]);

  useEffect(() => {
    getNearbyUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rad]);

  useEffect(() => {
    if (!W2R.networks[network.chainId]) {
      disconnect();
    }
    if (!loaded) {
      setLoaded(true);
    }
    const w2rAbi = W2R.abi;
    if (network && address) {
      setW2Rcontract(
        new Contract(w2rAddress, w2rAbi, web3Provider?.getSigner())
      );
      getW2Rbalance();
      getWhitelistedInfos();
      fetchTokenInfo();
      //handleCheckActivated();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (w2Rcontract) {
      getW2Rbalance();
      fetchTokenInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w2Rcontract]);

  return (
    <div>
      {!loader ? (
        <>
          <div className="instructions text-center fs-5">
            {!updateGPS ? (
              <div className="instructions2" style={{ marginTop: "-800px" }}>
                <h2 className="text-center fs-4">
                  Bienvenue {name} ! <br />
                  W2R sur votre wallet:{" "}
                  <span style={{ fontStyle: "italic", color: "orange" }}>
                    {w2rUserBalance}
                  </span>{" "}
                  {window?.ethereum &&
                    network.chainId === 80001 &&
                    w2rToken && (
                      <button
                        onClick={() => addToken(w2rToken)}
                        className="m-3 fs-6"
                        style={{ borderRadius: "10px" }}
                      >
                        Ajouter {w2rToken?.tokenSymbol} à MetaMask
                      </button>
                    )}
                  <br />
                  Vous pouvez acquérir des W2R sur notre{" "}
                  <Link href="/dex">
                    <span
                      style={{
                        fontWeight: "bold",
                        color: "orange",
                      }}
                    >
                      DEX
                    </span>
                  </Link>
                </h2>
                <hr />
                <p>
                  <span style={{ color: "red" }}>Rappel:</span> votre marqueur
                  rouge représente un lieu prés de chez vous que vous avez
                  choisi lors de votre inscription.{" "}
                  <span style={{ color: "red" }}>Jamais</span>{" "}
                  l&apos;application ne vous localisera en temps réel, nous
                  respectons votre vie privée et votre sécurité !
                  <br /> Cliquez sur votre marqueur{" "}
                  <span style={{ color: "red" }}>rouge</span> pour avoir accés à
                  votre profil.
                </p>{" "}
              </div>
            ) : (
              <div className="instructions2" style={{ marginTop: "-800px" }}>
                <p>
                  Aprés vous être localisé en appuyant sur le bouton &quot;Me
                  localiser&quot; (marqueur{" "}
                  <span style={{ color: "red" }}>rouge</span>
                  ), cliquez sur la carte pour choisir un nouveau lieu de
                  Rendez-vous (un marqueur{" "}
                  <span style={{ color: "blue" }}>bleu</span> apparaîtra).
                  <br />
                  Ensuite, cliquez sur le bouton &quot;Mettre à jour&quot; pour
                  valider.
                </p>
                {smallLoader && <Loader />}
              </div>
            )}
            <NearbyUsersMap
              userCoordinates={userCoordinates}
              nearbyUsers={nearbyUsers}
              setModalNFT={setModalNFT}
              setModalContract={setModalContract}
              role={role}
              showToast={showToast}
              checkPhotoLender={checkPhotoLender}
              newRDV={newRDV}
              setNewRDV={setNewRDV}
              updateGPS={updateGPS}
              setUpdateGPS={setUpdateGPS}
              distanceMax={distanceMax}
              updateRDV={updateRDV}
              setMakeProposal={setMakeProposal}
              makeProposal={makeProposal}
              setProposalAddress={setProposalAddress}
              setCheckProposals={setCheckProposals}
              setCheckMyProposals={setCheckMyProposals}
              setLenderRentals={setLenderRentals}
              setRenterRentals={setRenterRentals}
              activated={activated}
            />
            {!updateGPS ? (
              <div className="slider-container">
                <label htmlFor="rad" className="slider-label">
                  Rayon de recherche des 2Wheelers
                  <span>{nearbyLoader && <Loader />}</span>
                </label>
                <input
                  id="rad"
                  type="range"
                  min="0"
                  max="20000"
                  step="1000"
                  value={tempRad}
                  onMouseUp={() => {
                    setRad(tempRad);
                  }}
                  onTouchEnd={() => {
                    setRad(tempRad);
                  }}
                  onChange={(e) => setTempRad(e.target.value)}
                />
                <span className="slider-value"> {rad / 1000} Km</span>
              </div>
            ) : (
              <div className="slider-container">
                <label htmlFor="distanceMax" className="slider-label">
                  Distance Max entre votre position et le lieu de RDV
                </label>
                <input
                  id="distanceMax"
                  type="range"
                  min="0"
                  max="10000"
                  step="1000"
                  value={distanceMax}
                  onChange={(e) => setDistanceMax(e.target.value)}
                />
                <span className="slider-value"> {distanceMax / 1000} Km</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ marginTop: "400px" }}>
          <p className="text-center fs-4">Récupération des 2Wheelers</p>
          <SpecialLoader />
        </div>
      )}
      {modalNFT && (
        <MyNFT userInfos={userInfos} setModalNFT={setModalNFT} role={role} />
      )}
      {modalContract && (
        <MyContract
          userInfos={userInfos}
          setModalContract={setModalContract}
          role={role}
          userCoordinates={userCoordinates}
          showToast={showToast}
          unsubscribe={unsubscribe}
          setLoaderContract={setLoaderContract}
          loaderContract={loaderContract}
          w2Rcontract={w2Rcontract}
          contract={contract}
          address={address}
          w2rUserBalance={w2rUserBalance}
          getW2Rbalance={getW2Rbalance}
          activated={activated}
          setActivated={setActivated}
          w2rAddress={w2rAddress}
        />
      )}
      {makeProposal && role === "emprunteur" && (
        <MakeProposal
          setMakeProposal={setMakeProposal}
          lenderWhitelistAddress={lenderWhitelistAddress}
          lenderWhitelistAbi={lenderWhitelistAbi}
          bikeShareAbi={bikeShareAbi}
          proposalAddress={proposalAddress}
          web3Provider={web3Provider}
          showToast={showToast}
          w2Rcontract={w2Rcontract}
          contract={contract}
          userInfos={userInfos}
        />
      )}
      {checkProposals && role === "loueur" && (
        <CheckProposals
          contract={contract}
          setCheckProposals={setCheckProposals}
          showToast={showToast}
          userCoordinates={userCoordinates}
          w2Rcontract={w2Rcontract}
          web3Provider={web3Provider}
          bikeRentAbi={bikeRentAbi}
        />
      )}
      {checkMyProposals && role === "emprunteur" && (
        <CheckMyProposals
          contract={contract}
          setCheckMyProposals={setCheckMyProposals}
          showToast={showToast}
          web3Provider={web3Provider}
          bikeShareAbi={bikeShareAbi}
        />
      )}
      {lenderRentals && role === "loueur" && (
        <LenderRentals
          setLenderRentals={setLenderRentals}
          contract={contract}
          showToast={showToast}
        />
      )}
      {renterRentals && role === "emprunteur" && (
        <RenterRentals
          setRenterRentals={setRenterRentals}
          contract={contract}
          showToast={showToast}
        />
      )}
      <Footer />
    </div>
  );
};

export default UserDashboard;
