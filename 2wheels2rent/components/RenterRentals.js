import { useState, useEffect } from "react";
import { ethers } from "ethers";
import format from "date-fns/format";
import fr from "date-fns/locale/fr";
import QRCode from "qrcode.react";
import Loader from "./Loader";

const RenterRentals = ({ setRenterRentals, contract, showToast }) => {
  const [rental, setRental] = useState({});
  const [rentals, setRentals] = useState([]);
  const [rentalToken, setRentalToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAllRentals, setShowAllRentals] = useState(false);
  const [countdown, setCountdown] = useState(null);

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp * 1000);
    return format(date, "eeee d MMMM yyyy 'à' HH:mm", { locale: fr });
  };

  const handleCancelRenting = async () => {
    if (rental.cantCancel) return;
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
      });
      retrieveCurrentRental();
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
    try {
      const tx = await contract.returnBike();
      await tx.wait();
      contract.once("RentalDeclaredAsReturned", (lender, date, renter) => {
        showToast(`Location déclarée comme retournée pour ${lender}`);
      });
      retrieveCurrentRental();
    } catch (error) {
      console.log(error);
      showToast("Erreur lors de la déclaration du retour", true);
    }
  };

  const fetchRandomToken = async () => {
    const response = await fetch("/api/randomToken");
    const data = await response.json();
    return data.token;
  };

  const handleGenerateToken = async () => {
    const token = await fetchRandomToken();
    if (!token || typeof token !== "string") return;
    if (token.length !== 30) {
      showToast("Erreur lors de la génération du QR code", true);
      return;
    }
    setLoading(true);
    if (rental.cantCancel && !rental.seemsReturned) {
      alert("Vous aurez 2 transactions à valider");
    }
    try {
      const tx = await contract.setRentalToken(token);
      await tx.wait();
    } catch (error) {
      console.error("Erreur lors de la mise à jour du token :", error);
      setLoading(false);
      return;
    }
    try {
      if (rental.cantCancel && !rental.seemsReturned) {
        await handleDeclareReturn();
      }
      setRentalToken(token);
    } catch (error) {
      console.error("Erreur lors de la mise à jour du token :", error);

      showToast("Erreur lors de l'enregistrement du token", true);
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
      // showToast("Erreur lors de la récupération des locations", true);
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

  useEffect(() => {
    let countdownTimer;
    if (rentalToken) {
      setCountdown(60);
      countdownTimer = setInterval(() => {
        setCountdown((prevCountdown) => {
          if (prevCountdown === 1) {
            clearInterval(countdownTimer);
            setRentalToken("");
            return 0;
          }
          return prevCountdown - 1;
        });
      }, 1000);
    } else {
      setCountdown(null);
      setRentalToken("");
    }

    return () => {
      clearInterval(countdownTimer);
    };
  }, [rentalToken]);

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
                      <table className="table text-center">
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
                            <td>{rental.price + rental.deposit} W2R</td>
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
                                    , je lui présenterai le QR code de fin de
                                    location:{" "}
                                  </div>
                                )}
                                {!rentalToken && !rental.isReturned && (
                                  <button
                                    className="btn btn-warning m-2"
                                    onClick={handleGenerateToken}
                                    disabled={
                                      loading ||
                                      rentalToken ||
                                      rental.isReturned
                                    }
                                  >
                                    {rental.seemsReturned
                                      ? "Réessayer"
                                      : "Générer QR code"}
                                  </button>
                                )}
                              </td>
                            ) : (
                              <>
                                <td>
                                  Annulation{" "}
                                  {Math.floor(Date.now() / 1000) > rental.date
                                    ? "suggérée car l'heure du RDV est dépassée"
                                    : "possible"}
                                  <button
                                    className="btn btn-warning m-2"
                                    onClick={handleCancelRenting}
                                    disabled={loading}
                                  >
                                    Annuler
                                  </button>
                                  <hr />
                                  Je suis avec le loueur, je clique pour lui
                                  présenter mon QR code:
                                  <button
                                    className="btn btn-warning m-2"
                                    onClick={handleGenerateToken}
                                    disabled={loading || rentalToken}
                                  >
                                    Générer QR code
                                  </button>
                                </td>
                              </>
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
      {rentalToken && (
        <div className="qr-code">
          <h3 className="fs-5">
            {countdown > 0 && `Token valide ${countdown} secondes :`}
          </h3>
          <p className="fs-5">{rentalToken}</p>
          <h3 className="fs-5">QR Code :</h3>
          <QRCode value={rentalToken} />
          <button
            className="btn btn-danger m-2"
            disabled={loading}
            onClick={() => setRentalToken("")}
          >
            Je confirme que le QR Code a été scanné par le loueur
          </button>
        </div>
      )}
    </div>
  );
};

export default RenterRentals;
