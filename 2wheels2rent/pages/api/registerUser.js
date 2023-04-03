// pages/api/registerUser.js
import { admin } from "../../config/firebaseAdmin";
import { ethers } from "ethers";

const firestore = admin.firestore();

export default async function registerUser(req, res) {
  // Verifiez que la méthode utilisée est bien POST
  if (req.method !== "POST") {
    res.status(405).json({ message: "Méthode non autorisée" });
    return;
  }
  try {
    const { name, ethereumAddress, role, latitude, longitude, update } =
      req.body;
    const latRegex =
      /^(\+|-)?(?:90(?:(?:\.0{1,6})?)|(?:[0-9]|[1-8][0-9])(?:(?:\.[0-9]{1,6})?))$/;
    const lonRegex =
      /^(\+|-)?(?:180(?:(?:\.0{1,6})?)|(?:[0-9]|[1-9][0-9]|1[0-7][0-9])(?:(?:\.[0-9]{1,6})?))$/;
    const nameRegex = /^(?=\S)[a-zA-Z0-9À-ÿ.-@$*?#'%! ]{3,40}$/;

    const isValidAddress = ethers.utils.isAddress(ethereumAddress);

    if (
      !isValidAddress ||
      !latRegex.test(latitude) ||
      !lonRegex.test(longitude) ||
      !nameRegex.test(name)
    ) {
      res.status(400).json({ message: "Données manquantes ou invalides" });
      return;
    }
    if (role !== "loueur" && role !== "emprunteur") {
      res.status(400).json({ message: "Role non valide" });
      return;
    }
    // check if user already exists
    const user = await firestore.collection("users").doc(ethereumAddress).get();
    if (user.exists && !update) {
      return res.status(400).json({ message: "L'utilisateur existe déjà" });
    } else if (user.exists && update) {
      await firestore
        .collection("users")
        .doc(ethereumAddress)
        .update({
          coordinates: new admin.firestore.GeoPoint(
            Number(parseFloat(latitude).toFixed(6)),
            Number(parseFloat(longitude).toFixed(6))
          ),
        });
      return res
        .status(200)
        .json({ message: "Coordonnées GPS mises à jour avec succés" });
    } else {
      await firestore
        .collection("users")
        .doc(ethereumAddress)
        .set({
          name,
          ethereumAddress,
          role,
          coordinates: new admin.firestore.GeoPoint(
            Number(parseFloat(latitude).toFixed(6)),
            Number(parseFloat(longitude).toFixed(6))
          ),
        });
      res.status(200).json({ message: "Utlisateur enregistré avec succés" });
    }
  } catch (error) {
    // Réponse en cas d'erreur
    console.error("Erreur lors de l'enregistrement de l'utilisateur:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de l'enregistrement de l'utilisateur" });
  }
}
