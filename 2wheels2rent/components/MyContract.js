import { useEffect, useState, useCallback, useRef } from "react";
import { ethers } from "ethers";
import Loader from "./Loader";
import Image from "next/image";
import W2R from "../private/W2R.png";
import QRCode from "qrcode.react";

const MyContract = ({
  userInfos,
  setModalContract,
  role,
  userCoordinates,
  showToast,
  unsubscribe,
  setLoaderContract,
  loaderContract,
  w2Rcontract,
  contract,
  address,
  w2rUserBalance,
  getW2Rbalance,
  activated,
  setActivated,
  w2rAddress,
  gasPrice,
}) => {
  const { contractAddress } = userInfos;

  const [maxDuration, setMaxDuration] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [w2rRate, setW2rRate] = useState(0);
  const [checks, setChecks] = useState([false, false, false]);
  const [w2rBalance, setW2rBalance] = useState(0);
  const [amount, setAmount] = useState(0);
  const [allowance, setAllowance] = useState(0);
  const [rewards, setRewards] = useState(0);
  const [action, setAction] = useState("deposit");
  const [QrW2R, setQrW2R] = useState(false);
  const W2Rref = useRef(null);

  const handleClickOutside = (event) => {
    if (W2Rref.current && !W2Rref.current.contains(event.target)) {
      setQrW2R(false);
    }
  };

  const hasTooManyDecimals = (amount) => {
    if (typeof amount !== "string") {
      amount = amount.toString();
    }
    const formattedAmount = amount.replace(",", ".");
    if (
      Number(formattedAmount) &&
      formattedAmount.split(".")[1] &&
      formattedAmount.split(".")[1].length > 18
    ) {
      showToast("Montant invalide", true);
      return true;
    }
    return false;
  };

  const checkValues = useCallback(async () => {
    try {
      setLoaderContract(true);
      if (activated) {
        const reward = await contract.getTotalRewards();
        setRewards(Number(ethers.utils.formatEther(reward)));
        const gps = await contract.gpsData(contract.address);
      }
      if (role === "loueur") {
        setMaxDuration((await contract.maximumRental()) / 86400);
        setDeposit(
          ethers.utils.formatEther(await contract.depositAmount()).split(".")[0]
        );
        setW2rRate(
          ethers.utils.formatEther(await contract.rate()).split(".")[0]
        );
      }
    } catch (err) {
      console.log(err);
    } finally {
      setLoaderContract(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract, role, setLoaderContract]);

  const convertGPS = () => {
    return userCoordinates.map((coord) => coord.toFixed(6).toString());
  };

  const getContractW2Rbalance = useCallback(async () => {
    try {
      const balance = await w2Rcontract.balanceOf(contractAddress);
      setW2rBalance(Number(ethers.utils.formatEther(balance)));
    } catch (err) {
      console.log(err);
    }
  }, [contractAddress, w2Rcontract]);

  const handleActivateOrModify = async (e) => {
    e.preventDefault();
    setLoaderContract(true);
    try {
      if (!activated) {
        const gps = convertGPS();
        if (
          gps[0] === "" ||
          gps[1] === "" ||
          typeof gps[0] !== "string" ||
          typeof gps[1] !== "string"
        ) {
          showToast("Problème avec les données GPS", true);
          return;
        }
        const tx = await contract.activate(gps[0], gps[1], {
          gasPrice: gasPrice,
        });
        await tx.wait();
        setActivated(true);
        contract.once("ContractActivated", (owner, date, contAddress) => {
          console.log("ContractActivated", owner, date, contAddress);
          showToast("Contrat " + contAddress + " activé");
        });
      }
      if (role === "loueur") {
        if (w2rRate < 100 || deposit < 200 || maxDuration < 1) return;
        if (w2rRate % 1 !== 0 || deposit % 1 !== 0 || maxDuration % 1 !== 0)
          return;
        const w2rrate = ethers.utils.parseEther(w2rRate.toString());
        const Deposit = ethers.utils.parseEther(deposit.toString());
        const maxDurationInSeconds = maxDuration * 86400;

        const check1 =
          w2rRate !==
          ethers.utils.formatEther(await contract.rate()).split(".")[0];
        const check2 =
          deposit !==
          ethers.utils
            .formatEther(await contract.depositAmount())
            .split(".")[0];
        const check3 = maxDuration !== (await contract.maximumRental()) / 86400;
        // count how many checks are true
        const numChecks = [check1, check2, check3].filter((check) => check);
        if (numChecks.length !== 0) {
          alert(
            "Vous aurez besoin de " +
              numChecks.length +
              " signature" +
              (numChecks.length > 1 ? "s" : "") +
              " pour mettre à jour le contrat"
          );
        }

        if (check1) {
          const tx1 = await contract.setRate(w2rrate, { gasPrice: gasPrice });
          await tx1.wait();
        }
        if (check2) {
          const tx2 = await contract.setDepositAmount(Deposit, {
            gasPrice: gasPrice,
          });
          await tx2.wait();
        }
        if (check3) {
          const tx3 = await contract.setMaximumRental(maxDurationInSeconds, {
            gasPrice: gasPrice,
          });
          await tx3.wait();
        }

        if (check1 || check2 || check3) {
          setChecks([check1, check2, check3]);
          showToast("Contrat mis à jour");
          checkValues();
        }
      }
    } catch (err) {
      console.log(err);
      showToast(
        !activated
          ? "Erreur lors de l'activation du contrat"
          : "Erreur lors de la modification du contrat",
        true
      );
    } finally {
      setLoaderContract(false);
    }
  };

  const validateConditions = () => {
    if (!address) return false;
    if (!contractAddress) return false;
    if (!w2Rcontract) return false;
    return true;
  };

  const handleDepositW2R = async (e) => {
    e.preventDefault();
    if (!validateConditions()) return;
    if (!amount) {
      showToast("Veuillez entrer un montant", true);
      return;
    }
    if (Number(amount) > allowance) {
      showToast("Vous n'avez pas assez autorisé de W2R ", true);
      return;
    }
    if (Number(amount) > w2rUserBalance) {
      showToast("Vous n'avez pas assez de W2R ", true);
      return;
    }
    if (hasTooManyDecimals(amount)) {
      return;
    }
    setLoaderContract(true);
    try {
      const decimals = await w2Rcontract.decimals();
      const amountWei = ethers.utils.parseUnits(amount, decimals);
      const tx = await contract.depositW2R(amountWei, { gasPrice: gasPrice });
      await tx.wait();
      contract.once("W2Rdeposited", (owner, amount, date, contract) => {
        console.log("W2Rdeposited", owner, amount, date, contract);
        showToast(
          Number(ethers.utils.formatUnits(amount, decimals)) + " W2R déposés"
        );
      });
      getW2Rbalance();
      getContractW2Rbalance();
    } catch (err) {
      console.log(err);
      showToast("Erreur lors du dépôt de W2R", true);
    } finally {
      await getAllowance();
      setAmount(0);
    }
  };

  const getAllowance = useCallback(async () => {
    if (!validateConditions()) return;
    setLoaderContract(true);
    try {
      const allowance = await w2Rcontract.allowance(address, contractAddress);
      const decimals = await w2Rcontract.decimals();
      const allowanceInW2R = ethers.utils.formatUnits(allowance, decimals);
      setAllowance(Number(allowanceInW2R));
    } catch (err) {
      console.log(err);
    } finally {
      setLoaderContract(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, contractAddress, w2Rcontract]);

  const handleWithdrawW2R = async (e) => {
    e.preventDefault();
    if (!validateConditions()) return;
    if (!amount) {
      showToast("Veuillez entrer un montant", true);
      return;
    }
    if (Number(amount) > w2rBalance) {
      showToast("Vous n'avez pas assez de W2R dans le contrat", true);
      return;
    }
    if (hasTooManyDecimals(amount)) {
      return;
    }
    setLoaderContract(true);
    try {
      const decimals = await w2Rcontract.decimals();
      const amountWei = ethers.utils.parseUnits(amount, decimals);
      const tx = await contract.withdrawFunds(amountWei, {
        gasPrice: gasPrice,
      });
      await tx.wait();
      getW2Rbalance();
      getContractW2Rbalance();
      showToast("W2R retirés");
    } catch (err) {
      console.log(err);
      showToast("Erreur lors du retrait de W2R", true);
    } finally {
      setAmount(0);
      setLoaderContract(false);
    }
  };

  const handleEnableW2R = async (e) => {
    e.preventDefault();
    setLoaderContract(true);
    if (hasTooManyDecimals(amount)) {
      return;
    }
    try {
      const decimals = await w2Rcontract.decimals();
      const amountWei = ethers.utils.parseUnits(amount, decimals);
      const tx = await w2Rcontract.approve(contractAddress, amountWei, {
        gasPrice: gasPrice,
      });
      await tx.wait();
      getAllowance();
      w2Rcontract.once("Approval", (owner, spender, amount) => {
        console.log("Approval", owner, spender, amount);
        const formatAmount = Number(ethers.utils.formatUnits(amount, decimals));
        formatAmount > 0 &&
          showToast(
            "W2R autorisé pour le contrat à hauteur de " + formatAmount + " W2R"
          );
      });
    } catch (err) {
      console.log(err);
    } finally {
      setLoaderContract(false);
    }
  };

  const handleClaimRewards = async (e) => {
    e.preventDefault();
    if (!validateConditions()) return;
    if (rewards === 0) {
      showToast("Vous n'avez pas de récompenses à réclamer", true);
      return;
    }
    setLoaderContract(true);
    try {
      const decimals = await w2Rcontract.decimals();
      const tx = await contract.claimRewards({ gasPrice: gasPrice });
      await tx.wait();
      contract.once("RewardClaimed", (owner, date, amount, contract) => {
        console.log("RewardClaimed", owner, date, amount, contract);
        showToast(
          Number(ethers.utils.formatUnits(amount, decimals)) + " W2R réclamés !"
        );
      });
      getW2Rbalance();
      getContractW2Rbalance();
    } catch (err) {
      console.log(err);
      showToast("Erreur lors de la réclamation des récompenses", true);
    } finally {
      checkValues();
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(w2rAddress);
      showToast("Contrat du W2R copié !");
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    checkValues();
    getContractW2Rbalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activated, checks, checkValues]);

  useEffect(() => {
    getAllowance();
    document.addEventListener("click", handleClickOutside, true);
    return () => {
      document.removeEventListener("click", handleClickOutside, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="modalContract">
      <div className="bike-rental-form">
        <button
          type="button"
          className="closeButton btn btn-success"
          onClick={() => setModalContract(false)}
        >
          &times;
        </button>
        {loaderContract ? (
          <Loader />
        ) : (
          <h2>{activated ? "Gestion" : "Activation requise"}</h2>
        )}

        <hr />
        <div className="fs-5">
          Votre contrat:{" "}
          <span style={{ color: "green", wordBreak: "break-all" }}>
            {contractAddress}
          </span>
          <br />
          {activated && (
            <>
              <span>W2R sur votre contrat (10 W2R = 1 MATIC): </span>
              <span style={{ color: "red" }}>{w2rBalance.toFixed(2)}</span>
              <br />
              Vous avez autorisé ce contrat à y déposer jusqu&apos;à{" "}
              <span style={{ color: "red" }}>
                {allowance.toFixed(2)} de vos W2R
              </span>
              <div className="input-group m-4">
                Récompenses accumulées:
                <span
                  style={{
                    color: "red",
                    marginLeft: "5px",
                    marginRight: "5px",
                  }}
                >
                  {rewards.toFixed(2)}
                </span>
                W2R
                <button
                  type="button"
                  disabled={rewards === 0 || loaderContract}
                  onClick={handleClaimRewards}
                  className="btn btn-info"
                  style={{
                    marginLeft: "5px",
                    marginTop: "-5px",
                    borderRadius: "5px",
                  }}
                >
                  Réclamer
                </button>
              </div>
            </>
          )}
        </div>
        {activated && (
          <>
            <hr />

            <label htmlFor="w2r-amount" className="fs-5">
              <span
                style={{
                  color: `${action === "deposit" ? "orangered" : "black"}`,
                  cursor: `${action === "deposit" ? "none" : "pointer"}`,
                }}
                onClick={() => {
                  setAmount(0);
                  setAction("deposit");
                }}
              >
                Déposer
              </span>{" "}
              /{" "}
              <span
                style={{
                  color: `${action === "withdraw" ? "orangered" : "black"}`,
                  cursor: `${action === "withdraw" ? "none" : "pointer"}`,
                }}
                onClick={() => {
                  setAmount(0);
                  setAction("withdraw");
                }}
              >
                Retirer
              </span>{" "}
              W2R:
            </label>

            <div className="input-group">
              <input
                type="number"
                id="w2r-amount"
                min="1"
                value={amount}
                required
                style={{ marginLeft: "10px", width: "200px" }}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    !(
                      /[0-9]/.test(e.key) ||
                      e.key === "Backspace" ||
                      e.key === "ArrowLeft" ||
                      e.key === "ArrowRight" ||
                      e.key === "Tab"
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
                onPaste={(e) => e.preventDefault()}
              />
              <button
                type="button"
                className="btn btn-sm"
                onClick={
                  action === "deposit"
                    ? () => setAmount(w2rUserBalance)
                    : action === "withdraw"
                    ? () => setAmount(w2rBalance)
                    : null
                }
                style={{
                  marginTop: "1px",
                  height: "40px",
                  color: "orangered",
                  zIndex: "0",
                }}
              >
                Max
              </button>
            </div>
            <div className="image-container">
              <Image width={200} height={200} src={W2R} alt="W2R token" />
            </div>
            {action === "withdraw" && (
              <div style={{ marginTop: "1.7rem" }}>
                <br />
                <button
                  type="button"
                  className="btn btn-warning contractButton"
                  onClick={handleWithdrawW2R}
                  disabled={loaderContract}
                >
                  Retirer des W2R vers mon wallet
                </button>
              </div>
            )}
            {action === "deposit" && (
              <>
                {Number(amount) > allowance ? (
                  <div>
                    <button
                      type="button"
                      className="btn btn-info"
                      onClick={handleEnableW2R}
                      style={{ marginBottom: "0.5rem" }}
                      disabled={loaderContract}
                    >
                      Autoriser W2R pour déposer
                    </button>
                    <p className="text-center fs-6">
                      Pour un dépôt de W2R dans ce contrat, vous devez
                      l&apos;autoriser à prendre {Number(amount)} W2R dans votre
                      wallet.
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleDepositW2R}
                    disabled={loaderContract}
                  >
                    Déposer les W2R dans ce contrat
                  </button>
                )}
              </>
            )}
            <br />
            <p
              style={{
                color: "skyblue",
                wordBreak: "break-all",
                marginTop: "10px",
              }}
            >
              Contrat du W2R:{" "}
              <span
                style={{ cursor: "pointer", color: "green" }}
                onMouseOver={() => setQrW2R(true)}
                onMouseOut={() => setQrW2R(false)}
                onClick={() => setQrW2R(!QrW2R)}
              >
                {w2rAddress}
              </span>{" "}
              <span onClick={handleCopy} style={{ cursor: "pointer" }}>
                💾
              </span>
            </p>
          </>
        )}

        {role === "loueur" && (
          <div>
            <hr />
            {activated
              ? "Vous pouvez modifier vos paramètres:"
              : "Veuillez entrer vos choix pour activer votre contrat:"}

            <form onSubmit={handleActivateOrModify}>
              <label htmlFor="maxDuration" className="fs-5">
                Durée maximale de location (en jours):
              </label>
              <input
                type="number"
                id="maxDuration"
                min="1"
                value={maxDuration}
                required
                onChange={(e) => setMaxDuration(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    !(
                      /[0-9]/.test(e.key) ||
                      e.key === "Backspace" ||
                      e.key === "ArrowLeft" ||
                      e.key === "ArrowRight" ||
                      e.key === "Tab"
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
                onPaste={(e) => e.preventDefault()}
              />
              <label htmlFor="deposit" className="fs-5">
                Montant du dépôt de garantie (en W2R):
              </label>
              <input
                type="number"
                id="deposit"
                min="200"
                value={deposit}
                required
                onChange={(e) => setDeposit(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    !(
                      /[0-9]/.test(e.key) ||
                      e.key === "Backspace" ||
                      e.key === "ArrowLeft" ||
                      e.key === "ArrowRight" ||
                      e.key === "Tab"
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
                onPaste={(e) => e.preventDefault()}
              />

              <label htmlFor="w2rRate" className="fs-5">
                Prix de la location en tokens W2R par jour:
              </label>
              <input
                type="number"
                id="w2rRate"
                min="100"
                value={w2rRate}
                required
                onChange={(e) => setW2rRate(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    !(
                      /[0-9]/.test(e.key) ||
                      e.key === "Backspace" ||
                      e.key === "ArrowLeft" ||
                      e.key === "ArrowRight" ||
                      e.key === "Tab"
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
                onPaste={(e) => e.preventDefault()}
              />
              <button
                type="submit"
                className="btn btn-success fs-5"
                disabled={loaderContract}
              >
                {!activated ? "Activer" : "Modifier"}
              </button>
            </form>
          </div>
        )}
        {role === "emprunteur" && (
          <>
            {!activated && (
              <div>
                <h2>Veuillez Activer votre contrat !</h2>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleActivateOrModify}
                  disabled={loaderContract}
                >
                  Activer
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {activated && (
        <>
          <hr />
          <button
            type="button"
            className="btn btn-danger fs-6"
            onClick={unsubscribe}
            disabled={loaderContract}
            style={{ margin: "auto", display: "block" }}
          >
            Se désinscrire
          </button>
          <p className="fs-6 text-center m-2">
            Cette action est <span style={{ color: "red" }}>irréversible</span>:
            votre contrat et votre NFT seront détruits.
            <br /> Les W2R détenus par ce contrat seront transférés à votre
            wallet.
            <br />
            Si une location est en cours, vous ne pourrez pas vous désinscrire
            avant la date de fin de celle-ci + 2 jours, par mesure de sécurité.
          </p>
        </>
      )}
      {w2rAddress && QrW2R && (
        <div className="qr-overlay" ref={W2Rref}>
          <div className="qr-center">
            <QRCode value={QrW2R && w2rAddress} />
          </div>
        </div>
      )}
    </div>
  );
};

export default MyContract;
