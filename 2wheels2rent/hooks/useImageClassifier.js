import * as mobilenet from "@tensorflow-models/mobilenet";
import * as tf from "@tensorflow/tfjs";

const useImageClassifier = (
  address,
  network,
  showToast,
  setImage,
  setLoader,
  setCropping
) => {
  const handleImageUpload = async (e) => {
    if (!address) return;
    if (!network) return;
    if (!e.target.files[0]) {
      setImage(null);
      e.target.value = null;
      return;
    }
    try {
      setLoader(true);

      let file = e.target.files[0];
      const fileType = file.type;
      let imageURL;

      if (
        typeof window !== "undefined" &&
        (fileType === "image/heic" || fileType === "image/heif")
      ) {
        try {
          const heic2any = require("heic2any");
          const blob = await heic2any({
            blob: file,
            toType: "image/png",
            quality: 0.8,
          });
          imageURL = URL.createObjectURL(blob);
          console.log("Image converted to PNG");
        } catch (conversionError) {
          console.error("Erreur lors de la conversion:", conversionError);
          showToast("Problème lors de la conversion de l'image", true);
          setLoader(false);
          return;
        }
      } else {
        imageURL = URL.createObjectURL(file);
      }
      //const imageURL = URL.createObjectURL(e.target.files[0]);
      const model = await mobilenet.load();
      const imgElement = document.createElement("img");
      imgElement.src = imageURL;
      imgElement.onload = async () => {
        const imgTensor = tf.browser.fromPixels(imgElement);
        const predictions = await model.classify(imgTensor);
        const isBicycle = predictions.some(
          (prediction) =>
            prediction.className.toLowerCase().includes("bike") ||
            prediction.className.toLowerCase().includes("bicycle") ||
            prediction.className.toLowerCase().includes("velo")
        );
        if (isBicycle) {
          console.log("La photo est bien un vélo.");
          setImage(imageURL);
          setCropping(true); // Ajout de setCropping
        } else {
          console.log("La photo n'est pas un vélo.");
          setImage(null);
          setCropping(false);
          showToast("La photo ne semble pas être un vélo", true);
        }
      };
      e.target.value = null;
      file = null;
    } catch (error) {
      console.log("Erreur lors du chargement du modèle:", error);
      showToast("Problème lors du chargement du modèle", true);
    } finally {
      setLoader(false);
    }
  };

  return {
    handleImageUpload: (e) => handleImageUpload(e),
  };
};

export default useImageClassifier;
