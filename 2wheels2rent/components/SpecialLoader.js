import { useEffect, useState } from "react";
import Image from "next/image";
import goldenBike from "../private/goldenBike.png";

const SpecialLoader = () => {
  const [pixellated, setPixellated] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setPixellated(!pixellated);
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [pixellated]);

  return (
    <div className={`special-loader ${pixellated ? "pixellated" : ""}`}>
      <Image
        src={goldenBike}
        alt="Special Loader"
        width={520}
        height={384}
        style={{ width: "100%" }}
      />
    </div>
  );
};

export default SpecialLoader;
