import { useEffect, useState } from "react";
import { ethers, Contract } from "ethers";
import { useForm } from "react-hook-form";
import { useWeb3Context } from "../context/";
import W2R from "../contracts/W2R.json";
import MaticW2Rdex from "../contracts/MaticW2Rdex.json";
import MaticW2RPairToken from "../contracts/MaticW2RPairToken.json";

const Dex = () => {
  const { web3Provider, address, network } = useWeb3Context();

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
  const [w2rAmountToAdd, setW2RAmountToAdd] = useState("");
  const [lpTokenAmountToRemove, setLpTokenAmountToRemove] = useState("");
  const [lpTokenAmountToStake, setLpTokenAmountToStake] = useState("");
  const [swapW2RAmount, setSwapW2RAmount] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm();

  const swapW2RForMatic = async () => {
    try {
      const amountToSwap = ethers.utils.parseUnits(w2rAmount, 18);
      const tx = await dexContract.swapW2RForMatic(amountToSwap, {
        gasLimit: 300000,
      });
      await tx.wait();
      console.log("Swap effectué avec succès");
    } catch (error) {
      console.error("Erreur lors du swap:", error);
    }
  };

  const swapMaticForW2R = async () => {
    const tx = await dexContract.swapMaticForW2R({
      value: ethers.utils.parseEther(swapMaticAmount),
    });
    await tx.wait();
    setSwapMaticAmount("");
  };

  const addLiquidity = async () => {
    try {
      const maticAmount = ethers.utils.parseUnits(maticAmount, 18);
      const w2rAmount = ethers.utils.parseUnits(w2rAmountToAdd, 18);
      const tx = await dexContract.addLiquidity(maticAmount, w2rAmount, {
        gasLimit: 300000,
      });
      await tx.wait();
      console.log("Liquidité ajoutée avec succès");
    } catch (error) {
      console.error("Erreur lors de l'ajout de liquidité:", error);
    }
  };

  const removeLiquidity = async () => {
    try {
      const lpTokenAmount = ethers.utils.parseUnits(lpTokenAmountToRemove, 18);
      const tx = await dexContract.removeLiquidity(lpTokenAmount, {
        gasLimit: 300000,
      });
      await tx.wait();
      console.log("Liquidité retirée avec succès");
    } catch (error) {
      console.error("Erreur lors du retrait de liquidité:", error);
    }
  };

  const farm = async () => {
    try {
      const lpTokenAmount = ethers.utils.parseUnits(lpTokenAmountToStake, 18);
      const tx = await dexContract.farm(lpTokenAmount, { gasLimit: 300000 });
      await tx.wait();
      console.log("Staking effectué avec succès");
    } catch (error) {
      console.error("Erreur lors du staking:", error);
    }
  };

  useEffect(() => {
    const fetchBalances = async () => {
      setUserBalances({
        matic: ethers.utils.formatEther(userMatic),
        w2r: ethers.utils.formatEther(userW2R),
        lpToken: ethers.utils.formatEther(userLPTokens),
      });

      setContractBalances({
        matic: ethers.utils.formatEther(contractMatic),
        w2r: ethers.utils.formatEther(contractW2R),
        lpToken: ethers.utils.formatEther(contractLPTokens),
      });
    };

    //fetchBalances();
  }, [dexContract]);

  useEffect(() => {
    if (address && network) {
      setW2Raddress(W2R.networks[network.chainId]?.address);
      console.log(W2R.networks[network.chainId]?.address);
      setDexAddress(MaticW2Rdex.networks[network.chainId]?.address);
      console.log(MaticW2Rdex.networks[network.chainId]?.address);
      setPairTokenAddress(MaticW2RPairToken.networks[network.chainId]?.address);
      console.log(MaticW2RPairToken.networks[network.chainId]?.address);
      W2Raddress && setW2Rcontract(new Contract(W2Raddress, W2Rabi, signer));
      dexAddress && setDexContract(new Contract(dexAddress, dexABI, signer));
      pairTokenAddress &&
        setPairTokenContract(
          new Contract(pairTokenAddress, pairTokenABI, signer)
        );
    }
  }, [network, address]);

  const onSubmit = async (data) => {
    try {
      const { maticAmount, w2rAmount } = data;

      if (maticAmount && w2rAmount) {
        await dexContract.addLiquidity(ethers.utils.parseEther(w2rAmount), {
          value: ethers.utils.parseEther(maticAmount),
        });
      } else if (maticAmount) {
        await dexContract.swapMaticForW2R({
          value: ethers.utils.parseEther(maticAmount),
        });
      } else if (w2rAmount) {
        await dexContract.swapW2RForMatic(ethers.utils.parseEther(w2rAmount));
      }
    } catch (error) {
      console.error("Error:", error.message);
    }
  };

  return (
    <div className="dex-container">
      <h1>Location de vélos - DEX Matic-W2R</h1>

      <div className="swap-section">
        <h2>Échanger</h2>
        <div className="swap-inputs">
          <input
            type="number"
            placeholder="MATIC montant"
            value={swapMaticAmount}
            onChange={(e) => setSwapMaticAmount(e.target.value)}
          />
          <input
            type="number"
            placeholder="W2R montant"
            value={swapW2RAmount}
            onChange={(e) => setSwapW2RAmount(e.target.value)}
          />
        </div>
        <button onClick={swapMaticForW2R}>Swap MATIC pour W2R</button>
        <button onClick={swapW2RForMatic}>Swap W2R pour MATIC</button>
      </div>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="input-container">
          <h2>MATIC</h2>
          <input
            {...register("maticAmount", {
              validate: (value) =>
                (!isNaN(value) && parseFloat(value) >= 0) || "Invalid amount",
            })}
            placeholder="Enter amount"
            type="number"
            step="any"
            min="0"
            onChange={(e) => setValue("maticAmount", e.target.value)}
          />
          {errors.maticAmount && <span>{errors.maticAmount.message}</span>}
        </div>
        <div className="input-container">
          <h2>W2R</h2>
          <input
            {...register("w2rAmount", {
              validate: (value) =>
                (!isNaN(value) && parseFloat(value) >= 0) || "Invalid amount",
            })}
            placeholder="Enter amount"
            type="number"
            step="any"
            min="0"
            onChange={(e) => setValue("w2rAmount", e.target.value)}
          />
          {errors.w2rAmount && <span>{errors.w2rAmount.message}</span>}
        </div>
        <button type="submit">Submit</button>
      </form>
      <div className="balances-container">
        <h3>User Balances</h3>
        <div className="balance">
          <h2>MATIC:</h2> {userBalances.matic}
        </div>
        <div className="balance">
          <h2>W2R:</h2> {userBalances.w2r}
        </div>
        <div className="balance">
          <h2>LP Tokens:</h2> {userBalances.lpToken}
        </div>
      </div>
      <div className="balances-container">
        <h3>Contract Balances</h3>
        <div className="balance">
          <h2>MATIC:</h2> {contractBalances.matic}
        </div>
        <div className="balance">
          <h2>W2R:</h2> {contractBalances.w2r}
        </div>
        <div className="balance">
          <h2>LP Tokens:</h2> {contractBalances.lpToken}
        </div>
      </div>
    </div>
  );
};

export default Dex;
