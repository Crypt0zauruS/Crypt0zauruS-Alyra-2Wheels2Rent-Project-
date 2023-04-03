import { admin } from "../../config/firebaseAdmin";
import { ethers } from "ethers";

const firestore = admin.firestore();

export default async function removeUser(req, res) {
  // Verify that the method used is POST
  if (req.method !== "POST") {
    res.status(405).json({ message: "Méthode non autorisée" });
    return;
  }
  try {
    const { ethereumAddress } = req.body;
    const isValidAddress = ethers.utils.isAddress(ethereumAddress);
    if (!isValidAddress) {
      res.status(400).json({ message: "Adresse Ethereum invalide" });
      return;
    }
    // Check if user exists
    const user = await firestore.collection("users").doc(ethereumAddress).get();
    if (!user.exists) {
      return res.status(400).json({ message: "L'utilisateur n'existe pas" });
    }
    // Delete user
    await firestore.collection("users").doc(ethereumAddress).delete();
    res.status(200).json({ message: "Utilisateur supprimé avec succès" });
  } catch (error) {
    console.error("Erreur lors de la suppression de l'utilisateur:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la suppression de l'utilisateur" });
  }
}
