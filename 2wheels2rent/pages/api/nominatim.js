import axios from "axios";

export default async function handler(req, res) {
  const { type, ...otherQueryParams } = req.query;

  if (type !== "search" && type !== "reverse") {
    res
      .status(400)
      .json({ message: "Invalid request type. Use 'search' or 'reverse'." });
    return;
  }

  try {
    const params = new URLSearchParams({
      ...otherQueryParams,
      format: "json",
    });

    const url = `https://nominatim.openstreetmap.org/${type}?${params.toString()}`;

    const response = await axios.get(url, {
      headers: {
        "User-Agent": "YourAppName",
      },
    });

    res.status(200).json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ message: error.message });
  }
}
