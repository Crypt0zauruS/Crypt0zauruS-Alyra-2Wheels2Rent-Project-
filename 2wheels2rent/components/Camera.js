import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

const Camera = ({ setQrData }) => {
  const scannerRef = useRef(null);

  const onScanSuccess = (decodedText) => {
    setQrData(decodedText);
  };

  const onScanFailure = (errorMessage) => {
    if (
      !errorMessage.includes("NotFoundException:") &&
      !errorMessage.includes("No barcode")
    )
      console.error(errorMessage);
  };

  useEffect(() => {
    scannerRef.current = new Html5Qrcode("qr-code-reader");

    const startScanner = async (facingMode) => {
      if (!scannerRef.current) return;

      await scannerRef.current.start(
        { facingMode },
        {
          fps: 10,
          qrbox: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        },
        onScanSuccess,
        onScanFailure
      );
    };

    const getCameraFacingMode = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return "environment";
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput"
      );
      const backCamera = videoDevices.find(
        (device) =>
          device.label.toLowerCase().includes("back") ||
          device.label.toLowerCase().includes("rear") ||
          device.label.toLowerCase().includes("environment")
      );

      return backCamera ? "environment" : "user";
    };

    (async () => {
      const facingMode = await getCameraFacingMode();
      startScanner(facingMode);
    })();

    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop();
        } catch (error) {
          console.error("Error stopping the scanner:", error);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div id="qr-code-reader" />;
};

export default Camera;
