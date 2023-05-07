import { useState, useEffect } from "react";
import axios from "axios";

const MaticPrice = () => {
  const [priceUSD, setPriceUSD] = useState("0");
  const [priceEUR, setPriceEUR] = useState("0");
  const [displayUSD, setDisplayUSD] = useState(true);
  const [dataAvailable, setDataAvailable] = useState(false);

  const fetchMaticPrice = async () => {
    try {
      //const response = await axios.get(
      // "https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=usd%2Ceur"
      //);
      const response = await axios.get("/api/coingecko");
      setPriceUSD(response.data["matic-network"].usd.toFixed(2));
      setPriceEUR(response.data["matic-network"].eur.toFixed(2));
      setDataAvailable(true);
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des données de prix:",
        error
      );
      setDataAvailable(false);
    }
  };

  useEffect(() => {
    fetchMaticPrice();

    const interval = setInterval(() => {
      fetchMaticPrice();
    }, 60000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCurrency = () => {
    setDisplayUSD(!displayUSD);
  };

  return dataAvailable ? (
    <div onClick={toggleCurrency} className="fs-6 prices">
      Matic:{" "}
      <span style={{ color: "orange" }}>
        {displayUSD ? `${priceUSD} $` : `${priceEUR} €`}
      </span>{" "}
      - W2R:{" "}
      <span style={{ color: "orange" }}>
        {displayUSD
          ? `${(Number(priceUSD) / 10).toFixed(2)} $`
          : `${(Number(priceEUR) / 10).toFixed(2)} €`}
      </span>
    </div>
  ) : (
    <div className="fs-6 prices">Cours indisponibles</div>
  );
};

export default MaticPrice;
