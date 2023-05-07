import { useState, useCallback, useEffect } from "react";
import Cropper from "react-easy-crop";
import getCroppedImg from "./Crop";
import { useWeb3Context } from "../context/";

const ImageCropper = ({ props }) => {
  const {
    image,
    setImage,
    setLoader,
    loader,
    setCropping,
    showToast,
    checkUser,
    checkPhotoLender,
  } = props;
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [croppedImage, setCroppedImage] = useState(null);
  const [picture, setPicture] = useState(null);
  const { address } = useWeb3Context();

  const onCropComplete = useCallback((_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  useEffect(() => {
    setPicture(image);
    setCropping(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image]);

  const showCroppedImage = useCallback(async () => {
    try {
      const croppImage = await getCroppedImg(
        image,
        croppedAreaPixels,
        rotation
      );
      setCroppedImage(croppImage);
    } catch (e) {
      console.error(e);
    }
  }, [croppedAreaPixels, rotation, image]);

  const onClose = () => {
    setCroppedImage(null);
    setImage(null);
  };

  const onUpload = async () => {
    setLoader(true);
    if (!checkUser(false)) {
      showToast("Enregistrez-vous d'abord pour uploader une image", true);
      setLoader(false);
      return;
    }
    if (!croppedImage) {
      showToast("Cropper l'image avant upload", true);
      setLoader(false);
      return;
    } else if (getSizeOfBase64Image(croppedImage) > 3000) {
      showToast("Image trop lourde", true);
      setLoader(false);
      return;
    }
    //0x4f786A57db2A518D3418872f265db6A5997c21D5
    try {
      const response = await fetch("/api/uploadBase64", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ethereumAddress: address,
          base64: croppedImage,
        }),
      });
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      await checkPhotoLender();
      showToast("Image enregistrée avec succès", false);
    } catch (e) {
      console.error(e);
      showToast("Erreur lors de l'enregistrement de l'image", true);
    } finally {
      onClose();
      setLoader(false);
      setCropping(false);
    }
  };

  const getSizeOfBase64Image = (base64Image) => {
    const stringLength = base64Image.split(",")[1].length;
    const sizeInBytes = 4 * Math.ceil(stringLength / 3) * 0.5624896334383812;
    const sizeInKb = Math.floor(sizeInBytes / 1000);
    return sizeInKb;
  };

  return (
    <div>
      <div className="cropper">
        <Cropper
          image={picture}
          crop={crop}
          rotation={rotation}
          zoom={zoom}
          zoomSpeed={4}
          maxZoom={3}
          zoomWithScroll={true}
          showGrid={true}
          aspect={5 / 5}
          cropShape="round"
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={onCropComplete}
        />
      </div>
      <div className="controls">
        <div className="cropped-image-container">
          {croppedImage && (
            <>
              <button
                type="button"
                onClick={() => {
                  setCropping(false);
                  setPicture(null);
                  onClose();
                }}
                style={{ marginTop: "-100px" }}
                className="btn btn-info"
                disabled={loader}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpload();
                  setTimeout(() => {
                    onClose();
                  }, 1000);
                }}
                style={{ marginTop: "-90px" }}
                className="btn btn-info"
                disabled={loader}
              >
                Uploader la photo
              </button>
            </>
          )}
          {croppedImage && (
            <img className="cropped-image" src={croppedImage} alt="cropped" />
          )}
        </div>
        <button
          type="button"
          className="crop-button btn btn-info"
          style={{
            display: image === null || croppedImage !== null ? "none" : "block",
          }}
          onClick={showCroppedImage}
        >
          Rogner
        </button>
        <button
        type="button"
          style={{
            display: image === null || croppedImage !== null ? "none" : "block",
          }}
          onClick={() => {
            onClose();
            setPicture(null);
            setCropping(false);
          }}
          className="crop-button2 btn btn-info"
        >
          Annuler
        </button>
        <label>Zoom</label>
        <input
          type="range"
          value={zoom}
          min={1}
          max={3}
          step={0.1}
          disabled={croppedImage}
          aria-labelledby="Zoom"
          className="range"
          onChange={(e) => {
            setZoom(e.target.value);
          }}
        ></input>
        <label>Rotation</label>
        <input
          type="range"
          value={rotation}
          min={0}
          max={360}
          disabled={croppedImage}
          aria-labelledby="Rotate"
          className="range"
          onChange={(e) => setRotation(e.target.value)}
        ></input>
      </div>
    </div>
  );
};

export default ImageCropper;
