import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvent,
} from "react-leaflet";
import { useWeb3Context } from "../context/";
import useImageClassifier from "../hooks/useImageClassifier";
import { Icon, LatLng } from "leaflet";
import Image from "next/image";
import ImageCropper from "./Cropper";
import useLocateMe from "../hooks/useLocateMe";
import Loader from "./Loader";
import goldenBike from "../private/goldenBike.png";

const UpdateMap = ({ center }) => {
  const map = useMap();
  map.setView(center);
  return null;
};

const NearbyUsersMap = ({
  userCoordinates,
  nearbyUsers,
  setModalNFT,
  setModalContract,
  role,
  showToast,
  checkPhotoLender,
  newRDV,
  setNewRDV,
  updateGPS,
  setUpdateGPS,
  distanceMax,
  updateRDV,
  setMakeProposal,
  setProposalAddress,
  setCheckProposals,
  setCheckMyProposals,
  setLenderRentals,
  setRenterRentals,
  activated,
}) => {
  const { coordinates, locateMe } = useLocateMe();
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [placeName, setPlaceName] = useState("");
  const [placeNames, setPlaceNames] = useState({});
  const [imageSrc, setImageSrc] = useState("");
  const [loader, setLoader] = useState(false);
  const [image, setImage] = useState(null);
  const [cropping, setCropping] = useState(false);
  const { address, network } = useWeb3Context();

  const userIcon = new Icon({
    iconUrl: "/Deco/userMarker4508079mvjvhvhv5454.png",
    iconSize: [75, 75],
  });

  const lenderIcon = new Icon({
    iconUrl: "/Deco/bicycle-jgjh654654645758.png",
    iconSize: [75, 75],
  });

  const renterIcon = new Icon({
    iconUrl: "/Deco/phone-gps-hjfjhh45646.png",
    iconSize: [75, 75],
  });

  const rdvIcon = new Icon({
    iconUrl: "/Deco/rdvMarker-djkhi8682trwegff82r3tfru.png",
    iconSize: [60, 90],
  });

  const HandleMapClick = ({ setNewRDV }) => {
    useMapEvent("click", (e) => {
      if (updateGPS) {
        const distance = new LatLng(coordinates[0], coordinates[1]).distanceTo(
          e.latlng
        );
        if (distance <= distanceMax) {
          setNewRDV([e.latlng.lat?.toFixed(6), e.latlng.lng?.toFixed(6)]);
        } else {
          showToast(
            "Houla ! Vous semblez plus loin que" +
              " " +
              distanceMax / 1000 +
              " " +
              "Km !",
            true
          );
          console.log(
            "Vous ne pouvez pas choisir un point de rendez-vous trop loin"
          );
        }
      }
    });
    return null;
  };

  const fetchPlaceName = async (latitude, longitude, callback) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
      );

      if (response.ok) {
        const data = await response.json();
        callback && callback(data.display_name);
      } else {
        throw new Error("Erreur lors de la récupération du nom du lieu.");
      }
    } catch (error) {
      console.error("Erreur :", error);
      return null;
    }
  };

  const handleGetImage = async (ethereumAddress) => {
    try {
      const response = await fetch("/api/checkPhotoLender", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ethereumAddress, toGet: true }),
      });
      const data = await response.json();
      if (data.image) {
        setImageSrc(`${data.image}`);
      }
    } catch (error) {
      console.error("Erreur :", error);
    }
  };

  const { handleImageUpload } = useImageClassifier(
    address,
    network,
    showToast,
    setImage,
    setLoader,
    setCropping
  );

  const checkUser = () => {
    return true;
  };

  useEffect(() => {
    if (!isMapInitialized) {
      fetchPlaceName(
        userCoordinates[0],
        userCoordinates[1],
        (fetchedPlaceName) => {
          setPlaceName(fetchedPlaceName);
        }
      );
      setIsMapInitialized(true);
    }
  }, [isMapInitialized, userCoordinates]);

  useEffect(() => {
    nearbyUsers.forEach((user, index) => {
      if (!placeNames.hasOwnProperty(index)) {
        fetchPlaceName(
          user.coordinates.latitude,
          user.coordinates.longitude,
          (fetchedPlaceName) => {
            setPlaceNames((prevPlaceNames) => ({
              ...prevPlaceNames,
              [index]: fetchedPlaceName,
            }));
          }
        );
      }
    });
  }, [nearbyUsers, placeNames]);

  useEffect(() => {
    if (address && role === "loueur") {
      handleGetImage(address);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loader]);

  return (
    <div className="container-fluid">
      {isMapInitialized && (
        <>
          <MapContainer
            center={!updateGPS ? userCoordinates : coordinates}
            zoom={13}
            style={{ height: "600px", width: "100%" }}
          >
            <HandleMapClick setNewRDV={setNewRDV} />
            <UpdateMap center={!updateGPS ? userCoordinates : coordinates} />
            <TileLayer
              attribution='&amp;copy <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {!updateGPS && (
              <Marker
                position={[userCoordinates[0], userCoordinates[1]]}
                icon={userIcon}
              >
                <Popup>
                  <div className="popup-user">
                    <h2 className="fs-6">Ma préférence de RDV:</h2>
                    <p
                      className="text-justify-center"
                      style={{ fontSize: "0.9rem" }}
                    >
                      {placeName
                        ? placeName
                        : fetchPlaceName(
                            userCoordinates[0],
                            userCoordinates[1]
                          )}
                    </p>
                    {role === "loueur" && (
                      <>
                        {!loader ? (
                          <Image
                            src={imageSrc ? imageSrc : goldenBike}
                            alt="photo du vélo"
                            width={100}
                            height={100}
                          />
                        ) : (
                          <Loader />
                        )}
                        <label className="btn btn-info">
                          Changer de photo
                          <input
                            type="file"
                            name="cover"
                            onChange={handleImageUpload}
                            accept="img/*"
                            style={{ display: "none" }}
                            disabled={cropping || loader}
                          />
                        </label>
                      </>
                    )}
                    <button className="m-2" onClick={() => setModalNFT(true)}>
                      Mon NFT
                    </button>
                    <button
                      className="m-2"
                      onClick={() => setModalContract(true)}
                    >
                      Mon Contrat
                    </button>{" "}
                    {role === "loueur" ? (
                      <>
                        {activated && (
                          <button
                            className="m-2"
                            onClick={() => setCheckProposals(true)}
                          >
                            Propositions Reçues
                          </button>
                        )}
                      </>
                    ) : role === "emprunteur" ? (
                      <>
                        {activated && (
                          <button
                            className="m-2"
                            onClick={() => setCheckMyProposals(true)}
                          >
                            {" "}
                            Propositions Envoyées
                          </button>
                        )}
                      </>
                    ) : null}
                    {role === "loueur" ? (
                      <>
                        {activated && (
                          <button
                            className="m-2"
                            onClick={() => setLenderRentals(true)}
                          >
                            Gérer mes locations
                          </button>
                        )}
                      </>
                    ) : role === "emprunteur" ? (
                      <>
                        {activated && (
                          <button
                            className="m-2"
                            onClick={() => setRenterRentals(true)}
                          >
                            {" "}
                            Gérer mes locations
                          </button>
                        )}
                      </>
                    ) : null}
                  </div>
                </Popup>
              </Marker>
            )}
            {!updateGPS &&
              nearbyUsers.map((user, index) => (
                <Marker
                  key={index}
                  position={[
                    user.coordinates.latitude,
                    user.coordinates.longitude,
                  ]}
                  icon={
                    user.role === "loueur"
                      ? lenderIcon
                      : user.role === "emprunteur"
                      ? renterIcon
                      : null
                  }
                >
                  <Popup>
                    <div className="popup-user">
                      <h2 className="fs-5">{user.name}</h2>
                      <h2 className="fs-6">Sa préférence de RDV:</h2>
                      <p
                        className="text-justify-center"
                        style={{ fontSize: "0.9rem" }}
                      >
                        {placeNames[index] || "...loading"}
                      </p>
                      {user.role === "loueur" && (
                        <div>
                          <button
                            onClick={() => {
                              setMakeProposal(true);
                              setProposalAddress(user.ethereumAddress);
                            }}
                          >
                            Faire une proposition
                          </button>

                          <Image
                            src={user.image ? user.image : null}
                            alt="photo du vélo"
                            width={100}
                            height={100}
                          />
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            {updateGPS && newRDV?.length === 2 && (
              <Marker position={newRDV} icon={rdvIcon}>
                <Popup>Mon nouvel emplacement de RDV</Popup>
              </Marker>
            )}
            {updateGPS && (
              <Marker position={coordinates} icon={userIcon}>
                <Popup>
                  Ma Nouvelle Localisation :<br />
                  Latitude : {coordinates[0]}
                  <br />
                  Longitude : {coordinates[1]}
                </Popup>
              </Marker>
            )}
          </MapContainer>{" "}
          {image && (
            <div className="crop-container">
              <ImageCropper
                props={{
                  image,
                  setImage,
                  setLoader,
                  loader,
                  setCropping,
                  showToast,
                  checkUser,
                  checkPhotoLender,
                }}
              />
            </div>
          )}
        </>
      )}
      <div>
        <button
          className="btn btn-danger m-2 change-location"
          onClick={() => setUpdateGPS(!updateGPS)}
        >
          {!updateGPS ? "Mettre à jour mon lieu de RDV" : "Retour"}
        </button>
        {updateGPS && (
          <>
            <button className="map-button" onClick={locateMe} disabled={loader}>
              Me localiser
            </button>
            <button className="btn btn-danger m-2" onClick={updateRDV}>
              Mettre à jour
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default NearbyUsersMap;
