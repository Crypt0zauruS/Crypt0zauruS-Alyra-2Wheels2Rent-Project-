import { admin } from "../../config/firebaseAdmin";
import { ethers } from "ethers";

// Initialisation de Firestore
const firestore = admin.firestore();

export default async function checkUser(req, res) {
  // Vérifiez que la méthode utilisée est bien POST
  if (req.method !== "POST") {
    res.status(405).json({ message: "Méthode non autorisée" });
    return;
  }
  // Extraire les données de la requête
  const { ethereumAddress } = req.body;
  const isValidAddress = ethers.utils.isAddress(ethereumAddress);
  // Vérifier si l'adresse Ethereum est présente et valide
  if (!isValidAddress) {
    res.status(400).json({ message: "Adresse Ethereum manquante ou invalide" });
    return;
  }
  try {
    // Vérifiez si l'adresse Ethereum existe dans la collection 'users'
    const userDoc = await firestore
      .collection("users")
      .doc(ethereumAddress)
      .get();
    if (userDoc.exists) {
      const { name, role } = userDoc.data();
      if (role === "loueur") {
        res.status(200).json({
          message: "Adresse loueur déjà enregistrée",
          role,
          name,
          exists: true,
        });
      } else if (role === "emprunteur") {
        res.status(200).json({
          message: "Adresse emprunteur déjà enregistrée",
          role,
          name,
          exists: true,
        });
      } else {
        // Si le rôle n'est pas défini, renvoyez une erreur
        res.status(200).json({
          message: "Rôle non défini pour l'utilisateur",
          exists: true,
        });
      }
    } else {
      res
        .status(200)
        .json({ message: "Adresse Ethereum non enregistrée", exists: false });
    }
  } catch (error) {
    console.error(
      "Erreur lors de la vérification de l'adresse Ethereum:",
      error
    );
    res.status(500).json({
      message: "Erreur lors de la vérification de l'adresse Ethereum",
    });
  }
}
