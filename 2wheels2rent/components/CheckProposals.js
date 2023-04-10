import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { format, add, differenceInMinutes } from "date-fns";
import fr from "date-fns/locale/fr";
import Loader from "./Loader";
// lender
const CheckProposals = ({
  contract,
  setCheckProposals,
  showToast,
  w2Rcontract,
  userCoordinates,
  web3Provider,
  bikeRentAbi,
}) => {
  const [proposals, setProposals] = useState([]);
  const [proposalsToDelete, setProposalsToDelete] = useState([]);
  const [processingDone] = useState(false);
  const [meetingHours, setMeetingHours] = useState([]);
  const [loading, setLoading] = useState(false);
  const { address: MyContractAddress } = contract;

  const cleanProposals = async () => {
    try {
      if (proposals.length === 0) {
        showToast("Aucune proposition à supprimer");
        return;
      }
      await contract.deleteOldProposals();
      retrieveProposals();
      showToast("Propositions expirées supprimées");
    } catch (error) {
      console.log(error);
    }
  };

  const retrieveProposals = async () => {
    setLoading(true);
    try {
      const isRented = await contract.isRented();
      if (isRented) {
        showToast("Vous avez déjà en cours de location pour votre vélo", true);
        return;
      }
      const length = await contract.getProposalsLength();
      if (Number(length) === 0) return;
      const proposalPromises = Array.from({ length: Number(length) }, (_, i) =>
        contract.proposals(i)
      );
      const allProposals = await Promise.all(proposalPromises);
      setProposals(allProposals);
      await Promise.all(
        allProposals.map(async (proposal) => {
          await retrieveBikeRentProposals(proposal[1]);
        })
      );
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const retrieveBikeRentProposals = async (renter) => {
    if (!ethers.utils.isAddress(renter)) {
      showToast("Adresse invalide", true);
      return;
    }
    const bikeRentContract = new ethers.Contract(
      renter,
      bikeRentAbi,
      web3Provider
    );
    try {
      const length = await bikeRentContract?.getProposalsLength();
      if (Number(length) === 0) {
        setProposalsToDelete([...proposalsToDelete, renter]);
        handleCancelProposal(renter);
        return;
      }
      const proposalPromises = Array.from({ length: Number(length) }, (_, i) =>
        bikeRentContract.proposalsMade(i)
      );
      const allProposals = await Promise.all(proposalPromises);
      const proposals = allProposals.filter((proposal) => {
        return proposal[1] === MyContractAddress;
      });
      if (proposals.length === 0)
        setProposalsToDelete([...proposalsToDelete, renter]);
    } catch (error) {
      console.log(error);
      //showToast("Erreur lors de la récupération des propositions", true);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptProposal = async (
    renter,
    rentalTime,
    rate,
    depositAmount,
    meetingHour,
    rentalDateMinTimestamp
  ) => {
    if (!ethers.utils.isAddress(renter)) {
      showToast("Adresse invalide", true);
      return;
    }
    try {
      setLoading(true);
      const checkW2Rrenter = await w2Rcontract.balanceOf(renter);
      const rentalDateMinInDate = new Date(rentalDateMinTimestamp * 1000);
      const combinedDateTime = new Date(
        rentalDateMinInDate.getFullYear(),
        rentalDateMinInDate.getMonth(),
        rentalDateMinInDate.getDate(),
        meetingHour.split(":")[0],
        meetingHour.split(":")[1]
      );
      const meetingHourTimestamp = Math.floor(
        combinedDateTime.getTime() / 1000
      );

      if (
        Number(ethers.utils.formatUnits(checkW2Rrenter.toString(), "ether")) <
        Number(ethers.utils.formatUnits(rate.toString(), "ether")) *
          (rentalTime / 86400) +
          Number(ethers.utils.formatUnits(depositAmount.toString(), "ether"))
      ) {
        showToast(
          "Le locataire n'a pas assez de W2R pour accepter la proposition",
          true
        );
        return;
      }

      const tx = await contract.acceptProposal(
        renter,
        meetingHourTimestamp,
        userCoordinates[0].toString(),
        userCoordinates[1].toString()
      );
      await tx.wait();
      contract?.once(
        "BikeRented",
        (renter, rentalTime, meetingHour, rate, depositAmount, price) => {
          console.log(
            renter,
            rentalTime,
            meetingHour,
            rate,
            depositAmount,
            price
          );
          const meetingHourDate = new Date(meetingHour * 1000);
          showToast(`Proposition acceptée pour ${renter} à ${meetingHourDate}`);
        }
      );
    } catch (error) {
      console.log(error);
      showToast(
        "Erreur, ou heure de RDV hors de la fourchette, ou limite quotidienne atteinte pour le demandeur",
        true
      );
    } finally {
      setLoading(false);
      setCheckProposals(false);
    }
  };

  const handleCancelProposal = async (renter) => {
    if (!ethers.utils.isAddress(renter)) {
      showToast("Adresse invalide", true);
      return;
    }
    setLoading(true);
    try {
      const tx = await contract.cancelProposal(renter);
      await tx.wait();
      contract?.once("ProposalCancelled", (renter, date, lender, index) => {
        console.log(renter, date, lender, index);
        showToast(`Proposition annulée pour ${renter}`);
      });
      retrieveProposals();
      setCheckProposals(false);
    } catch (error) {
      console.log(error);
      showToast("Erreur lors de l'annulation de la proposition", true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (processingDone && proposalsToDelete.length > 0) {
      showToast(
        `Vous avez ${proposalsToDelete.length} proposition${
          proposalsToDelete.length > 1 && "s"
        } expirée${proposalsToDelete.length > 1 && "s"} à effacer`
      );
      setTimeout(() => {
        proposalsToDelete.forEach(async (proposal) => {
          await handleCancelProposal(proposal);
          setCheckProposals(false);
        });
      }, 2000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalsToDelete, processingDone]);

  useEffect(() => {
    if (!contract) return;
    alert(
      "N'oubliez pas de nettoyer vos propositions expirées, vous pourriez manquer des locations !"
    );
    retrieveProposals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract]);

  const formatDate = (date) => {
    return format(new Date(date * 1000), "eeee d MMMM", { locale: fr });
  };
  const extractHour = (dateString) => {
    return format(new Date(dateString * 1000), "HH:mm");
  };

  useEffect(() => {
    const initialMeetingHours = proposals.map((proposal) => {
      return extractHour(proposal[2]);
    });
    setMeetingHours(initialMeetingHours);
  }, [proposals]);

  return (
    <div className="modalContract">
      {!loading ? (
        <h2 className="text-center mb-4">
          {proposals.length > 0
            ? `Liste des propositions reçues (${proposals.length})`
            : "Pas de proposition pour l'instant"}
        </h2>
      ) : (
        <Loader />
      )}
      <div>
        <ul className="list-group">
          {proposals.map(
            (
              [
                date,
                renter,
                rentalDateMin,
                rentalDateMax,
                rentalTime,
                rate,
                depositAmount,
              ],
              index
            ) => {
              const rentalDays = rentalTime / 86400;
              const rentalDateMinHour = extractHour(rentalDateMin);
              const rentalDateMaxHour = extractHour(rentalDateMax);
              const rentalDateMinDate = new Date(rentalDateMin * 1000);
              const rentalDateMaxDate = new Date(rentalDateMax * 1000);
              // convert hex rentalDateMin to timestamp
              const rentalDateMinTimestamp = Number(rentalDateMin._hex);

              const diffInMinutes = differenceInMinutes(
                rentalDateMaxDate,
                rentalDateMinDate
              );
              const endDate = add(rentalDateMinDate, {
                days: rentalDays,
                minutes: diffInMinutes / 2,
              });

              const handleMeetingHourChange = (event, index) => {
                const selectedHour = event.target.value;
                const rentalDateMinHour = extractHour(rentalDateMin);
                const rentalDateMaxHour = extractHour(rentalDateMax);

                if (
                  selectedHour >= rentalDateMinHour &&
                  selectedHour <= rentalDateMaxHour
                ) {
                  const updatedMeetingHours = [...meetingHours];
                  updatedMeetingHours[index] = selectedHour;
                  setMeetingHours(updatedMeetingHours);
                } else {
                  showToast(
                    "Vous devez choisir une heure dans la fourchette proposée",
                    true
                  );
                  const updatedMeetingHours = [...meetingHours];
                  updatedMeetingHours[index] = rentalDateMinHour;
                  setMeetingHours(updatedMeetingHours);
                }
              };

              return (
                <li
                  key={index}
                  className="list-group-item justify-content-between align-items-start m-2"
                  style={{ borderRadius: "30px", background: "lightgrey" }}
                >
                  <div className="ms-2 me-auto text-center fs-5">
                    <br />
                    Date de la proposition :{" "}
                    {new Date(date * 1000).toLocaleString()}
                    <br />
                    Heure de RDV souhaitée :<br />
                    {`${formatDate(rentalDateMin)} entre ${extractHour(
                      rentalDateMin
                    )} et ${extractHour(rentalDateMax)}`}
                    <br />
                    Durée de location souhaitée : {rentalDays} jour
                    {rentalDays > 1 && "s"}
                    <br />
                    Date de fin de location calculée:{" "}
                    {format(endDate, "eeee d MMMM à HH:mm", { locale: fr })}
                    <br />
                    <span style={{ color: "green" }}>
                      Vous pourrez vous arranger avec votre 2Wheeler pour une
                      autre heure.{" "}
                    </span>
                    <br />
                    Prix :{" "}
                    {Number(
                      ethers.utils.formatUnits(rate.toString(), "ether")
                    ) * rentalDays}{" "}
                    W2R
                    <br />
                    Dépôt de garantie:{" "}
                    {ethers.utils.formatUnits(
                      depositAmount.toString(),
                      "ether"
                    )}{" "}
                    W2R
                    <br />
                    <p>
                      Choisissez l&apos;heure de rendez-vous:{" "}
                      {formatDate(rentalDateMin)} à{" "}
                      {meetingHours[index] && (
                        <input
                          type="time"
                          min={rentalDateMinHour}
                          max={rentalDateMaxHour}
                          value={meetingHours[index]}
                          onChange={(event) =>
                            handleMeetingHourChange(event, index)
                          }
                        />
                      )}
                    </p>
                    <button
                      className="btn btn-warning fs-5 m-2"
                      disabled={loading}
                      onClick={() =>
                        handleAcceptProposal(
                          renter,
                          rentalTime,
                          rate,
                          depositAmount,
                          meetingHours[index],
                          rentalDateMinTimestamp
                        )
                      }
                    >
                      Accepter
                    </button>
                    <button
                      className="btn btn-danger fs-5 m-2"
                      onClick={() => handleCancelProposal(renter)}
                      disabled={loading}
                    >
                      Refuser
                    </button>
                  </div>
                </li>
              );
            }
          )}
        </ul>
        {proposals.length > 0 && (
          <button
            onClick={cleanProposals}
            className="btn btn-warning m-2"
            style={{ margin: "0 auto", display: "block" }}
            disabled={loading}
          >
            Nettoyer les propositions expirées
          </button>
        )}
      </div>

      <button
        onClick={() => setCheckProposals(false)}
        className="btn btn-danger"
        style={{ margin: "0 auto", display: "block" }}
      >
        Fermer
      </button>
    </div>
  );
};

export default CheckProposals;
