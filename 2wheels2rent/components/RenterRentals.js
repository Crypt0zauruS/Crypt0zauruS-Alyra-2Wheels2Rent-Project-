import { useState, useEffect } from "react";
import { ethers } from "ethers";
import format from "date-fns/format";
import fr from "date-fns/locale/fr";
import Loader from "./Loader";

const RenterRentals = ({ setRenterRentals, contract, showToast }) => {
  const [rental, setRental] = useState({});
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAllRentals, setShowAllRentals] = useState(false);

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp * 1000);
    return format(date, "eeee d MMMM yyyy 'à' HH:mm", { locale: fr });
  };

  const handleCancelRenting = async () => {
    setLoading(true);
    try {
      const tx = await contract.cancelRenting();
      await tx.wait();
      contract.once("RentalCancelled", (lender, refund) => {
        showToast(
          `Location annulée pour ${lender}, ${ethers.utils.formatEther(
            refund
          )} W2R remboursés`
        );
        retrieveCurrentRental();
      });
    } catch (error) {
      console.log(error);
      showToast("Erreur lors de l'annulation de la location", true);
    } finally {
      setLoading(false);
    }
  };

  const retrieveCurrentRental = async () => {
    setLoading(true);
    try {
      const currentLender = await contract.currentLender();
      const rentalsLength = await contract.getRentalsLength(currentLender);
      if (Number(rentalsLength) === 0) {
        setRental({});
        return;
      }
      const currentRental = await contract.rentals(
        currentLender,
        Number(rentalsLength) - 1
      );
      setRental({
        date: Number(currentRental[0]), // 1680317880
        duration: Number(currentRental[1]),
        price: Number(ethers.utils.formatEther(currentRental[2])),
        deposit: Number(ethers.utils.formatEther(currentRental[3])),
        reward: Number(ethers.utils.formatEther(currentRental[4])),
        isReturned: currentRental[5],
        isRefunded: currentRental[6],
        seemsReturned: currentRental[7],
        cantCancel: currentRental[8],
        lender: currentLender,
      });
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeclareReturn = async () => {
    setLoading(true);
    try {
      const tx = await contract.returnBike();
      await tx.wait();
      contract.once("RentalDeclaredAsReturned", (lender, date, renter) => {
        showToast(`Location déclarée comme retournée pour ${lender}`);
        retrieveCurrentRental();
      });
    } catch (error) {
      console.log(error);
      showToast("Erreur lors de la déclaration du retour", true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    retrieveCurrentRental();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleShowCurrentRental = () => {
    setShowAllRentals(false);
  };

  const retrieveRentals = async () => {
    setLoading(true);
    try {
      const rentalStartedFilter = contract.filters.RentalStarted();
      const rentalStartedLogs = await contract.queryFilter(rentalStartedFilter);

      const rentalCancelledFilter = contract.filters.RentalCancelled();
      const rentalCancelledLogs = await contract.queryFilter(
        rentalCancelledFilter
      );

      const cancelledRentals = rentalCancelledLogs.reduce((acc, log) => {
        const parsed = contract.interface.parseLog(log);
        const key = `${parsed.args.lender}-${parsed.args.renter}-${parsed.args.date}`;
        acc[key] = {
          refund: ethers.utils.formatEther(parsed.args.refund),
          returnDate: parsed.args.returnDate.toNumber(),
        };
        return acc;
      }, {});

      const rentals = rentalStartedLogs.map((log) => {
        const parsed = contract.interface.parseLog(log);
        const key = `${parsed.args.lender}-${parsed.args.renter}-${parsed.args.date}`;
        const rental = {
          renter: parsed.args.renter,
          rentalDate: parsed.args.date.toNumber(),
          rentalTime: parsed.args.rentalTime.toNumber(),
          rentalPrice: ethers.utils.formatEther(parsed.args.rentalPrice),
          deposit: ethers.utils.formatEther(parsed.args.deposit),
          amount: ethers.utils.formatEther(parsed.args.amountRequired),
          lender: parsed.args.lender,
        };

        if (cancelledRentals[key]) {
          rental.cancelled = true;
          rental.refund = cancelledRentals[key].refund;
          rental.returnDate = cancelledRentals[key].returnDate;
        }

        return rental;
      });

      setRentals(rentals);
    } catch (error) {
      console.log(error);
      showToast("Erreur lors de la récupération des locations", true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    retrieveRentals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleShowAllRentals = () => {
    setShowAllRentals(true);
  };

  return (
    <div className="modalContract">
      {!showAllRentals ? (
        <>
          <div className="row">
            <div className="col">
              <h1 className="my-4 text-center fs-3">Location en cours</h1>
            </div>
          </div>
          {loading ? (
            <Loader />
          ) : (
            <div className="row">
              <div className="col">
                <div className="card">
                  <div
                    className="card-body fs-5"
                    style={{ background: "lightgrey" }}
                  >
                    {rental.date ? (
                      <table className="table">
                        <tbody>
                          <tr>
                            <th scope="row">Date</th>
                            <td>{formatDate(rental.date)}</td>
                          </tr>
                          <tr>
                            <th scope="row">Contrat Loueur</th>
                            <td style={{ wordBreak: "break-all" }}>
                              {rental.lender}
                            </td>
                          </tr>

                          <tr>
                            <th scope="row">Durée</th>
                            <td>
                              {rental.duration / 86400} jour
                              {rental.duration / 86400 > 1 && "s"}
                            </td>
                          </tr>
                          <tr>
                            <th scope="row">Prix</th>
                            <td>{rental.price} W2R</td>
                          </tr>
                          <tr>
                            <th scope="row">Dépôt de garantie</th>
                            <td>{rental.deposit} W2R</td>
                          </tr>
                          <tr>
                            <th scope="row">Total</th>
                            <td>{rental.total} W2R</td>
                          </tr>
                          <tr>
                            <th scope="row">Récompense</th>
                            <td>{rental.reward} W2R</td>
                          </tr>
                          <tr>
                            <th scope="row">Statut</th>

                            {rental.isRefunded && <td>Location remboursée</td>}
                            {rental.seemsReturned && (
                              <td>Velo déclaré retourné</td>
                            )}
                            {rental.cantCancel ? (
                              <td>
                                {!rental.seemsReturned && (
                                  <div>
                                    Lorsque je serai devant le ou la
                                    propriétaire du vélo au maximum le{" "}
                                    <span style={{ color: "red" }}>
                                      {formatDate(
                                        rental.date + rental.duration
                                      )}
                                    </span>
                                    , je le déclarerai comme rendu:{" "}
                                    <button
                                      className="btn btn-warning m-2"
                                      onClick={handleDeclareReturn}
                                    >
                                      Vélo rendu
                                    </button>
                                  </div>
                                )}
                              </td>
                            ) : (
                              <td>
                                Annulation possible
                                <button
                                  className="btn btn-warning m-2"
                                  onClick={handleCancelRenting}
                                >
                                  Annuler
                                </button>
                              </td>
                            )}
                            {rental.isReturned && <td>Velo retourné</td>}
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <h2 className="fs-5 text-center">
                        Pas de location en ce moment
                      </h2>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="row mt-4">
            <div className="col">
              {rentals.length > 0 && (
                <button
                  className="btn btn-info"
                  onClick={handleShowAllRentals}
                  style={{ margin: "0 auto", display: "block" }}
                >
                  Voir toutes mes locations
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {rentals.length > 0 ? (
            rentals
              .map((rental, index) => (
                <div key={index} className="row">
                  <div className="col">
                    <div className="card m-2">
                      <div
                        className="card-body fs-5 "
                        style={{ background: "lightgrey" }}
                      >
                        <table className="table">
                          <tbody>
                            <tr>
                              <th scope="row">Date</th>
                              <td>{formatDate(rental.rentalDate)}</td>
                            </tr>
                            <tr>
                              <th scope="row">Contrat Loueur</th>
                              <td style={{ wordBreak: "break-all" }}>
                                {rental.lender}
                              </td>
                            </tr>

                            <tr>
                              <th scope="row">Durée</th>
                              <td>
                                {rental.rentalTime / 86400} jour
                                {rental.rentalTime / 86400 > 1 && "s"}
                              </td>
                            </tr>
                            <tr>
                              <th scope="row">Prix</th>
                              <td>{rental.rentalPrice} W2R</td>
                            </tr>
                            <tr>
                              <th scope="row">Dépôt de garantie</th>
                              <td>{rental.deposit} W2R</td>
                            </tr>
                            <tr>
                              <th scope="row">Total</th>
                              <td>{rental.amount} W2R</td>
                            </tr>
                            {rental.cancelled && (
                              <tr>
                                <th scope="row">
                                  Location{" "}
                                  <span style={{ color: "red" }}>annulée</span>{" "}
                                  le {formatDate(rental.returnDate)}
                                </th>
                                <td>{rental.refund} W2R remboursés</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              ))
              .reverse()
          ) : (
            <h2 className="fs-5 text-center">Pas de location en ce moment</h2>
          )}
          <div className="row mt-4">
            <div className="col">
              <button
                className="btn btn-info"
                onClick={handleShowCurrentRental}
                style={{ margin: "0 auto", display: "block" }}
              >
                Voir la location actuelle
              </button>
            </div>
          </div>
        </>
      )}
      <div className="row mt-4">
        <div className="col">
          <button
            className="btn btn-info"
            onClick={() => setRenterRentals(false)}
            style={{ margin: "0 auto", display: "block" }}
          >
            Retour
          </button>
        </div>
      </div>
    </div>
  );
};

export default RenterRentals;
