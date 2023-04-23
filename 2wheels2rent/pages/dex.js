import { useEffect, useState, useCallback } from "react";
import { ethers, Contract, utils } from "ethers";
import { useWeb3Context } from "../context/";
import useAddTokenToMetaMask from "../hooks/useAddTokenToMetamask";
import W2R from "../contracts/W2R.json";
import MaticW2Rdex from "../contracts/MaticW2Rdex.json";
import MaticW2RPairToken from "../contracts/MaticW2RPairToken.json";
import { toast, ToastContainer } from "react-toastify";
import Footer from "../components/Footer";
import Loader from "../components/Loader";
import Image from "next/image";
import W2Rpicture from "../private/W2R.png";
import W2Rmini from "../private/W2Rmini.png";
import LPmini from "../private/LPmini.png";

const Dex = () => {
  const { web3Provider, address, network, provider, disconnect } =
    useWeb3Context();
  const addToken = useAddTokenToMetaMask();
  const showToast = (message, type = false) => {
    if (!type) {
      toast.success(message, { closeOnClick: true, pauseOnHover: false });
    } else {
      toast.error(message, { closeOnClick: true, pauseOnHover: false });
    }
  };

  const [userBalances, setUserBalances] = useState({
    matic: 0,
    w2r: 0,
    lpToken: 0,
  });
  const [contractBalances, setContractBalances] = useState({
    matic: 0,
    w2r: 0,
    lpToken: 0,
  });

  const [W2Raddress, setW2Raddress] = useState("");
  const [dexAddress, setDexAddress] = useState("");
  const [pairTokenAddress, setPairTokenAddress] = useState("");
  const W2Rabi = W2R.abi;
  const dexABI = MaticW2Rdex.abi;
  const pairTokenABI = MaticW2RPairToken.abi;
  const signer = web3Provider?.getSigner();
  const [W2Rcontract, setW2Rcontract] = useState();
  const [dexContract, setDexContract] = useState();
  const [pairTokenContract, setPairTokenContract] = useState();
  const [swapMaticAmount, setSwapMaticAmount] = useState("");
  const [maticAmount, setMaticAmount] = useState("");
  const [w2rAmount, setW2RAmount] = useState("");
  const [lpTokenAmountToRemove, setLpTokenAmountToRemove] = useState("");
  const [lpTokenAmountToStake, setLpTokenAmountToStake] = useState("");
  const [swapW2RAmount, setSwapW2RAmount] = useState("");
  const [farmedLP, setFarmedLP] = useState(0);
  const [rewards, setRewards] = useState(0);
  const [feesPercentage, setFeesPercentage] = useState(0);
  const [swapDirection, setSwapDirection] = useState("MaticToW2R");
  const [swapRate, setSwapRate] = useState(0);
  const [rewardRate, setRewardRate] = useState(0);
  const [loading, setLoading] = useState(false);
  const [w2rToken, setW2RToken] = useState({});
  const [LPToken, setLPToken] = useState({});
  // testing purpose
  const [testAmount, setTestAmount] = useState(0);

  const validateConditions = () => {
    if (!address) return false;
    if (!web3Provider) return false;
    if (!network) return false;
    if (!dexAddress) return false;
    if (!W2Rcontract) return false;
    if (!pairTokenContract) return false;
    return true;
  };

  const toggleSwapDirection = () => {
    setSwapDirection(
      swapDirection === "MaticToW2R" ? "W2RToMatic" : "MaticToW2R"
    );
  };

  const swapW2RForMatic = async () => {
    if (Number(swapW2RAmount) === 0) return;
    setLoading(true);
    try {
      await handleEnableW2R(swapW2RAmount.toString());
    } catch (error) {
      console.error("Erreur lors de l'autorisation:", error);
      setLoading(false);
      return;
    }
    try {
      const amountToSwap = ethers.utils.parseUnits(
        swapW2RAmount.toString(),
        18
      );
      const tx = await dexContract.swapW2RForMatic(amountToSwap.toString(), {
        gasLimit: 300000,
      });
      await tx.wait();
      fetchBalances();
      dexContract.once(
        "SwapW2RForMatic",
        (user, w2rAmount, maticAmount, date) => {
          console.log(
            "user",
            user,
            "W2R",
            w2rAmount,
            "MATIC",
            maticAmount,
            date
          );
          showToast(
            `Swap effectué avec succès: ${Number(
              ethers.utils.formatUnits(w2rAmount, 18)
            ).toFixed(2)} W2R pour ${Number(
              ethers.utils.formatEther(maticAmount)
            ).toFixed(2)} MATIC`
          );
        }
      );
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
      showToast("Erreur lors du swap", true);
    } finally {
      setSwapMaticAmount("");
      setSwapW2RAmount("");
    }
  };

  const swapMaticForW2R = async () => {
    if (!validateConditions()) return;
    if (Number(swapMaticAmount) === 0) return;
    setLoading(true);
    try {
      const amountToSwap = ethers.utils.parseEther(swapMaticAmount.toString());
      const tx = await dexContract.swapMaticForW2R({
        value: amountToSwap,
        gasLimit: 300000,
      });
      await tx.wait();
      fetchBalances();
      dexContract.once(
        "SwapMaticForW2R",
        (user, maticAmount, w2rAmount, date) => {
          console.log(
            "user",
            user,
            "MATIC",
            maticAmount,
            "W2R",
            w2rAmount,
            date
          );
          showToast(
            `Swap effectué avec succès: ${Number(
              ethers.utils.formatEther(maticAmount)
            ).toFixed(2)} MATIC pour ${Number(
              ethers.utils.formatUnits(w2rAmount, 18)
            ).toFixed(2)} W2R`
          );
        }
      );
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
      showToast("Erreur lors du swap", true);
    } finally {
      setSwapMaticAmount("");
      setSwapW2RAmount("");
    }
  };

  const addLiquidity = async () => {
    if (!validateConditions()) return;
    if (Number(w2rAmount) === 0 || Number(maticAmount) === 0) {
      return;
    }

    try {
      const ratio = parseFloat(w2rAmount) / parseFloat(maticAmount);
      const targetRatio = swapRate;
      const lowerBound = targetRatio * 0.97;
      const upperBound = targetRatio * 1.03;
      if (ratio < lowerBound || ratio > upperBound) {
        showToast(
          `Veuillez fournir des montants qui respectent un ratio d'environ ${swapRate} W2R pour 1 MATIC.`,
          true
        );
        return;
      }
      setLoading(true);
      await handleEnableW2R(w2rAmount.toString());
    } catch (error) {
      console.error(error);
      setLoading(false);
      showToast("Erreur lors de l'autorisation", true);
      return;
    }
    try {
      const matic = ethers.utils.parseEther(maticAmount.toString(), 18);
      const w2r = ethers.utils.parseUnits(w2rAmount.toString(), 18);
      const tx = await dexContract.addLiquidity(w2r, {
        value: matic,
        gasLimit: 300000,
      });
      await tx.wait();
      fetchBalances();
      dexContract.once(
        "AddLiquidity",
        (user, maticAmount, w2rAmount, lpAmount) => {
          console.log(
            "user",
            user,
            "MATIC",
            maticAmount,
            "W2R",
            w2rAmount,
            "LP",
            lpAmount
          );
          showToast(
            `Ajout de liquidité effectué avec succès: ${Number(
              ethers.utils.formatEther(maticAmount)
            ).toFixed(2)} MATIC et ${Number(
              ethers.utils.formatUnits(w2rAmount, 18)
            ).toFixed(2)} W2R, Matic-W2R LP Tokens dans votre wallet.`
          );
        }
      );
      setLoading(false);
    } catch (error) {
      console.error("Erreur lors de l'ajout de liquidité:", error);
      setLoading(false);
    } finally {
      setW2RAmount("");
      setMaticAmount("");
    }
  };

  const removeLiquidity = async () => {
    if (!validateConditions()) return;
    if (
      Number(lpTokenAmountToRemove) === 0 ||
      Number(userBalances.lpToken) === 0
    ) {
      return;
    }
    if (Number(lpTokenAmountToRemove) > Number(userBalances.lpToken)) {
      showToast(
        "Vous ne pouvez pas retirer plus de liquidité que de LP Token en votre possession.",
        true
      );
      return;
    }
    setLoading(true);
    try {
      await handleEnableLP(lpTokenAmountToRemove.toString());
    } catch (error) {
      console.error(error);
      setLoading(false);
      showToast("Erreur lors de l'autorisation", true);
      return;
    }
    try {
      const lpTokenAmount = ethers.utils.parseUnits(
        lpTokenAmountToRemove.toString(),
        18
      );
      const tx = await dexContract.removeLiquidity(lpTokenAmount, {
        gasLimit: 300000,
      });
      await tx.wait();
      fetchBalances();
      dexContract.once(
        "RemoveLiquidity",
        (user, lpAmount, maticAmount, w2rAmount) => {
          console.log(
            "user",
            user,
            "LP",
            lpAmount,
            "MATIC",
            maticAmount,
            "W2R",
            w2rAmount
          );
          showToast(
            `Retrait de liquidité effectué avec succès en échange de ${Number(
              ethers.utils.formatUnits(lpAmount, 18)
            ).toFixed(2)} Matic-W2R LP Tokens`
          );
        }
      );
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
      showToast("Erreur lors du retrait de liquidité", true);
    } finally {
      setLpTokenAmountToRemove("");
    }
  };

  const farm = async () => {
    if (!validateConditions()) return;
    if (Number(lpTokenAmountToStake) === 0) return;
    if (Number(lpTokenAmountToStake) > Number(userBalances.lpToken)) {
      showToast(
        "Vous ne pouvez pas staker plus de LP Token que de LP Token en votre possession.",
        true
      );
      return;
    }
    setLoading(true);
    try {
      await handleEnableLP(lpTokenAmountToStake.toString());
    } catch (error) {
      console.error(error);
      setLoading(false);
      showToast("Erreur lors de l'autorisation", true);
      return;
    }
    try {
      const lpTokenAmount = ethers.utils.parseUnits(
        lpTokenAmountToStake.toString(),
        18
      );
      const tx = await dexContract.farm(lpTokenAmount, { gasLimit: 300000 });
      await tx.wait();
      fetchBalances();
      dexContract.once("Farm", (user, lpAmount, date) => {
        console.log("user", user, "LP", lpAmount, "date", date);
        showToast(
          `Staking effectué avec succès: ${Number(
            ethers.utils.formatUnits(lpAmount, 18)
          ).toFixed(2)} Matic-W2R LP Tokens stakés`
        );
      });
      setLoading(false);
    } catch (error) {
      console.error("Erreur lors du staking:", error);
      setLoading(false);
      showToast("Erreur lors du staking", true);
    } finally {
      setLpTokenAmountToStake("");
    }
  };

  const harvest = async () => {
    if (!validateConditions()) return;
    if (rewards === 0) {
      showToast(
        "Attendez quelques instants d'avoir une récompense à retirer",
        true
      );
      return;
    }
    setLoading(true);
    try {
      const tx = await dexContract.harvest({ gasLimit: 300000 });
      await tx.wait();
      fetchBalances();
      dexContract.once("Harvest", (user, rewards, date) => {
        console.log("user", user, "rewards", rewards, "date", date);
        showToast(
          `Harvest effectué avec succès: 
            ${Number(ethers.utils.formatUnits(rewards, 18)).toFixed(
              2
            )} W2R de récompenses récupérées`
        );
      });
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
      showToast("Erreur lors du harvest", true);
    }
  };

  const exitFarm = async () => {
    if (!validateConditions()) return;
    if (rewards === 0) {
      showToast(
        "Attendez quelques instants d'avoir une récompense à retirer",
        true
      );
      return;
    }
    setLoading(true);
    try {
      const tx = await dexContract.exitFarm({ gasLimit: 300000 });
      await tx.wait();
      fetchBalances();
      dexContract.once("ExitFarm", (user, lpAmount, date) => {
        console.log("user", user, "LP", lpAmount, "date", date);
        showToast(
          `Retrait du farming effectué avec succès: ${Number(
            ethers.utils.formatUnits(lpAmount, 18)
          ).toFixed(2)} Matic-W2R LP Tokens retirés avec récompenses en W2R`
        );
      });
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
      showToast("Erreur lors du retrait du farming", true);
    }
  };

  const handleEnableW2R = async (amount) => {
    try {
      const decimals = await W2Rcontract.decimals();
      const amountWei = ethers.utils.parseUnits(amount, decimals);
      const tx = await W2Rcontract.approve(dexAddress, amountWei);
      await tx.wait();
      W2Rcontract.once("Approval", (owner, spender, amount) => {
        console.log("Approval", owner, spender, amount);
      });
    } catch (err) {
      console.log(err);
    } finally {
    }
  };

  const handleEnableLP = async (amount) => {
    try {
      const decimals = await pairTokenContract.decimals();
      const amountWei = ethers.utils.parseUnits(amount, decimals);
      const tx = await pairTokenContract.approve(dexAddress, amountWei);
      await tx.wait();
      pairTokenContract.once("Approval", (owner, spender, amount) => {
        console.log("Approval", owner, spender, amount);
      });
    } catch (err) {
      console.log(err);
    } finally {
    }
  };

  const getMaticBalance = async () => {
    if (!validateConditions()) return;
    try {
      const balance = await web3Provider.getBalance(address);
      const matic = ethers.utils.formatEther(balance);
      return matic;
    } catch (err) {
      console.log(err);
    } finally {
    }
  };

  const fetchBalances = useCallback(async () => {
    if (!validateConditions()) return;
    setLoading(true);
    try {
      const MaticUser = await getMaticBalance();
      const [w2rUser, lptokenUser] = await dexContract?.getUserBalances();
      const [w2rContract, maticContract, lptokenContract] =
        await dexContract?.getContractBalances();
      setUserBalances({
        matic: Number(MaticUser).toFixed(4),
        w2r: Number(ethers.utils.formatEther(w2rUser)).toFixed(4),
        lpToken: Number(ethers.utils.formatEther(lptokenUser)).toFixed(4),
      });
      setContractBalances({
        matic: Number(ethers.utils.formatEther(maticContract)).toFixed(4),
        w2r: Number(ethers.utils.formatEther(w2rContract)).toFixed(4),
        lpToken: Number(ethers.utils.formatEther(lptokenContract)).toFixed(4),
      });
      const farmedLPtokens = await dexContract?.farming(address);
      setFarmedLP(
        Number(ethers.utils.formatEther(farmedLPtokens[1])) > 0
          ? Number(ethers.utils.formatEther(farmedLPtokens[1])).toFixed(4)
          : 0
      );
      const myRewards = await dexContract?.viewRewards();
      setRewards(
        Number(ethers.utils.formatEther(myRewards)) > 0
          ? Number(ethers.utils.formatEther(myRewards)).toFixed(6)
          : 0
      );
      const fees = await dexContract?.feesPercent();
      setFeesPercentage(Number(fees));
      const swaprate = await dexContract?.swapRate();
      setSwapRate(Number(swaprate));
      const rewardrate = await dexContract?.rewardRatePerSecond();
      const rewardRateFormatted = ethers.utils.parseUnits(
        rewardrate.toString(),
        2 // 100
      );
      const scaleFactor = ethers.utils.parseUnits("1", 18); // /1e18
      const secondsPerYear = 86400 * 365;
      const annualRewardRate = rewardRateFormatted
        .mul(secondsPerYear)
        .div(scaleFactor);

      setRewardRate(annualRewardRate.toString());
      // testing purposes
      const testW2Rtokens = await dexContract?.testAmount();
      setTestAmount(Number(ethers.utils.formatEther(testW2Rtokens)).toFixed(2));
      setLoading(false);
    } catch (error) {
      setLoading(false);
      console.error("Erreur lors de la récupération des balances:", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dexContract]);

  const handleCopy = async (address) => {
    try {
      await navigator.clipboard.writeText(address);
      showToast("Contrat copié !");
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTokenInfo = async () => {
    if (W2Rcontract && pairTokenContract) {
      const [w2rSymbol, w2rDecimals, lpSymbol, lpDecimals] = await Promise.all([
        W2Rcontract.symbol(),
        W2Rcontract.decimals(),
        pairTokenContract.symbol(),
        pairTokenContract.decimals(),
      ]);

      setW2RToken({
        tokenAddress: W2Raddress,
        tokenSymbol: w2rSymbol,
        tokenDecimals: w2rDecimals,
        tokenImage: W2Rmini,
      });

      setLPToken({
        tokenAddress: pairTokenAddress,
        tokenSymbol: lpSymbol,
        tokenDecimals: lpDecimals,
        tokenImage: LPmini,
      });
    }
  };

  useEffect(() => {
    if (address && network) {
      setW2Raddress(W2R.networks[network.chainId]?.address);
      setDexAddress(MaticW2Rdex.networks[network.chainId]?.address);
      setPairTokenAddress(MaticW2RPairToken.networks[network.chainId]?.address);
      W2Raddress && setW2Rcontract(new Contract(W2Raddress, W2Rabi, signer));
      dexAddress && setDexContract(new Contract(dexAddress, dexABI, signer));
      pairTokenAddress &&
        setPairTokenContract(
          new Contract(pairTokenAddress, pairTokenABI, signer)
        );
      fetchTokenInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, network, W2Raddress, dexAddress, pairTokenAddress]);

  const refreshData = async () => {
    if (validateConditions()) {
      await fetchBalances();
      await getMaticBalance();
      await fetchTokenInfo();
    }
    if (!address) {
      setUserBalances({
        matic: 0,
        w2r: 0,
        lpToken: 0,
      });
      setContractBalances({
        matic: 0,
        w2r: 0,
        lpToken: 0,
      });
      setFarmedLP(0);
      setRewards(0);
    }
  };

  useEffect(() => {
    refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, network, W2Rcontract, dexContract, pairTokenContract]);

  useEffect(() => {
    if (provider) {
      provider?.on("chainChanged", () => {
        window.location.reload();
      });
    }
    if (network) {
      if (network?.chainId !== 80001 && network?.chainId !== 1337) {
        alert(
          "Merci de vous connecter au réseau Polygon Mumbai ou au réseau de test local"
        );
        disconnect();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network]);

  const claimTokens = async () => {
    if (!validateConditions()) return;
    if (network?.chainId !== 80001)
      showToast("Merci de vous connecter au réseau Polygon Mumbai", true);
    try {
      setLoading(true);
      const response = await fetch("https://api.ipify.org?format=json");
      const { ip } = await response.json();
      // validate ip by regex
      if (
        !/^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/g.test(
          ip
        )
      ) {
        showToast(
          "Blue skies🎶, Smiling at me♪♫, Nothing but blue skies♬♩, Do I see🎹"
        );
        setLoading(false);
        return;
      }
      // Hash the IP address
      const ipHash = utils.keccak256(utils.toUtf8Bytes(ip));
      const tx = await dexContract.distributeTestW2R(ipHash);
      await tx.wait();
      await fetchBalances();
      showToast("Tokens récupérés !");
    } catch (error) {
      console.error(error);
      showToast(
        "Erreur lors de la récupération des tokens, ou quota atteint",
        true
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container dex-container">
      <div className="row" style={{ marginTop: "290px" }}>
        <h1 className="text-center fs-1">
          2Wheelers&apos; DEX{" "}
          <Image
            src={W2Rpicture}
            width={100}
            height={100}
            alt="W2R picture"
            style={{ width: "100px" }}
          />
        </h1>
        {address ? (
          <>
            <div className="col-12">
              {network?.chainId === 80001 && (
                <>
                  <hr />
                  <h2 className="text-center fs-6">
                    <span
                      style={{
                        color: "cyan",
                        display: "inline-block",
                        margin: "10px",
                      }}
                    >
                      Attention, Projet en développement:
                    </span>
                    <br />
                    Bien que le Dex soit pleinement fonctionnel testé en réseau
                    local, il n&apos;est pas encore possible de l&apos;utiliser
                    sur Mumbai, ne pouvant pas apporter la liquidité nécessaire
                    en Matic de test (nous n&apos;avons droit qu'à une fraction
                    par jour😅).
                    <br />
                    Pour l&apos;instant, vous pouvez récupérer des tokens W2R de
                    test ({testAmount} par jour) pour utiliser
                    l&apos;application, en cliquant ici :
                    <button className="m-3" onClick={claimTokens}>
                      Réclamer mes W2R de test
                    </button>
                    <br />
                    N&apos;oubliez pas de récupérer vos faucets de test Matic
                    pour les frais de gas sur
                    <a
                      href="https://mumbaifaucet.com/"
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {" "}
                      https://mumbaifaucet.com/
                    </a>
                    <br />
                    <span
                      style={{
                        color: "cyan",
                        display: "inline-block",
                        margin: "10px",
                      }}
                    >
                      Tout ce qui suit l&apos;est donc pour information, mais
                      demeure pleinement fonctionnel pour ceux qui testeront
                      localement le projet, sur Ganache par exemple. Plus de
                      précisions sur{" "}
                      <a
                        target="_blank"
                        rel="noopener noreferrer"
                        href="https://github.com/Crypt0zauruS/Crypt0zauruS-Alyra-2Wheels2Rent-Project-"
                      >
                        <span style={{ color: "red", cursor: "pointer" }}>
                          le GitHub du projet
                        </span>
                      </a>{" "}
                      (ReadMe et script de déploiement)
                    </span>
                  </h2>
                </>
              )}
              <hr />
              {!loading ? (
                <>
                  <h2 className="text-center m-4 fs-6">
                    Pour toutes opérations concernant vos W2R et vos Matic-W2R
                    LP Tokens, votre wallet vous demandera d&apos;abord
                    d&apos;approuver le montant que vous avez indiqué pour votre
                    transaction, avant d&apos;y procéder. Ceci vous garantie le
                    contrôle et la sécurité de vos fonds
                  </h2>
                  {window?.ethereum &&
                    network.chainId === 80001 &&
                    w2rToken &&
                    LPToken &&
                    provider && (
                      <div>
                        {" "}
                        <button
                          className="m-2"
                          onClick={() => addToken(w2rToken)}
                        >
                          Ajouter {w2rToken?.tokenSymbol} à MetaMask
                        </button>
                        <button
                          className="m-2"
                          onClick={() => addToken(LPToken)}
                        >
                          Ajouter {LPToken?.tokenSymbol} à MetaMask
                        </button>
                      </div>
                    )}
                </>
              ) : (
                <Loader />
              )}
              <hr />
            </div>
            <br />
            <div className="col-12 col-md-6 swap-section">
              <h2>Échanger</h2>
              <div className="swap-inputs d-flex">
                <input
                  className="form-control m-2"
                  type="number"
                  placeholder="MATIC montant"
                  value={swapMaticAmount}
                  onChange={(e) => {
                    setSwapMaticAmount(e.target.value);
                    if (e.target.value === "") {
                      setSwapW2RAmount("");
                    } else {
                      setSwapW2RAmount(e.target.value * swapRate);
                    }
                  }}
                />
                <input
                  className="form-control m-2"
                  type="number"
                  placeholder="W2R montant"
                  value={swapW2RAmount}
                  onChange={(e) => {
                    setSwapW2RAmount(e.target.value);
                    if (e.target.value === "") {
                      setSwapMaticAmount("");
                    } else {
                      setSwapMaticAmount(e.target.value / swapRate);
                    }
                  }}
                />
              </div>
              {swapDirection === "MaticToW2R" ? (
                <button
                  className="my-1"
                  onClick={swapMaticForW2R}
                  disabled={loading}
                >
                  Swap MATIC pour W2R
                </button>
              ) : (
                <button
                  className="my-1"
                  onClick={swapW2RForMatic}
                  disabled={loading}
                >
                  Swap W2R pour MATIC
                </button>
              )}
              <button
                className="btn btn-light swap-toggle m-2"
                onClick={toggleSwapDirection}
                style={{
                  borderRadius: "50%",
                  width: "50px",
                  height: "50px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                }}
              >
                ↔
              </button>
            </div>

            <div
              className="col-12 col-md-6 input-container"
              style={{ marginTop: "15px" }}
            >
              <h2 className="text-center fs-3 m-2">Participer</h2>
              <input
                className="form-control m-2"
                placeholder="Entrer le montant de MATIC"
                type="number"
                min="0"
                value={maticAmount}
                onChange={(e) => {
                  setMaticAmount(e.target.value);
                  if (e.target.value === "") {
                    setW2RAmount("");
                  } else {
                    setW2RAmount(e.target.value * swapRate);
                  }
                }}
              />
              <h2 className="text-center">⬆️ MATIC - W2R ⬇️</h2>
              <input
                className="form-control m-2"
                placeholder="Entrer le montant de W2R"
                type="number"
                min="0"
                value={w2rAmount}
                onChange={(e) => {
                  setW2RAmount(e.target.value);
                  if (e.target.value === "") {
                    setMaticAmount("");
                  } else {
                    setMaticAmount(e.target.value / swapRate);
                  }
                }}
              />
              <button
                className="m-2"
                type="button"
                onClick={addLiquidity}
                disabled={loading}
              >
                Ajouter de la liquidité
              </button>
              <h3 className="text-center m-2">
                En fournissant de la liquidité à hauteur de {swapRate} W2R pour
                1 Matic, vous participez au fonctionnement du DEX et recevez en
                échange des Matic-W2R LP Tokens. Ne les perdez pas ! Vous devrez
                les rendre pour récupérer votre liquidité. Mais surtout, vous
                pouvez les mettre en Farming pour gagner des W2R !{" "}
              </h3>
            </div>

            <div
              className="col-12 col-md-6 liquidity-section "
              style={{ marginTop: "-8px" }}
            >
              <h2 className="text-center">Retirer la liquidité</h2>
              <input
                className="form-control m-2"
                type="number"
                placeholder="Montant de Matic-W2R LP Tokens à rendre"
                value={lpTokenAmountToRemove}
                onChange={(e) => setLpTokenAmountToRemove(e.target.value)}
              />
              <button
                className="m-2"
                onClick={removeLiquidity}
                disabled={loading}
              >
                Retirer la liquidité
              </button>
              <h3 className="text-center m-2">
                Cette opération permettra de vous retourner sur votre wallet les
                MATIC et W2R que vous avez fournis au DEX. Vous rendez pour cela
                tout ou partie des Matic-W2R LP Tokens détenus sur votre wallet.
                Si vos Matic-W2R LP Tokens sont en farming, il faudra
                d&apos;abord les récupérer.
              </h3>
            </div>

            <div className="col-12 col-md-6 farm-section">
              <h2 className="text-center m-2">Farming</h2>
              <input
                className="form-control"
                type="number"
                placeholder="Montant de Matic-W2R LP Tokens"
                value={lpTokenAmountToStake}
                onChange={(e) => setLpTokenAmountToStake(e.target.value)}
              />
              <button className="my-2" onClick={farm} disabled={loading}>
                Staker les Matic-W2R LP Tokens
              </button>
              <h3 className="text-center m-2">
                En mettant vos Matic-W2R LP Tokens en farming, vous montrez
                votre volonté de confier de la liquidité au DEX dans le temps.
                Vous serez récompensé en W2R !<br />
                {/* <span style={{ color: "blue" }}>APY: {rewardRate} %</span>*/}
              </h3>
            </div>
            <hr />
            <div
              className="col-12 col-md-6 balances-container"
              style={{ marginTop: "20px" }}
            >
              <h2>Vos Balances:</h2>
              <hr />
              <div className="balance d-flex align-items-center mb-2">
                <h2 className="fs-5">MATIC: {userBalances.matic}</h2>
              </div>
              <div className="balance d-flex align-items-center mb-2">
                <h2 className="fs-5">W2R: {userBalances.w2r}</h2>
              </div>
              <div className="balance d-flex align-items-center mb-2">
                <h2 className="fs-5">
                  Matic-W2R LP Tokens: {userBalances.lpToken}
                </h2>
              </div>
              <div className="balance d-flex align-items-center mb-2">
                <h2 className="fs-5">
                  Votre farming de Matic-W2R LP Tokens: {farmedLP}
                </h2>
              </div>
            </div>
            <div className="col-12 col-md-6 balances-container">
              <h2>Balances du DEX:</h2>
              <hr />
              <div className="balance d-flex align-items-center mb-2">
                <h2 className="fs-5">MATIC: {contractBalances.matic}</h2>
              </div>
              <div className="balance d-flex align-items-center mb-2">
                <h2 className="fs-5">W2R: {contractBalances.w2r}</h2>
              </div>
              <div className="balance d-flex align-items-center mb-2">
                <h2 className="fs-5">
                  {" "}
                  Matic-W2R LP Tokens en farming: {contractBalances.lpToken}
                </h2>
              </div>
            </div>
            <div className="col-12 swap-section">
              <div className="balance d-flex align-items-center mb-2">
                <h2 className="fs-5 m-2">Récompenses: {rewards} W2R</h2>
                <div className="ml-auto d-flex">
                  <button
                    className="btn btn-primary m-2"
                    onClick={harvest}
                    disabled={loading}
                  >
                    Réclamer et continuer le farming
                  </button>
                  <button
                    className="btn btn-secondary m-2"
                    onClick={exitFarm}
                    disabled={loading}
                  >
                    Réclamer et récupérer mon farming
                  </button>
                  <h3 style={{ marginTop: "20px", marginLeft: "10px" }}>
                    fees: {feesPercentage}%
                  </h3>
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-center fs-6">
                Contrat du W2R: {W2Raddress}{" "}
                <span
                  onClick={() => handleCopy(W2Raddress)}
                  style={{ cursor: "pointer" }}
                >
                  💾
                </span>
              </h2>
              <h2 className="text-center fs-6">
                Contrat du Matic-W2R LP Token: {pairTokenAddress}{" "}
                <span
                  onClick={() => handleCopy(pairTokenAddress)}
                  style={{ cursor: "pointer" }}
                >
                  💾
                </span>
              </h2>
            </div>
          </>
        ) : (
          <>
            <hr />
            <h1 className="text-center fs-3">
              Connectez-vous pour réclamer gratuitement vos W2R de test !{" "}
            </h1>
            <br />
            <h1 className="text-center fs-5">
              Bien que le Dex soit pleinement fonctionnel testé en réseau local,
              il n&apos;est pas encore possible de l&apos;utiliser sur Mumbai.
              En attendant, vous pouvez réclamer vos W2R de test en connectant
              votre wallet pour utiliser l'application.
              <br />
              Je songe toutefois à créer prochainement un token temporaire ERC20
              "testMATIC" pour que vous puissiez tester le Dex en conditions
              réelles. Ceci dit, cela demandera de réécrire les fonctions du DEX
              car le MATIC n'est pas un ERC20.
            </h1>
            <hr />
            <h1 className="text-center fs-5">
              Lorsque le projet sera déployé sur le Mainnet, vous pourrez
              échanger vos MATIC contre des W2R et vice-versa ! Et gagner des
              récompenses en apportant de la liquidité !
            </h1>
          </>
        )}
      </div>
      <ToastContainer />
      <Footer />
    </div>
  );
};

export default Dex;
