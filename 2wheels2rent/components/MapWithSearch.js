import { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvent,
} from "react-leaflet";
import { Icon, LatLng } from "leaflet";
import useLocateMe from "../hooks/useLocateMe";
import axios from "axios";
import Loader from "./Loader";

const UpdateMap = ({ center }) => {
  const map = useMap();
  map.setView(center);
  return null;
};

const MapComponent = ({ setRDV, RDV, showToast }) => {
  const { coordinates, setCoordinates, locateMe } = useLocateMe();
  const [searchQuery, setSearchQuery] = useState("");
  const [distanceMax, setDistanceMax] = useState(5000);
  const [loader, setLoader] = useState(false);
  const [isMapInitialized, setIsMapInitialized] = useState(false);

  const userIcon = new Icon({
    iconUrl: "/Deco/userMarker4508079mvjvhvhv5454.png",
    iconSize: [75, 75],
  });

  const rdvIcon = new Icon({
    iconUrl: "/Deco/rdvMarker-djkhi8682trwegff82r3tfru.png",
    iconSize: [60, 90],
  });

  const RDVMarker = ({ setRDV }) => {
    useMapEvent("click", (e) => {
      const distance = new LatLng(coordinates[0], coordinates[1]).distanceTo(
        e.latlng
      );
      if (distance <= distanceMax) {
        setRDV([e.latlng.lat?.toFixed(6), e.latlng.lng?.toFixed(6)]);
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
    });
    return (
      RDV.length === 2 && (
        <Marker position={RDV} icon={rdvIcon}>
          <Popup>
            Coordonnées du RDV :<br />
            Latitude : {RDV[0]}
            <br />
            Longitude : {RDV[1]}
          </Popup>
        </Marker>
      )
    );
  };

  const handleSearchChange = async (e) => {
    setSearchQuery(e.target.value);
    await handleSearchSubmit(e.target.value);
  };

  const handleSearchSubmit = async (query) => {
    if (query.trim() !== "") {
      try {
        const response = await axios.get(
          "https://nominatim.openstreetmap.org/search",
          {
            params: {
              q: query,
              format: "json",
              limit: 1,
            },
          }
        );

        if (response.data && response.data.length > 0) {
          const { lat, lon } = response.data[0];
          setCoordinates([parseFloat(lat), parseFloat(lon)]);
        }
      } catch (error) {
        console.error("Error fetching location data:", error);
      }
    }
  };

  useEffect(() => {
    if (!isMapInitialized) {
      setIsMapInitialized(true);
    }
  }, [isMapInitialized]);

  return (
    <div style={{ width: "90%" }}>
      {!loader ? (
        <button className="map-button" onClick={locateMe} disabled={loader}>
          Me localiser
        </button>
      ) : (
        <Loader />
      )}
      <input
        className="map-input"
        type="text"
        onChange={handleSearchChange}
        value={searchQuery}
        placeholder="Entrer une adresse"
        style={{ width: "100%", marginBottom: "1rem" }}
      />

      {isMapInitialized ? (
        <>
          <MapContainer
            center={coordinates}
            zoom={13}
            style={{ height: "400px", width: "100%" }}
          >
            <UpdateMap center={coordinates} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={coordinates} icon={userIcon}>
              <Popup>
                Vos coordonnées :<br />
                Latitude : {coordinates[0]}
                <br />
                Longitude : {coordinates[1]}
              </Popup>
            </Marker>
            <RDVMarker setRDV={setRDV} />
          </MapContainer>
          <div className="slider-container">
            <label htmlFor="distanceMax" className="slider-label">
              Distance Max entre votre position et le lieu de RDV
            </label>
            <input
              id="distanceMax"
              type="range"
              min="0"
              max="10000"
              step="1000"
              value={distanceMax}
              onChange={(e) => setDistanceMax(e.target.value)}
            />
            <span className="slider-value"> {distanceMax / 1000} Km</span>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default MapComponent;
