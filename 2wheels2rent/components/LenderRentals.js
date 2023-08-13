import { useState, useEffect } from "react";
import { ethers } from "ethers";
import format from "date-fns/format";
import fr from "date-fns/locale/fr";
import Camera from "./Camera";
import Loader from "./Loader";

const LenderRentals = ({ setLenderRentals, contract, showToast, gasPrice }) => {
  const [rental, setRental] = useState({});
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAllRentals, setShowAllRentals] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [qrData, setQrData] = useState(null);

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp * 1000);
    return format(date, "eeee d MMMM yyyy 'à' HH:mm", { locale: fr });
  };

  const handleCancelRental = async () => {
    if (rental.cantCancel) return;
    setLoading(true);
    try {
      const tx = await contract.cancelLending({ gasPrice: gasPrice });
      await tx.wait();
      contract.once(
        "RentingCancelled",
        (renter, depositReturned, returnDate, lender) => {
          console.log(
            "RentingCancelled",
            renter,
            depositReturned,
            returnDate,
            lender
          );
          showToast(
            `Location annulée pour ${renter}, dépôt de ${ethers.utils.formatEther(
              depositReturned
            )} remboursé`
          );
        }
      );
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
      const currentRenter = await contract.currentRenter();
      const rentalsLength = await contract.getRentalsLength(currentRenter);
      if (Number(rentalsLength) === 0) {
        setRental({});
        return;
      }
      const currentRental = await contract.rentals(
        currentRenter,
        Number(rentalsLength) - 1
      );
      setRental({
        date: Number(currentRental[0]), // 1680317880
        duration: Number(currentRental[1]),
        price: Number(ethers.utils.formatEther(currentRental[2])),
        deposit: Number(ethers.utils.formatEther(currentRental[3])),
        reward: Number(ethers.utils.formatEther(currentRental[4])),
        amountAsked: Number(ethers.utils.formatEther(currentRental[5])),
        isAccepted: currentRental[6],
        isRefunded: currentRental[7],
        seemsReturned: currentRental[8],
        cantCancel: currentRental[9],
        isReturned: currentRental[10],
        renter: currentRenter,
      });
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmBikeTaken = async () => {
    if (rental.cantCancel) return;
    if (qrData?.length !== 30 || typeof qrData !== "string") {
      showToast("Veuillez scanner un QR code valide", true);
      return;
    }
    setLoading(true);
    try {
      const tx = await contract.confirmBikeTaken(qrData, {
        gasPrice: gasPrice,
      });
      await tx.wait();
      contract.once("BikeTaken", (renter, date, lender) => {
        console.log("BikeTaken", renter, date, lender);
        showToast(
          "Vélo confirmé comme étant pris le " + formatDate(date.toNumber())
        );
      });
      retrieveCurrentRental();
    } catch (error) {
      console.log(error);
      showToast("Erreur lors de la confirmation de la prise du vélo", true);
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
      const bikeRentedFilter = contract.filters.BikeRented();
      const bikeRentedLogs = await contract.queryFilter(bikeRentedFilter);

      const rentingCancelledFilter = contract.filters.RentingCancelled();
      const rentingCancelledLogs = await contract.queryFilter(
        rentingCancelledFilter
      );

      const cancelledRentals = rentingCancelledLogs.reduce((acc, log) => {
        const parsed = contract.interface.parseLog(log);
        const key = `${parsed.args.renter}-${parsed.args.date}`;
        acc[key] = {
          depositReturned: ethers.utils.formatEther(
            parsed.args.depositReturned
          ),
          returnDate: parsed.args.returnDate.toNumber(),
          lender: parsed.args.lender,
        };
        return acc;
      }, {});

      const rentals = bikeRentedLogs.map((log) => {
        const parsed = contract.interface.parseLog(log);
        const key = `${parsed.args.renter}-${parsed.args.rentalDate}`;
        const rental = {
          renter: parsed.args.renter,
          rentalTime: parsed.args.rentalTime.toNumber(),
          rentalDate: parsed.args.rentalDate.toNumber(),
          rate: ethers.utils.formatEther(parsed.args.rate),
          deposit: ethers.utils.formatEther(parsed.args.deposit),
          rentalPrice: ethers.utils.formatEther(parsed.args.rentalPrice),
        };

        if (cancelledRentals[key]) {
          rental.cancelled = true;
          rental.depositReturned = cancelledRentals[key].depositReturned;
          rental.returnDate = cancelledRentals[key].returnDate;
          rental.lender = cancelledRentals[key].lender;
        }

        return rental;
      });

      setRentals(rentals);
    } catch (error) {
      console.log(error);
      //showToast("Erreur lors de la récupération des locations", true);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmBikeReturned = async () => {
    if (!rental.seemsReturned) return;
    if (qrData?.length !== 30 || typeof qrData !== "string") {
      showToast("Veuillez scanner un QR code valide", true);
      return;
    }
    setLoading(true);
    try {
      const tx = await contract.confirmBikeReturned(qrData, {
        gasPrice: gasPrice,
      });
      await tx.wait();
      contract.once(
        "BikeReturned",
        (rentalDate, renter, depositReturned, returnDate, lender) => {
          console.log(
            "BikeReturned",
            rentalDate,
            renter,
            depositReturned,
            returnDate,
            lender
          );
          showToast(
            `Vélo confirmé comme étant rendu par ${renter} le ${formatDate(
              returnDate.toNumber()
            )}. Le dépôt de ${ethers.utils.formatEther(
              depositReturned
            )} lui a été remboursé. Votre récompense: ${Number(
              rental.reward
            )} W2R`
          );
        }
      );
      retrieveCurrentRental();
    } catch (error) {
      console.log(error);
      showToast("Erreur lors de la confirmation de la reprise du vélo", true);
    } finally {
      setLoading(false);
    }
  };

  const qrCodeButton = () => (
    <button
      type="button"
      className="btn btn-warning"
      style={{
        margin: "0 auto",
        display: "block",
      }}
      onClick={() => {
        if (qrData) {
          setQrData(null);
          return;
        }
        setShowCamera(!showCamera);
      }}
    >
      {!qrData
        ? showCamera
          ? "Annuler le scan"
          : "Scanner le QR code"
        : !showCamera && "Recommencer"}
    </button>
  );

  const renderConfirmationToken = () => {
    if (qrData && qrData.length === 30) {
      return (
        <p className="text-center fs-6 m-2">Token de confirmation: {qrData}</p>
      );
    }
    return null;
  };

  useEffect(() => {
    retrieveRentals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleShowAllRentals = () => {
    setShowAllRentals(true);
  };

  useEffect(() => {
    setShowCamera(false);
    if (qrData?.length == 30) {
      console.log(qrData);
      showToast(
        `Token de confirmation scanné. Vous pouvez cliquer sur "Confirmer la location"`
      );
    } else {
      setQrData(null);
      qrData?.length !== 30 &&
        qrData?.length > 0 &&
        showToast("Token de confirmation invalide", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrData]);

  return (
    <div className="modalContract">
      {!showAllRentals ? (
        <>
          <div className="row">
            <div className="col">
              <h1 className="my-4 text-center fs-3">Location actuelle</h1>
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
                            <th scope="row">Contrat Emprunteur</th>
                            <td style={{ wordBreak: "break-all" }}>
                              {rental.renter}
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
                            {rental.isAccepted && <td>Location acceptée</td>}
                            {rental.isRefunded && <td>Location remboursée</td>}
                            {rental.seemsReturned && (
                              <td>Velo déclaré retourné</td>
                            )}

                            {rental.isReturned && <td>Velo retourné</td>}
                          </tr>
                          {rental.cantCancel && (
                            <tr>
                              <td>
                                {!rental.seemsReturned &&
                                  "Annulation impossible"}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    ) : (
                      <h2 className="fs-5 text-center">
                        Pas de location en ce moment
                      </h2>
                    )}
                    {!rental.cantCancel && rental.date && (
                      <>
                        {!showCamera ? (
                          <div>
                            Annulation{" "}
                            {Math.floor(Date.now() / 1000) > rental.date
                              ? "suggérée car l'heure du RDV est dépassée"
                              : "possible"}
                            <button
                              type="button"
                              className="btn btn-warning m-2"
                              onClick={handleCancelRental}
                              disabled={loading || showCamera}
                            >
                              Annuler la location
                            </button>
                            <hr />
                            <p className="text-center">
                              <span style={{ color: "orangered" }}>
                                Une fois que vous vous trouvez devant votre
                                locataire:
                              </span>{" "}
                              <br />
                              assurez-vous d&apos;avoir convenu avec votre
                              locataire de la date et l&apos;heure de retour
                              vers le{" "}
                              <span style={{ color: "red" }}>
                                {formatDate(rental.date + rental.duration)}
                              </span>
                              . Ensuite, scannez son QR code, puis confirmez la
                              location. <br />
                              Attention, le token de confirmation expire au bout
                              d&apos;une minute.
                            </p>
                          </div>
                        ) : (
                          <Camera setQrData={setQrData} />
                        )}
                        {qrCodeButton()}
                        <hr />
                        <button
                          type="button"
                          className="btn btn-success"
                          onClick={handleConfirmBikeTaken}
                          style={{
                            margin: "0 auto",
                            display: "block",
                          }}
                          disabled={loading || qrData == null}
                        >
                          Confirmer La location
                        </button>
                        {renderConfirmationToken()}
                      </>
                    )}
                    {rental.cantCancel &&
                      rental.date &&
                      rental.seemsReturned &&
                      !rental.isReturned && (
                        <>
                          {showCamera && <Camera setQrData={setQrData} />}
                          {qrCodeButton()}
                          <hr />
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={handleConfirmBikeReturned}
                            style={{
                              margin: "0 auto",
                              display: "block",
                            }}
                            disabled={loading || qrData == null}
                          >
                            Confirmer le retour du vélo ?
                          </button>
                          {renderConfirmationToken()}
                        </>
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
                  type="button"
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
                        className="card-body fs-5"
                        style={{ background: "lightgrey" }}
                      >
                        <table className="table">
                          <tbody>
                            <tr>
                              <th scope="row">Date</th>
                              <td>{formatDate(rental.rentalDate)}</td>
                            </tr>
                            <tr>
                              <th scope="row">Contrat emprunteur</th>
                              <td style={{ wordBreak: "break-all" }}>
                                {rental.renter}
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
                              <th scope="row">Taux</th>
                              <td>{rental.rate} W2R par jour</td>
                            </tr>
                            {rental.cancelled && (
                              <tr>
                                <th scope="row">
                                  Location{" "}
                                  <span style={{ color: "red" }}>annulée</span>{" "}
                                  le {formatDate(rental.returnDate)}
                                </th>
                                <td>{rental.depositReturned} W2R remboursés</td>
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
                type="button"
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
            type="button"
            className="btn btn-info"
            onClick={() => setLenderRentals(false)}
            style={{ margin: "0 auto", display: "block" }}
          >
            Retour
          </button>
        </div>
      </div>
    </div>
  );
};

export default LenderRentals;
