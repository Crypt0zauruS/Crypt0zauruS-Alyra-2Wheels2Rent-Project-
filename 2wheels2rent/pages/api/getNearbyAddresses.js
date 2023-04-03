import { admin } from "../../config/firebaseAdmin";
import { getDistance } from "geolib";

const firestore = admin.firestore();
let radius;

async function getUserCoordinates(ethereumAddress) {
  const userDoc = await firestore
    .collection("users")
    .doc(ethereumAddress)
    .get();
  if (userDoc.exists) {
    const user = userDoc.data();
    return [
      parseFloat(user.coordinates.latitude.toFixed(6)),
      parseFloat(user.coordinates.longitude.toFixed(6)),
    ];
  }
  return null;
}

async function getNearbyUsers(lat, lon, ethereumAddress) {
  const usersSnapshot = await firestore.collection("users").get();
  const nearbyUsers = [];
  usersSnapshot.forEach((doc) => {
    const user = doc.data();
    const userCoordinates = [
      parseFloat(user.coordinates.latitude.toFixed(6)),
      parseFloat(user.coordinates.longitude.toFixed(6)),
    ];
    const distanceInMeters = getDistance(
      { lat, lon },
      { latitude: userCoordinates[0], longitude: userCoordinates[1] }
    );
    if (
      distanceInMeters <= radius &&
      user.ethereumAddress !== ethereumAddress
    ) {
      nearbyUsers.push({
        ethereumAddress: user.ethereumAddress,
        role: user.role,
        name: user.name,
        coordinates: {
          latitude: userCoordinates[0],
          longitude: userCoordinates[1],
        },
        image: user.image ? user.image : null,
      });
    }
  });

  return nearbyUsers;
}

export default async function getNearbyAddresses(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Méthode non autorisée" });
    return;
  }
  const { ethereumAddress, rad } = req.body;
  radius = rad;
  try {
    const userCoordinates = await getUserCoordinates(ethereumAddress);
    if (userCoordinates) {
      const nearbyUsers = await getNearbyUsers(
        ...userCoordinates,
        ethereumAddress
      );
      res.status(200).json({ userCoordinates, nearbyUsers });
    } else {
      res.status(404).json({ message: "Utilisateur non trouvé" });
    }
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des utilisateurs" });
  }
}
