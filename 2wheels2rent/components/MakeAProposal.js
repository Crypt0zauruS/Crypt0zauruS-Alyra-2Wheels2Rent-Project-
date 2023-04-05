import { useState, useEffect, useCallback } from "react";
import { ethers, Contract } from "ethers";
import { format, add } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";
import Loader from "./Loader";

const MakeProposal = ({
  setMakeProposal,
  lenderWhitelistAddress,
  lenderWhitelistAbi,
  bikeShareAbi,
  proposalAddress,
  web3Provider,
  showToast,
  w2Rcontract,
  contract,
  userInfos,
}) => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [duration, setDuration] = useState(1);
  const [minDate, setMinDate] = useState("");
  const [maximumRental, setMaximumRental] = useState(0);
  const [rate, setRate] = useState("");
  const [deposit, setDeposit] = useState("");
  const [isRented, setIsRented] = useState(false);
  const [isDeactivated, setIsDeactivated] = useState(false);
  const [reward, setReward] = useState(0);
  const [bikeShareContract, setBikeShareContract] = useState(null);
  const [bikeShareAddress, setBikeShareAddress] = useState("");
  const [bikeShareProposals, setBikeShareProposals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loader, setLoader] = useState(false);
  const [alreadyProposed, setAlreadyProposed] = useState(false);

  const handleDateChange = (event, setDate) => {
    const newDate = event.target.value;
    if (newDate >= minDate) {
      setDate(newDate);
    } else {
      setDate(minDate);
    }
  };
  const handleDurationChange = (event) => {
    const newDuration = event.target.value;
    if (newDuration >= 1 && newDuration <= maximumRental) {
      setDuration(newDuration);
    } else if (newDuration >= 1 && newDuration > maximumRental) {
      setDuration(maximumRental);
    } else {
      setDuration(1);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isRented) return;
    if (isDeactivated) return;
    if (!bikeShareAddress) return;
    if (!w2Rcontract) return;
    if (!contract) return;

    if (bikeShareProposals >= 5) {
      showToast("Ce vélo a déjà 5 propositions en cours", true);
      return;
    }
    try {
      setLoader(true);
      if (await contract.isDeactivated()) {
        showToast("Veuillez d'abord activer votre contrat", true);
        return;
      }
      if (await contract.isRenting()) {
        showToast("Vous avez déjà un vélo en location", true);
        return;
      }
      const numProposals = await contract.getProposalsLength();
      if (Number(numProposals) >= 3) {
        showToast(
          "Vous avez déjà 3 propositions en cours, vous pouvez essayer d'en annuler",
          true
        );
        return;
      }
      const balance = await w2Rcontract.balanceOf(userInfos.contractAddress);
      const decimals = await w2Rcontract.decimals();
      const formattedBalance = Number(
        ethers.utils.formatUnits(balance, decimals)
      );
      const total = duration * Number(rate) + Number(deposit);
      if (formattedBalance < total) {
        showToast(
          `Vous n'avez pas assez de W2R, il vous en manque ${
            total - formattedBalance
          }`,
          true
        );
        return;
      }
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      const dateMin = Math.floor(startDateObj.getTime() / 1000);
      const dateMax = Math.floor(endDateObj.getTime() / 1000);
      // si la dateMax est inférieure à la dateMin
      if (dateMax < dateMin) {
        showToast(
          "La date de fin doit être supérieure à la date de début",
          true
        );
        return;
      }

      if (dateMin < Math.floor(Date.now() / 1000) + 10700) {
        showToast("La date de début doit être au minimum dans 3h", true);
        return;
      }

      if (dateMax - dateMin > 86400 / 2 || dateMax - dateMin < 10800) {
        showToast(
          "La fourchette horaire pour le RDV doit être de 3 à 12 heures",
          true
        );
        return;
      }
      if (duration < 1 || duration > maximumRental) {
        showToast(
          `La durée de location doit être comprise entre 1 et ${maximumRental} jours`,
          true
        );
        return;
      }
      const rentalTime = duration * 86400;
      const tx = await contract?.makeProposal(
        bikeShareAddress,
        dateMin,
        dateMax,
        rentalTime
      );
      await tx.wait();
      // catch event emitted by Renter contract
      contract?.once(
        "ProposalMade",
        (
          renter,
          date,
          bikeShareContract,
          dateMin,
          dateMax,
          duration,
          rate,
          deposit
        ) => {
          console.log(
            renter,
            date,
            bikeShareContract,
            dateMin,
            dateMax,
            duration,
            rate,
            deposit
          );
          showToast(
            `Vous avez fait une proposition de location le ${new Date(
              date * 1000
            ).toLocaleDateString()} pour le vélo ${bikeShareContract} depuis votre contrat ${renter} du ${new Date(
              dateMin * 1000
            ).toLocaleDateString()} au ${new Date(
              dateMax * 1000
            ).toLocaleDateString()} pour une durée de ${duration / 86400} jour${
              duration > 1 && "s"
            } au prix de ${ethers.utils.formatUnits(
              rate?.toString(),
              "ether"
            )} W2R par jour et un dépôt de garantie de ${ethers.utils.formatUnits(
              deposit?.toString(),
              "ether"
            )} W2R`
          );
        }
      );
    } catch (error) {
      console.log(error);
      showToast(
        "Soit vous avez déjà une proposition en cours pour ce vélo, soit la limite quotidienne a été atteinte",
        true
      );
    } finally {
      setLoader(false);
      setMakeProposal(false);
    }
  };

  const getLenderInfos = useCallback(
    async (lenders) => {
      setLoading(true);
      try {
        const lenderInfos = await lenders.whitelistedAddresses(proposalAddress);
        setBikeShareContract(
          new Contract(lenderInfos[1], bikeShareAbi, web3Provider?.getSigner())
        );
        setBikeShareAddress(lenderInfos[1]);
        const isDeactivated = await bikeShareContract?.isDeactivated();
        setIsDeactivated(isDeactivated);
        const maxRental = await bikeShareContract?.maximumRental();
        maxRental && setMaximumRental(Number(maxRental?.toString()) / 86400);
        const rate = await bikeShareContract?.rate();
        rate && setRate(ethers.utils.formatUnits(rate?.toString(), "ether"));
        const deposit = await bikeShareContract?.depositAmount();
        deposit &&
          setDeposit(ethers.utils.formatUnits(deposit?.toString(), "ether"));
        const reward = await bikeShareContract?.rewardAmount();
        setReward(Number(reward?.toString()));
        const isRented = await bikeShareContract?.isRented();
        setIsRented(isRented);
        const numberOfProposals = await bikeShareContract?.getProposalsLength();
        setBikeShareProposals(Number(numberOfProposals));
        if (bikeShareProposals > 0) {
          for (let i = 0; i < bikeShareProposals; i++) {
            const proposal = await bikeShareContract?.proposals(i);
            if (
              proposal._renter.toLowerCase() ===
              userInfos.contractAddress.toLowerCase()
            ) {
              setAlreadyProposed(true);
            }
          }
        }
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDeactivated, bikeShareProposals]
  );

  useEffect(() => {
    if (startDate > endDate) {
      setEndDate(startDate);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();
    const threeHoursLater = add(now, { hours: 3 });
    const minDateTime = utcToZonedTime(threeHoursLater, timeZone);
    const formattedMinDateTime = format(minDateTime, "yyyy-MM-dd'T'HH:mm");
    setMinDate(formattedMinDateTime);
    setStartDate(formattedMinDateTime);
    setEndDate(formattedMinDateTime);
    const lenders = new Contract(
      lenderWhitelistAddress,
      lenderWhitelistAbi,
      web3Provider?.getSigner()
    );
    getLenderInfos(lenders);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getLenderInfos]);

  return (
    <div className="modalContract">
      {!loading ? (
        <div>
          {!loader ? (
            <h2 className="text-center">
              {isDeactivated
                ? "Ce contract n'a pas été activé"
                : !isRented
                ? "Je fais une proposition"
                : "Ce vélo est déjà loué"}
            </h2>
          ) : (
            <Loader />
          )}
          <hr />
          {!isDeactivated && !isRented && (
            <>
              {!alreadyProposed ? (
                <div>
                  <p className="text-center fs-4">
                    Le loueur autorise une durée maximum de{" "}
                    <span style={{ color: "red" }}>{maximumRental}</span> jour
                    {maximumRental > 1 && "s"}
                    <br />
                    Son prix de location est de{" "}
                    <span style={{ color: "red" }}>{rate}</span> W2R par jour
                    <br />
                    Le dépôt de garantie est de{" "}
                    <span style={{ color: "red" }}>{deposit}</span> W2R
                  </p>
                  <hr />
                  <form onSubmit={handleSubmit}>
                    <div className="container">
                      <div className="row align-items-center">
                        <p className="fs-5 text-center">
                          Choisissez votre fourchette horaire, d&apos;une durée entre
                          3 et 12 heures, pour le jour de votre choix. <br />
                          Si votre proposition est acceptée, une heure de RDV
                          dans cet interval vous sera donnée.
                        </p>
                        <div className="col fs-5">
                          <label htmlFor="start-date">Entre</label>
                        </div>
                        <div className="col">
                          <input
                            type="datetime-local"
                            id="start-date"
                            min={minDate}
                            value={startDate}
                            onChange={(event) =>
                              handleDateChange(event, setStartDate)
                            }
                            required
                            className="form-control"
                          />
                        </div>
                        <div className="col fs-5">
                          <label htmlFor="end-date">Et</label>
                        </div>
                        <div className="col">
                          <input
                            type="datetime-local"
                            id="end-date"
                            value={endDate}
                            min={minDate}
                            onChange={(event) =>
                              handleDateChange(event, setEndDate)
                            }
                            required
                            className="form-control"
                          />
                        </div>
                      </div>
                      <br />

                      <div className="row align-items-center">
                        <p className="fs-5 text-center">
                          Choisissez votre durée de location souhaitée, 1 jour
                          minimum
                        </p>
                        <div className="col fs-5">
                          <label htmlFor="duration">
                            Durée de location (en jours):
                          </label>
                        </div>
                        <div className="col">
                          <input
                            type="number"
                            id="duration"
                            min={1}
                            max={maximumRental}
                            value={duration}
                            onChange={(event) => handleDurationChange(event)}
                            required
                            onKeyDown={(e) =>
                              (e.key === "." || e.key === ",") &&
                              e.preventDefault()
                            }
                            className="form-control text-center"
                            style={{ maxWidth: "80px" }}
                          />
                        </div>
                        <button
                          type="submit"
                          className="btn btn-info"
                          style={{ maxWidth: "200px" }}
                        >
                          Proposer !
                        </button>
                      </div>
                      <hr />
                      {duration && (
                        <p className="fs-5 text-center">
                          Montant à prévoir: {rate * duration} +{" "}
                          {deposit.split(".")[0]} ={" "}
                          <span style={{ color: "red" }}>
                            {Number(rate) * duration + Number(deposit)} W2R
                          </span>
                          <br />
                          Votre récompense estimée:{" "}
                          <span style={{ color: "blue" }}>
                            {(Number(rate) * duration) / reward} W2R
                          </span>
                          <br />
                          (Le dépôt de garantie de {deposit} W2R vous serait
                          rendu à la fin de la location)
                          <br />
                          Pour l&apos;instant, il ne vous sera rien demandé, mais si
                          votre proposition est acceptée, votre contrat sera
                          débité de ce montant.
                        </p>
                      )}
                    </div>
                  </form>
                </div>
              ) : (
                <p className="text-center fs-4">
                  Vous avez déjà fait une proposition pour ce vélo
                </p>
              )}
            </>
          )}
          <hr />
          <button
            onClick={() => setMakeProposal(false)}
            className="btn btn-danger"
            style={{ margin: "0 auto", display: "block" }}
          >
            Fermer
          </button>
        </div>
      ) : (
        <Loader />
      )}
    </div>
  );
};

export default MakeProposal;
