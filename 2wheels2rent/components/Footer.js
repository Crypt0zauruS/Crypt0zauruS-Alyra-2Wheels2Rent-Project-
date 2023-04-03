import { useState, useEffect, useRef } from "react";

const Footer = ({ show }) => {
  const [modal, setModal] = useState(null);
  const modalRef = useRef(null);

  const handleClickOutside = (event) => {
    if (modalRef.current && !modalRef.current.contains(event.target)) {
      setModal(false);
    }
  };

  useEffect(() => {
    document.addEventListener("click", handleClickOutside, true);
    return () => {
      document.removeEventListener("click", handleClickOutside, true);
    };
  }, []);

  return (
    <div>
      <footer>
        <div style={{ color: "black" }}>
          2Wheels2Rent - 2023 -{" "}
          <span
            onClick={() => {
              setModal(!modal);
            }}
            style={{ cursor: "pointer", color: "orangered" }}
          >
            Disclaimer
          </span>
          <p>
            Made with ❤️ &{" "}
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://vercel.com/docs/concepts/next.js/overview"
            >
              <span style={{ color: "black" }}> Next.js by </span>
            </a>{" "}
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://github.com/Crypt0zauruS/"
            >
              <span style={{ color: "orangered", cursor: "pointer" }}>
                Crypt0zauruS{" "}
              </span>
            </a>
          </p>
        </div>
      </footer>
      {modal && (
        <div
          className="modalContract"
          ref={modalRef}
          style={{ color: "black" }}
        >
          <p>DISCLAIMER</p>
          <hr />
          <p>
            IMPORTANT: PLEASE READ THESE TERMS OF USE CAREFULLY BEFORE USING
            THIS
          </p>
          <button
            type="button"
            className="submit btn btn-danger"
            onClick={() => setModal(false)}
          >
            Fermer
          </button>
        </div>
      )}
    </div>
  );
};

export default Footer;
