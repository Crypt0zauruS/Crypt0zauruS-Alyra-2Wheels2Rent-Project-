import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import ImageCropper from "../components/Cropper";
import BikeLenderForm from "../components/BikeLenderForm";
import BikeRenterForm from "../components/BikeRenterForm";
import UserDashboard from "../components/UserDashboard";
import { useWeb3Context } from "../context/";
import { ToastContainer, toast } from "react-toastify";
import useImageClassifier from "../hooks/useImageClassifier";
import SpecialLoader from "../components/SpecialLoader";
import Loader from "../components/Loader";
import DOMPurify from "isomorphic-dompurify";
import { Contract } from "ethers";
import LenderWhitelist from "../contracts/LenderWhitelist.json";
import RenterWhitelist from "../contracts/RenterWhitelist.json";
import Footer from "../components/Footer";

const MapComponent = dynamic(() => import("../components/MapWithSearch"), {
  ssr: false,
});

export default function Home() {
  const [userExists, setUserExists] = useState(false);
  const [photoExists, setPhotoExists] = useState(false);
  const [role, setRole] = useState("");
  const [loader, setLoader] = useState(false);
  const [image, setImage] = useState(null);
  const [cropping, setCropping] = useState(false);
  const [RDV, setRDV] = useState([]);
  // Renter states
  const [pseudo, setPseudo] = useState("");
  const [selectedType, setSelectedType] = useState({ value: "", label: "" });
  // Lender states
  const [username, setUsername] = useState("");
  const [selectedBrand, setSelectedBrand] = useState({ label: "", value: "" });
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  // Web3 context
  const { address, network, web3Provider, disconnect } = useWeb3Context();
  const [name, setName] = useState("");
  // Lender whitelist contract
  const lenderWhitelistAbi = LenderWhitelist.abi;
  const [lenderWhitelistAddress, setLenderWhitelistAddress] = useState("");
  const renterWhitelistAbi = RenterWhitelist.abi;
  const [renterWhitelistAddress, setRenterWhitelistAddress] = useState("");

  const showToast = (message, type = false) => {
    if (!type) {
      toast.success(message, { closeOnClick: true, pauseOnHover: false });
    } else {
      toast.error(message, { closeOnClick: true, pauseOnHover: false });
    }
  };

  const handleRoleChange = (e) => {
    setRole(e.target.value);
  };

  const validateInputs = (role) => {
    if (!address || !network) return false;
    const commonRegex = /^(?=\S)[a-zA-Z0-9À-ÿ.\-@$*?#&'%! ]{3,40}$/;
    const userInput =
      role === "loueur" ? username : role === "emprunteur" ? pseudo : "";
    if (!commonRegex.test(userInput)) {
      showToast("Nom d'utilisateur non valide", true);
      return false;
    }
    if (role === "loueur") {
      const brandValid = commonRegex.test(selectedBrand.value);
      const modelValid = commonRegex.test(model);
      const serialNumberValid = commonRegex.test(serialNumber);
      const registrationNumberValid = commonRegex.test(registrationNumber);
      if (
        !brandValid ||
        !modelValid ||
        !serialNumberValid ||
        !registrationNumberValid
      ) {
        showToast(
          "Marque, modèle, numéro de série ou numéro d'immatriculation non valide",
          true
        );
        return false;
      }
    } else if (role === "emprunteur") {
      if (
        selectedType.value !== "Sport" &&
        selectedType.value !== "Urbain" &&
        selectedType.value !== "Tout terrain"
      ) {
        showToast("Type de vélo non valide", true);
        return false;
      }
    }
    return true;
  };

  const blockChainRegistration = async (role) => {
    if (!validateInputs(role)) {
      return;
    }
    const whitelistAbi =
      role === "loueur"
        ? lenderWhitelistAbi
        : role === "emprunteur"
        ? renterWhitelistAbi
        : "";
    const whitelistAddress =
      role === "loueur"
        ? lenderWhitelistAddress
        : role === "emprunteur"
        ? renterWhitelistAddress
        : "";
    const eventToWatch =
      role === "loueur"
        ? "LenderWhitelisted"
        : role === "emprunteur"
        ? "RenterWhitelisted"
        : "";
    const successMessage =
      role === "loueur"
        ? "Vélo enregistré sur la blockchain"
        : role === "emprunteur"
        ? "Emprunteur enregistré sur la blockchain"
        : "";
    if (!whitelistAddress || !whitelistAbi || !eventToWatch || !successMessage)
      return;
    try {
      const signer = web3Provider?.getSigner();
      const whitelistContract = new Contract(
        whitelistAddress,
        whitelistAbi,
        signer
      );
      const tx =
        role === "loueur"
          ? await whitelistContract.setBikeInfoAndMint(
              username,
              selectedBrand.value,
              model,
              serialNumber,
              registrationNumber
            )
          : await whitelistContract.setRenterInfoAndMint(
              pseudo,
              selectedType.value
            );
      whitelistContract.once(eventToWatch, (address, NFTId, event) => {
        console.log("event", event, "address", address, "NFTId", NFTId);
      });
      await tx.wait();
      console.log(successMessage);
      showToast(successMessage);
    } catch (error) {
      console.log(error);
      showToast("Erreur lors de l'enregistrement sur la blockchain", true);
      throw new Error("Une erreur est survenue");
    }
  };

  const registerUser = async () => {
    if (!validateInputs(role)) {
      return;
    }
    if (RDV[0] === "" || RDV[1] === "") {
      showToast("Données GPS manquantes", true);
      return;
    }
    if (RDV[0] === "-48.876667" && RDV[1] === "-123.393333") {
      showToast("Le point Nemo n'est pas praticable à vélo", true);
      return;
    }
    const latRegex =
      /^(\+|-)?(?:90(?:(?:\.0{1,6})?)|(?:[0-9]|[1-8][0-9])(?:(?:\.[0-9]{1,6})?))$/;
    const lonRegex =
      /^(\+|-)?(?:180(?:(?:\.0{1,6})?)|(?:[0-9]|[1-9][0-9]|1[0-7][0-9])(?:(?:\.[0-9]{1,6})?))$/;
    if (!latRegex.test(RDV[0]) || !lonRegex.test(RDV[1])) {
      showToast("Données GPS invalides", true);
      return;
    }
    try {
      setLoader(true);
      await blockChainRegistration(role);
    } catch (error) {
      showToast("Problème lors de l'inscription", true);
      setLoader(false);
      return;
    }
    try {
      const response = await fetch("/api/registerUser", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name:
            role === "loueur" ? username : role === "emprunteur" ? pseudo : "",
          ethereumAddress: address,
          role,
          latitude: RDV[0],
          longitude: RDV[1],
          update: false,
        }),
      });
      const data = await response.json();
      console.log("Utilisateur enregistré sur la BDD:", data.message);
      showToast("Inscription réalisée avec succés !");
      await checkUser();
    } catch (error) {
      showToast("Problème lors de l'inscription", true);
      throw error;
    } finally {
      setLoader(false);
    }
  };

  const { handleImageUpload } = useImageClassifier(
    address,
    network,
    showToast,
    setImage,
    setLoader,
    setCropping
  );

  const checkPhotoLender = async () => {
    if (!address) return;
    if (!network) return;
    try {
      const response = await fetch("/api/checkPhotoLender", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ethereumAddress: address, toGet: false }),
      });
      const data = await response.json();
      if (data.exists) {
        setPhotoExists(true);
      } else {
        console.log("photo does not exist");
        throw new Error("Une erreur est survenue");
      }
    } catch (error) {
      console.log(error);
      showToast("Photo non trouvée !", true);
    }
  };

  const checkUser = async (checkTof = true) => {
    if (!address) return;
    if (!network) return;
    try {
      setLoader(true);
      const response = await fetch("/api/checkUser", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ethereumAddress: address }),
      });
      const data = await response.json();
      if (data.exists) {
        if (
          data.role &&
          (data.role === "loueur" || data.role === "emprunteur")
        ) {
          setUserExists(true);
          setRole(data.role);
          setName(data.name);
          checkTof && data.role === "loueur" && (await checkPhotoLender());
        } else {
          showToast("Aucun rôle trouvé", true);
          setTimeout(() => {
            disconnect();
          }, 2000);
        }
      } else {
        console.log("user does not exist");
      }
    } catch (error) {
      console.log("Erreur lors de la vérification de l'utilisateur:", error);
      showToast("Problème lors de la vérification de l'utilisateur", true);
    } finally {
      setLoader(false);
    }
  };

  useEffect(() => {
    setRole("");
    setName("");
    setUserExists(false);
    setPhotoExists(false);
    setImage(null);
    setRDV([]);
    setSelectedBrand({ label: "", value: "" });
    setLoader(false);
    setUsername("");
    setSerialNumber("");
    setRegistrationNumber("");
    setSelectedType({ value: "", label: "" });
    setCropping(false);
    setPseudo("");
    checkUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  useEffect(() => {
    if (searchTerm) {
      setSelectedBrand({
        label: DOMPurify.sanitize(searchTerm)
          .replace(/</g, "")
          .replace(/&lt;/g, "")
          .replace(/&gt;/g, "")
          .replace(/>/g, ""),
        value: DOMPurify.sanitize(searchTerm)
          .replace(/</g, "")
          .replace(/&lt;/g, "")
          .replace(/&gt;/g, "")
          .replace(/>/g, ""),
      });
    }
  }, [searchTerm]);

  useEffect(() => {
    if (address && network) {
      if (network.chainId !== 1337 && network.chainId !== 80001) {
        alert(
          "Veuillez vous connecter au réseau de test Matic Mumbai ou au réseau de développement local !"
        );
        disconnect();
      }
      setLenderWhitelistAddress(
        LenderWhitelist.networks[network.chainId]?.address
      );
      setRenterWhitelistAddress(
        RenterWhitelist.networks[network.chainId]?.address
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network, address]);

  return (
    <div style={{ paddingTop: "350px" }}>
      <div className="container-fluid">
        {!address && (
          <div className="row welcome-message">
            Veuillez connecter votre wallet sur Polygon Mumbai pour accéder à
            l&apos;application ! 👆🏽
          </div>
        )}
        <div style={{ width: "90%", margin: "auto" }}>
          {address && !userExists && (
            <div className="welcome-container">
              {!loader ? (
                <>
                  <div style={{ marginTop: "-500px" }}>
                    <h1 className="title">
                      Bienvenue sur notre site de location de vélo décentralisée
                      ! <br />
                      Prêt à vous inscrire ? <br />
                      C&apos;est parti !
                    </h1>
                    <p className="description">
                      Pour commencer, veuillez indiquer le rôle qui vous
                      convient:
                    </p>

                    <div className="selection-container">
                      <select
                        className="form-select role-select"
                        value={role}
                        onChange={handleRoleChange}
                      >
                        <option value="" disabled>
                          Choisissez votre rôle
                        </option>
                        <option value="loueur">Loueur</option>
                        <option value="emprunteur">Emprunteur</option>
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ marginTop: "-280px" }}>
                  <p className="text-center fs-4">Vérification des données</p>
                  <SpecialLoader />
                </div>
              )}
              {role && (
                <>
                  <div className="instructions text-center fs-5">
                    <p>
                      Bien ! Vous désirez être{" "}
                      <strong style={{ color: "red" }}>{role}</strong> ! <br />
                      Commencez par vous{" "}
                      <span style={{ color: "red" }}>localiser</span> sur la
                      carte, ou{" "}
                      <span style={{ color: "red" }}>entrer une adresse</span>,
                      afin de trouver un lieu de{" "}
                      <span style={{ color: "red" }}>rendez-vous adapté</span>{" "}
                      pour{" "}
                      {role === "loueur"
                        ? "prêter votre vélo."
                        : "emprunter un vélo pas trop loin de chez vous !"}{" "}
                      <br />
                      <strong>
                        Pour protéger votre vie privée, nous vous conseillons de
                        ne pas sélectionner votre domicile, mais plutôt un lieu
                        public, en cliquant sur la carte.
                      </strong>{" "}
                      <br />
                      Pourquoi pas partager un café avant de rouler ? 😀{" "}
                    </p>
                    <hr />
                    <p>
                      Localisez-vous puis cliquez sur un lieu de rendez-vous qui
                      vous intéresse: un marqueur{" "}
                      <span style={{ color: "blue" }}>bleu</span> apparaîtra.
                    </p>
                  </div>

                  <MapComponent
                    setRDV={setRDV}
                    RDV={RDV}
                    showToast={showToast}
                  />
                  <div
                    className="text-center fs-5"
                    style={{ maxWidth: "1000px" }}
                  >
                    <hr />
                    <p>
                      Plus qu&apos;à remplir ce petit formulaire ! Un{" "}
                      <strong>NFT</strong> contenant les informations de votre
                      vélo sera envoyé sur votre wallet, et votre contrat{" "}
                      <strong>{role}</strong> sera généré. Vous serez en mesure
                      de gérer vos locations depuis cette application.
                    </p>
                  </div>
                  {role === "loueur" ? (
                    <BikeLenderForm
                      username={username}
                      onUsernameChange={setUsername}
                      selectedBrand={selectedBrand}
                      onBrandChange={setSelectedBrand}
                      serialNumber={serialNumber}
                      onSerialNumberChange={setSerialNumber}
                      registrationNumber={registrationNumber}
                      onRegistrationNumberChange={setRegistrationNumber}
                      onSearchTermChange={setSearchTerm}
                      onModelBikeChange={setModel}
                      model={model}
                    />
                  ) : role === "emprunteur" ? (
                    <BikeRenterForm
                      pseudo={pseudo}
                      onPseudoChange={setPseudo}
                      selectedType={selectedType}
                      onTypeChange={setSelectedType}
                    />
                  ) : null}
                  <button disabled={loader} onClick={registerUser}>
                    M&apos;inscrire !
                  </button>
                  <br />
                  <Footer />
                </>
              )}
            </div>
          )}
          {address && role === "loueur" && userExists && !photoExists && (
            <>
              <div className="animate__animated animate__zoomIn">
                {!loader ? (
                  <div>
                    <h2 className="text-center fs-4 m-5">
                      Qui voudrait louer un vélo sans le voir avant ? Uploadez
                      la photo de votre vélo ici !
                    </h2>
                    {cropping && <Loader />}
                    <label
                      className="submit _coverImage-holder btn btn-info"
                      style={{
                        display: "block",
                        marginTop: "20px",
                        color: "lightgrey",
                        fontFamily: "Comic Relief",
                        fontSize: "1.6em",
                        paddingBottom: "45px",
                        maxHeight: "45px",
                        background: "black",
                      }}
                    >
                      Upload Image
                      <input
                        type="file"
                        name="cover"
                        onChange={handleImageUpload}
                        accept="img/*"
                        style={{ display: "none" }}
                        disabled={cropping || loader}
                      />
                    </label>
                  </div>
                ) : (
                  <div>
                    <p className="text-center fs-4">Vérification des données</p>
                    <SpecialLoader />
                  </div>
                )}
              </div>
              {image && (
                <div className="crop-container">
                  <ImageCropper
                    props={{
                      image,
                      setImage,
                      setLoader,
                      loader,
                      setCropping,
                      showToast,
                      checkUser,
                      checkPhotoLender,
                    }}
                  />
                </div>
              )}
            </>
          )}
          {address &&
            userExists &&
            (role === "loueur" || role === "emprunteur") &&
            (role !== "loueur" || photoExists) && (
              <div style={{ marginTop: "-350px" }}>
                <UserDashboard
                  props={{
                    role,
                    showToast,
                    lenderWhitelistAddress,
                    renterWhitelistAddress,
                    lenderWhitelistAbi,
                    renterWhitelistAbi,
                    checkPhotoLender,
                    name,
                  }}
                />
              </div>
            )}
        </div>
      </div>

      <ToastContainer />
    </div>
  );
}
