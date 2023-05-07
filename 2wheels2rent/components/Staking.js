import { useState, useEffect, useCallback } from "react";
import { ethers, Contract } from "ethers";
import axios from "axios";
import format from "date-fns/format";
import fr from "date-fns/locale/fr";
import Loader from "./Loader";
import W2RStaking from "../contracts/W2RStaking.json";

const Staking = ({
  address,
  network,
  signer,
  W2Rcontract,
  handleEnableW2R,
  setLoading,
  loading,
  stakingAddress,
  setStakingAddress,
  hasTooManyDecimals,
  showToast,
}) => {
  const W2RStakingAbi = W2RStaking.abi;
  const [stakingContract, setStakingContract] = useState();
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [lockPeriod, setLockPeriod] = useState("1");
  const [extendLock, setExtendLock] = useState(false);
  const [pendingReward, setPendingReward] = useState(0);
  const [stakerInfos, setStakerInfos] = useState([]);
  const [proportionalReward, setProportionalReward] = useState(false);
  const [reward, setReward] = useState(0);
  const [earlyUnstakePenalty, setEarlyUnstakePenalty] = useState(0);
  const [W2Rbalance, setW2Rbalance] = useState(0);
  const [totalStaking, setTotalStaking] = useState(0);
  const [fees, setFees] = useState(0);
  const [displayUSD, setDisplayUSD] = useState(true);
  const [totalStakingUSD, setTotalStakingUSD] = useState(0);
  const [totalStakingEUR, setTotalStakingEUR] = useState(0);
  const [formattedStakerAmount, setFormattedStakerAmount] = useState(0);
  const [formattedStakerUSDValue, setFormattedStakerUSDValue] = useState(0);
  const [formattedStakingLock, setFormattedStakingLock] = useState(0);
  const [formattedStakingBeginning, setFormattedStakingBeginning] = useState(0);
  const [apy, setApy] = useState(0);
  const [multiplier, setMultiplier] = useState(0);
  const [maxLockMonths, setMaxLockMonths] = useState(0);

  const validateConditions = () => {
    if (!address) return false;
    if (!network) return false;
    if (!stakingAddress) return false;
    if (!stakingContract) return false;
    if (!W2Rcontract) return false;
    return true;
  };

  const fetchMaticPrice = async (staking) => {
    try {
      const response = await axios.get(
        "https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=usd%2Ceur"
      );
      setTotalStakingUSD((response.data["matic-network"].usd / 10) * staking);
      setTotalStakingEUR((response.data["matic-network"].eur / 10) * staking);
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des données de prix:",
        error
      );
    }
  };

  const handleStake = async () => {
    if (!validateConditions) return;
    if (Number(stakeAmount) === 0) return;
    if (Number(stakeAmount) > Number(W2Rbalance)) {
      showToast("Vous ne pouvez pas staker plus que votre solde !", true);
      return;
    }
    if (hasTooManyDecimals(stakeAmount)) return;
    if (
      (formattedStakerAmount > 0 && extendLock) ||
      formattedStakerAmount === 0
    ) {
      if (Number(lockPeriod) < 1 || Number(lockPeriod) > maxLockMonths) {
        showToast(
          `La durée de lock doit être comprise entre 1 et ${maxLockMonths} mois !`,
          true
        );
        return;
      }
    }
    if (
      formattedStakerAmount === 0 ||
      (formattedStakerAmount > 0 && Date.now() > formattedStakingLock * 1000)
    ) {
      alert(
        "Avertissement: pour tout nouveau staking, vous ne pourrez pas unstaker avant 15 jours !"
      );
    }
    setLoading(true);
    try {
      await handleEnableW2R(stakeAmount.toString(), false);
    } catch (error) {
      console.error("Erreur lors de l'autorisation:", error);
      setLoading(false);
      return;
    }
    try {
      const w2r = ethers.utils.parseEther(stakeAmount.toString(), 18);
      formattedStakerAmount === 0 && setExtendLock(false);
      const tx = await stakingContract.stake(
        w2r,
        formattedStakerAmount > 0 && !extendLock ? 0 : Number(lockPeriod),
        extendLock
      );
      await tx.wait();
      stakingContract.once("Staked", (user, amount) => {
        console.log("Staked:", user, amount);
        showToast(
          `Staking réussi de ${Number(ethers.utils.formatEther(amount)).toFixed(
            2
          )} W2R !`
        );
      });
    } catch (error) {
      console.error("Erreur lors du staking:", error);
      showToast("Erreur lors du staking !", true);
    } finally {
      setStakeAmount("0");
      setLockPeriod("1");
      setExtendLock(false);
      fetchDatas();
    }
  };

  const handleUnstake = async () => {
    if (!validateConditions) return;
    if (Number(unstakeAmount) === 0) return;
    if (Date.now() < (formattedStakingBeginning + 15 * 86400) * 1000) {
      showToast("Vous ne pouvez pas unstaker avant 15 jours !", true);
      return;
    }
    if (Number(unstakeAmount) > formattedStakerAmount) {
      showToast("Vous ne pouvez pas unstaker plus que votre mise !", true);
      return;
    }
    if (hasTooManyDecimals(unstakeAmount)) return;
    try {
      setLoading(true);
      const w2r = ethers.utils.parseEther(unstakeAmount.toString(), 18);
      const tx = await stakingContract.unstake(w2r, proportionalReward);
      await tx.wait();
      stakingContract.once("Unstaked", (user, amount) => {
        console.log("Unstaked:", user, amount);
        showToast(
          `Unstaking réussi de ${Number(
            ethers.utils.formatEther(amount)
          ).toFixed(2)} W2R !`
        );
      });
    } catch (error) {
      console.error("Erreur lors du unstaking:", error);
      showToast("Erreur lors de l'unstaking !", true);
    } finally {
      setUnstakeAmount(0);
      fetchDatas();
    }
  };

  const handleClaimReward = async () => {
    if (!validateConditions) return;
    if (pendingReward === 0) {
      showToast("Vous n'avez pas de récompense à récupérer !", true);
      return;
    }
    try {
      setLoading(true);
      const tx = await stakingContract.claimReward();
      await tx.wait();
      stakingContract.once("RewardClaimed", (user, amount) => {
        console.log("RewardClaimed:", user, amount);
        showToast(
          `Récompense récupérée de ${Number(
            ethers.utils.formatEther(amount)
          ).toFixed(2)} W2R !`
        );
      });
    } catch (error) {
      console.error("Erreur lors de la récupération de la récompense:", error);
      showToast("Erreur lors de la récupération de la récompense !", true);
    } finally {
      fetchDatas();
    }
  };

  const fetchDatas = useCallback(async () => {
    try {
      setLoading(true);
      const balance = await W2Rcontract?.balanceOf(address);
      balance && setW2Rbalance(Number(ethers.utils.formatEther(balance)));
      const reward = await stakingContract?.viewReward(address);
      reward && setPendingReward(Number(ethers.utils.formatEther(reward)));
      const stakerInfos = await stakingContract?.stakers(address);
      if (stakerInfos) {
        setStakerInfos(stakerInfos);
        setFormattedStakerAmount(
          Number(ethers.utils.formatEther(stakerInfos[0]))
        );
        setFormattedStakerUSDValue(
          Number(ethers.utils.formatUnits(stakerInfos[3], 8))
        );
        setFormattedStakingLock(Number(stakerInfos[4]));
        setFormattedStakingBeginning(Number(stakerInfos[6]));
      }
      const maxLock = await stakingContract?.maxLockPeriod();
      maxLock && setMaxLockMonths(Number(maxLock));
      const penalty = await stakingContract?.earlyUnstakePenalty();
      penalty && setEarlyUnstakePenalty(Number(penalty));
      const feesPercentage = await stakingContract?.rewardsFeesPercentage();
      feesPercentage && setFees(Number(feesPercentage));
      const totalStaked = await stakingContract?.totalStaking();
      totalStaked &&
        setTotalStaking(Number(ethers.utils.formatEther(totalStaked)));
      const apy = await stakingContract?.viewRewardPercentage();
      apy && setApy(Number(apy));
      const multiplier = await stakingContract?.calculateMultiplier(
        address,
        false
      );
      multiplier &&
        setMultiplier(Number(ethers.utils.formatUnits(multiplier, 6)));
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stakingContract, W2Rcontract]);

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp * 1000);
    return format(date, "eeee d MMMM yyyy 'à' HH:mm", { locale: fr });
  };

  const refreshData = async () => {
    if (validateConditions()) {
      await fetchDatas();
    }
    if (!address) {
      setW2Rbalance(0);
      setPendingReward(0);
      setStakerInfos([]);
      setTotalStaking(0);
      setFees(0);
    }
  };

  const handleMaxStake = () => {
    W2Rbalance && setStakeAmount(W2Rbalance);
  };

  const handleMaxUnstake = () => {
    formattedStakerAmount && setUnstakeAmount(formattedStakerAmount);
  };

  const handleProportionalReward = () => {
    if (Number(unstakeAmount) > 0) {
      const percentage = (Number(unstakeAmount) * 100) / formattedStakerAmount;
      formattedStakingLock * 1000 > Date.now()
        ? setReward(
            (pendingReward * percentage) / 100 / multiplier -
              (((pendingReward * percentage) / 100 / multiplier) *
                earlyUnstakePenalty) /
                100
          )
        : setReward(pendingReward * (percentage / 100));
    }
  };

  useEffect(() => {
    if (address && network) {
      setStakingAddress(W2RStaking.networks[network.chainId]?.address);
      stakingAddress &&
        setStakingContract(new Contract(stakingAddress, W2RStakingAbi, signer));
    } else {
      setStakingAddress("");
      setStakingContract();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, network, stakingAddress]);

  useEffect(() => {
    refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, network, stakingContract, W2Rcontract]);

  useEffect(() => {
    totalStaking && fetchMaticPrice(totalStaking);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalStaking]);

  useEffect(() => {
    extendLock &&
      stakerInfos[0] &&
      Number(ethers.utils.formatEther(stakerInfos[0])) === 0 &&
      setExtendLock(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extendLock]);

  useEffect(() => {
    if (!unstakeAmount || unstakeAmount === "0" || !formattedStakerAmount) {
      setReward(0);
      return;
    }
    proportionalReward ? handleProportionalReward() : setReward(pendingReward);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proportionalReward, unstakeAmount]);

  return (
    <div className="container staking">
      <div className="row" style={{ marginBottom: "-30px" }}>
        <div className="col m-4">
          {!loading ? (
            <h1 className="fs-4 text-center">
              Staker vos W2R et soyez récompensés !
              <br />
              <span className="fs-4">
                Votre solde: {W2Rbalance && W2Rbalance.toFixed(2)} W2R
              </span>
            </h1>
          ) : (
            <Loader />
          )}
          <br />
          <p className="fs-6 text-center">
            <span className="fs-5" style={{ color: "blue" }}>
              Votre staking:{" "}
              {formattedStakerAmount && formattedStakerAmount.toFixed(2)} W2R,
              soit {formattedStakerUSDValue.toFixed(2)} $
            </span>
            <br />
            {formattedStakerAmount > 0 && (
              <>
                <span className="fs-5" style={{ color: "cyan" }}>
                  Fin de la période de lock: {formatDate(formattedStakingLock)}
                </span>{" "}
                <br />
              </>
            )}
            Staking Total sur le DEX: {totalStaking && totalStaking.toFixed(2)}{" "}
            W2R, soit{" "}
            <span
              onClick={() => setDisplayUSD(!displayUSD)}
              style={{ color: "orangered", cursor: "pointer" }}
            >
              {displayUSD
                ? totalStakingUSD.toFixed(2) + " $"
                : totalStakingEUR.toFixed(2) + " €"}
            </span>
            <br />
            <span>APY: {apy} %</span>{" "}
            <span>🚀 Votre multiplicateur: {multiplier}</span>
          </p>
        </div>
      </div>
      <div className="row">
        <div className="col-lg-6 col-md-12 mb-4" style={{ height: "430px" }}>
          <div
            className="m-4 input-group"
            style={{
              justifyContent: "center",
            }}
          >
            <label htmlFor="stakeAmount" className="form-label fs-4">
              Montant à staker:
            </label>
            <input
              type="number"
              className="form-control"
              id="stakeAmount"
              placeholder="Montant à mettre en staking"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              onKeyDown={(e) => {
                if (
                  !(
                    /[0-9.,]/.test(e.key) ||
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
              style={{ zIndex: "0" }}
            />
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleMaxStake}
              style={{
                height: "40px",
                marginTop: "1px",
                color: "orangered",
                zIndex: "0",
              }}
            >
              Max
            </button>
          </div>
          {((stakerInfos[0] &&
            Number(ethers.utils.formatEther(stakerInfos[0])) === 0 &&
            !extendLock) ||
            (stakerInfos[0] &&
              Number(ethers.utils.formatEther(stakerInfos[0])) > 0 &&
              extendLock)) && (
            <div className="m-4">
              <label htmlFor="lockPeriod" className="form-label">
                Période de verrouillage (en mois):
              </label>

              <input
                type="range"
                className="form-control futuristic-range"
                id="lockPeriod"
                min="1"
                max={
                  extendLock
                    ? maxLockMonths - Number(stakerInfos[5])
                    : maxLockMonths
                }
                step="1"
                value={lockPeriod}
                onChange={(e) => setLockPeriod(e.target.value)}
                style={{ zIndex: "0" }}
              />
              <span
                style={{
                  display: "inline-block",
                  marginTop: "10px",
                }}
              >
                {lockPeriod} mois{Number(stakerInfos[5]) > 0 && " de plus"},
                multiplicateur{" "}
                {(Number(lockPeriod) + Number(stakerInfos[5])) * 2 <= 10
                  ? 1
                  : ((Number(lockPeriod) + Number(stakerInfos[5])) * 2) / 10}
              </span>
            </div>
          )}
          <div className="m-4 form-check">
            {stakerInfos[0] &&
              Number(ethers.utils.formatEther(stakerInfos[0])) > 0 && (
                <>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="extendLock"
                    checked={extendLock}
                    onChange={(e) => {
                      setLockPeriod("1");
                      setExtendLock(e.target.checked);
                    }}
                    disabled={maxLockMonths - Number(stakerInfos[5]) <= 0}
                  />
                  <label htmlFor="extendLock" className="form-check-label">
                    Prolonger la période de verrouillage (jusqu&apos;à{" "}
                    {maxLockMonths - Number(stakerInfos[5]) > 0
                      ? maxLockMonths - Number(stakerInfos[5]) + " mois"
                      : "vous êtes au maximum"}
                    )
                  </label>
                  <br />
                </>
              )}
            <button
              className="btn btn-primary m-2"
              onClick={handleStake}
              type="button"
              disabled={loading}
            >
              Staker
            </button>
          </div>
          <h2 className="fs-6 m-2">
            En bloquant vos W2R en staking, vous participer à la diminution de
            la volatilité de notre token, et vous contribuez à
            l&apos;augmentation potentielle de sa valeur, tout en gagnant des
            récompenses !
          </h2>
        </div>
        {Date.now() > (formattedStakingBeginning + 15 * 86400) * 1000 &&
          formattedStakerAmount > 0 && (
            <>
              <div
                className="col-lg-6 col-md-12 mb-4"
                style={{ height: "430px" }}
              >
                <div
                  className="m-4 input-group"
                  style={{
                    justifyContent: "center",
                  }}
                >
                  <label htmlFor="unstakeAmount" className="form-label fs-4">
                    Montant à unstaker:
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    id="unstakeAmount"
                    placeholder="Montant à retirer du staking"
                    name="unstakeAmount"
                    value={unstakeAmount}
                    onChange={(e) => setUnstakeAmount(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        !(
                          /[0-9.,]/.test(e.key) ||
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
                    style={{ zIndex: "0" }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handleMaxUnstake}
                    style={{
                      height: "40px",
                      marginTop: "1px",
                      color: "orangered",
                      zIndex: "0",
                    }}
                  >
                    Max
                  </button>
                </div>
                <div className="m-4 form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="proportional"
                    name="proportional"
                    checked={proportionalReward}
                    onChange={(e) => setProportionalReward(e.target.checked)}
                  />
                  <label htmlFor="proportional" className="form-check-label">
                    {proportionalReward
                      ? `Récompense proportionnelle: vous en recevrez selon votre unstake, soit ${reward?.toFixed(
                          2
                        )} W2R`
                      : `Cocher si vous ne souhaitez pas recevoir toutes vos récompenses`}
                  </label>
                  <button
                    className="btn btn-primary m-2"
                    onClick={handleUnstake}
                    type="button"
                    disabled={loading}
                  >
                    Unstake
                  </button>
                  <br />
                  {formattedStakerAmount > 0 &&
                  formattedStakingLock * 1000 > Date.now() ? (
                    <h2 className="fs-6 m-2">
                      Pénalité: {earlyUnstakePenalty} % des récompenses car vous
                      êtes en période de lock.{" "}
                      {multiplier > 1 &&
                        "Vous ne bénéficiez pas non plus de votre multiplicateur."}
                      {!proportionalReward && (
                        <span>
                          Vous recevrez{" "}
                          {(
                            pendingReward / multiplier -
                            ((pendingReward / multiplier) *
                              earlyUnstakePenalty) /
                              100
                          ).toFixed(2)}{" "}
                          W2R
                        </span>
                      )}
                    </h2>
                  ) : formattedStakerAmount > 0 &&
                    formattedStakingLock * 1000 <= Date.now() ? (
                    <h2>
                      Période de lock achevée, vous pouvez retirer tout ou
                      partie de votre staking sans pénalité{" "}
                    </h2>
                  ) : null}
                  <br />
                </div>
              </div>
            </>
          )}
        {Date.now() <= (formattedStakingBeginning + 15 * 86400) * 1000 &&
          formattedStakerAmount > 0 && (
            <div className="col-lg-6 col-md-12 mb-4">
              <div className="m-4" style={{ justifyContent: "center" }}>
                <h2 className="fs-4 m-2 text-center">
                  {" "}
                  Vous pourrez Unstake à partir du{" "}
                  {formatDate(formattedStakingBeginning + 15 * 86400)}{" "}
                </h2>
                <p className="text-center">
                  (Avec {earlyUnstakePenalty}% de pénalité et sans
                  multiplicateur jusqu&apos;au{" "}
                  {formatDate(formattedStakingLock)})
                </p>
              </div>
            </div>
          )}
      </div>
      <div className="row">
        <div className="col text-center">
          <span className="fs-5 d-block mt-3">
            Vos récompenses actuelles:{" "}
            {pendingReward && pendingReward.toFixed(2)} W2R
          </span>
          <button
            className="btn btn-primary m-2"
            onClick={handleClaimReward}
            type="button"
            disabled={loading}
          >
            Réclamer récompense sans unstake
          </button>
          <span className="fs-6 d-block">
            Frais de retrait des récompenses: {fees}%
          </span>
        </div>
      </div>
      <hr />
    </div>
  );
};

export default Staking;
