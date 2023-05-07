import axios from "axios";

export default async function handler(req, res) {
  try {
    const response = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=usd%2Ceur"
    );

    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error fetching data from CoinGecko:", error.message);
    res.status(500).json({ error: "Failed to fetch data from CoinGecko" });
  }
}
