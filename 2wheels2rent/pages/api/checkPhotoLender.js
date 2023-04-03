import { admin } from "../../config/firebaseAdmin";
import { ethers } from "ethers";

// Initialisation de Firestore
const firestore = admin.firestore();

export default async function checkPhotoLender(req, res) {
  // Vérifiez que la méthode utilisée est bien POST
  if (req.method !== "POST") {
    res.status(405).json({ message: "Méthode non autorisée" });
    return;
  }
  // Extraire les données de la requête
  const { ethereumAddress, toGet } = req.body;
  const isValidAddress = ethers.utils.isAddress(ethereumAddress);
  // Vérifier si l'adresse Ethereum est présente et valide
  if (!isValidAddress) {
    res.status(400).json({ message: "Adresse Ethereum manquante ou invalide" });
    return;
  }
  try {
    const userDoc = await firestore
      .collection("users")
      .doc(ethereumAddress)
      .get();
    if (userDoc.exists) {
      const { image, role } = userDoc.data();
      if (image && role === "loueur") {
        if (toGet === false) {
          res
            .status(200)
            .json({ message: "Photo du prêteur présente", exists: true });
        } else {
          res.status(200).json({ message: "Photo du prêteur présente", image });
        }
      } else {
        res.status(200).json({ message: "Photo absente", exists: false });
      }
    } else {
      res.status(200).json({ message: "Photo absente", exists: false });
    }
  } catch (error) {
    console.error(
      "Erreur lors de la vérification de la photo du prêteur:",
      error
    );
    res.status(500).json({
      message: "Erreur lors de la vérification de la photo du prêteur",
    });
  }
}
