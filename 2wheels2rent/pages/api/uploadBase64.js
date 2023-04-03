import { admin } from "../../config/firebaseAdmin";
import { ethers } from "ethers";

const firestore = admin.firestore();

export default async function uploadBase64(req, res) {
  // Vérifiez que la méthode utilisée est bien POST
  if (req.method !== "POST") {
    res.status(405).json({ message: "Méthode non autorisée" });
    return;
  }
  try {
    const { ethereumAddress, base64 } = req.body;
    const isValidAddress = ethers.utils.isAddress(ethereumAddress);
    // Vérifier si l'adresse Ethereum est présente et valide
    if (!isValidAddress) {
      res
        .status(400)
        .json({ message: "Adresse Ethereum manquante ou invalide" });
      return;
    }
    // Vérifiez si l'adresse Ethereum existe dans la collection 'users'
    const userDoc = await firestore
      .collection("users")
      .doc(ethereumAddress)
      .get();
    if (!userDoc.exists) {
      res.status(400).json({ message: "Adresse Ethereum non enregistrée" });
      return;
    }
    if (!base64) {
      res.status(400).json({ message: "Image manquante" });
      return;
    }
    await firestore.collection("users").doc(ethereumAddress).update({
      image: base64,
    });
    res.status(200).json({ message: "Image enregistrée avec succés" });
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de l'image:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de l'enregistrement de l'image" });
  }
}
