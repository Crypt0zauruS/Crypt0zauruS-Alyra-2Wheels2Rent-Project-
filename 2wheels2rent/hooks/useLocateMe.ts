import { useState } from "react";

const useLocateMe = () => {
  const [coordinates, setCoordinates] = useState([-48.876667, -123.393333]);

  const locateMe = async () => {
    try {
      if (navigator.geolocation) {
        const success = async (position: any) => {
          const { latitude, longitude } = position.coords;
          setCoordinates([latitude, longitude]);
        };
        const error = (err: any) => {
          console.warn(`ERREUR(${err.code}): ${err.message}`);
        };
        navigator.geolocation.getCurrentPosition(success, error);
      } else {
        console.log(
          "La géolocalisation n'est pas prise en charge par ce navigateur."
        );
      }
    } catch (error) {
      console.log(error);
    }
  };

  return { coordinates, setCoordinates, locateMe };
};

export default useLocateMe;
