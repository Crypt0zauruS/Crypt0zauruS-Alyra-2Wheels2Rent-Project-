import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { format } from "date-fns";
import fr from "date-fns/locale/fr";
import Loader from "./Loader";
// renter
const CheckMyProposals = ({
  contract,
  setCheckMyProposals,
  showToast,
  web3Provider,
  bikeShareAbi,
}) => {
  const [proposals, setProposals] = useState([]);
  const [proposalsToDelete, setProposalsToDelete] = useState([]);
  const [processingDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gpsCoordinates, setGpsCoordinates] = useState({});
  const { address: MyContractAddress } = contract;

  const retrieveProposals = async () => {
    setLoading(true);
    try {
      const length = await contract.getProposalsLength();
      if (Number(length) === 0) return;
      const proposalPromises = Array.from({ length: Number(length) }, (_, i) =>
        contract.proposalsMade(i)
      );
      const allProposals = await Promise.all(proposalPromises);
      setProposals(allProposals);
      await Promise.all(
        allProposals.map(async (proposal) => {
          await retrieveBikeShareProposals(proposal[1]);
        })
      );
    } catch (error) {
      console.log(error);
      showToast("Erreur lors de la récupération des propositions", true);
    } finally {
      setLoading(false);
    }
  };

  const retrieveBikeShareProposals = async (lender) => {
    const bikeShareContract = new ethers.Contract(
      lender,
      bikeShareAbi,
      web3Provider
    );
    try {
      const length = await bikeShareContract?.getProposalsLength();
      if (Number(length) === 0) {
        setProposalsToDelete([...proposalsToDelete, lender]);
        handleCancelProposal(lender);
        return;
      }
      const proposalPromises = Array.from({ length: Number(length) }, (_, i) =>
        bikeShareContract?.proposals(i)
      );
      const allProposals = await Promise.all(proposalPromises);
      const proposals = allProposals.filter((proposal) => {
        return proposal[1] === MyContractAddress;
      });
      if (proposals.length === 0)
        setProposalsToDelete([...proposalsToDelete, lender]);
      await getGpsCoordinates(lender);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const getGpsCoordinates = async (lender) => {
    const bikeShareContract = new ethers.Contract(
      lender,
      bikeShareAbi,
      web3Provider
    );
    if (!ethers.utils.isAddress(lender)) {
      showToast("Adresse invalide", true);
      return;
    }
    try {
      const coordinates = await bikeShareContract?.gpsData(lender);
      setGpsCoordinates((prevCoordinates) => ({
        ...prevCoordinates,
        [lender]: coordinates,
      }));
    } catch (error) {
      console.log(error);
    }
  };

  const handleCancelProposal = async (lender) => {
    if (!ethers.utils.isAddress(lender)) {
      showToast("Adresse invalide", true);
      return;
    }
    setLoading(true);
    try {
      const tx = await contract.cancelProposal(lender);
      await tx.wait();
      contract.once("ProposalCancelled", (lender, date, contract) => {
        console.log(lender, date, contract);
        showToast(
          `Proposition annulée pour ${contract}. Cependant, vous ne pourrez faire de proposition pour ce vélo avant que le propriétaire n'actualise son contrat, ceci pour éviter les abus 😅.`
        );
      });
      retrieveProposals();
    } catch (error) {
      console.log(error);
      showToast("Erreur lors de l'annulation de la proposition", true);
    } finally {
      setLoading(false);
      setCheckMyProposals(false);
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
        });
      }, 2000);
    }
  }, [proposalsToDelete, processingDone]);

  useEffect(() => {
    if (!contract) return;
    retrieveProposals();
  }, [contract]);

  const formatDate = (date) => {
    return format(new Date(date * 1000), "eeee d MMMM", { locale: fr });
  };

  const extractHour = (dateString) => {
    return format(new Date(dateString * 1000), "HH:mm");
  };

  return (
    <div className="modalContract">
      {!loading ? (
        <h2 className="text-center mb-4">
          {proposals.length > 0
            ? "Liste de mes propositions"
            : "Aucune proposition pour l'instant"}
        </h2>
      ) : (
        <Loader />
      )}
      <ul className="list-group">
        {proposals.map(
          (
            [
              date,
              lender,
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

            return (
              <li
                key={index}
                className="list-group-item justify-content-between align-items-start m-2"
                style={{ borderRadius: "30px" }}
              >
                <div className="ms-2 me-auto text-center fs-5">
                  Date de la proposition :{" "}
                  {new Date(date * 1000).toLocaleString()}
                  <br />
                  Période de location souhaitée :<br />
                  {formatDate(rentalDateMin)} entre {rentalDateMinHour} et{" "}
                  {rentalDateMaxHour}
                  <br />
                  Durée de location souhaitée : {rentalDays} jour
                  {rentalDays > 1 && "s"}
                  <br />
                  Prix :{" "}
                  {Number(ethers.utils.formatUnits(rate.toString(), "ether")) *
                    rentalDays}{" "}
                  W2R
                  <br />
                  Dépôt :{" "}
                  {ethers.utils.formatUnits(
                    depositAmount.toString(),
                    "ether"
                  )}{" "}
                  W2R
                  <br />
                  <button
                    disabled={loading}
                    className="btn btn-warning fs-5 m-2"
                    onClick={() => handleCancelProposal(lender)}
                  >
                    Annuler cette proposition
                  </button>
                </div>
              </li>
            );
          }
        )}
      </ul>
      <button
        onClick={() => setCheckMyProposals(false)}
        className="btn btn-danger"
        style={{ margin: "0 auto", display: "block" }}
      >
        Fermer
      </button>
    </div>
  );
};

export default CheckMyProposals;
