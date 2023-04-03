import { useState, useMemo } from "react";
import Select from "react-select";
import DOMPurify from "isomorphic-dompurify";
import { bikeBrands } from "../utils";

const BikeLenderForm = ({
  username,
  onUsernameChange,
  selectedBrand,
  onBrandChange,
  serialNumber,
  onSerialNumberChange,
  registrationNumber,
  onRegistrationNumberChange,
  onSearchTermChange,
  model,
  onModelBikeChange,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredOptions = useMemo(() => {
    if (searchTerm === "") {
      return bikeBrands.map((brand) => ({ value: brand, label: brand }));
    }
    return bikeBrands
      .filter((brand) => brand.toLowerCase().includes(searchTerm.toLowerCase()))
      .map((brand) => ({ value: brand, label: brand }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, bikeBrands]);

  const handleInputChange = (input) => {
    setSearchTerm(input);
    onSearchTermChange(input);
  };

  const handleUsernameChange = (e) => {
    onUsernameChange(
      DOMPurify.sanitize(e.target.value.replace(/</g, "").replace(/>/g, ""))
    );
  };

  const handleBrandChange = (selectedOption) => {
    onBrandChange(selectedOption);
  };

  const handleSerialNumberChange = (e) => {
    onSerialNumberChange(
      DOMPurify.sanitize(e.target.value.replace(/</g, "").replace(/>/g, ""))
    );
  };

  const handleModelBikeChange = (e) => {
    onModelBikeChange(
      DOMPurify.sanitize(e.target.value.replace(/</g, "").replace(/>/g, ""))
    );
  };

  const handleRegistrationNumberChange = (e) => {
    onRegistrationNumberChange(
      DOMPurify.sanitize(e.target.value.replace(/</g, "").replace(/>/g, ""))
    );
  };

  return (
    <div className="bike-rental-form-container">
      <form className="bike-rental-form">
        <label htmlFor="username">Pseudo:</label>
        <input
          type="text"
          id="username"
          value={username}
          onChange={handleUsernameChange}
          placeholder="Pseudo 4 à 16 caractères"
          required
        />

        <h1>Choisir une marque de vélo</h1>
        <Select
          options={filteredOptions}
          onInputChange={handleInputChange}
          onChange={handleBrandChange}
          isSearchable
          isClearable
          noOptionsMessage={() => null}
          placeholder="Choisir une marque de vélo"
        />
        {selectedBrand && (
          <p>
            Vous avez choisi : <strong>{selectedBrand.label}</strong>
          </p>
        )}

        <label htmlFor="model">Modèle:</label>
        <input
          type="text"
          id="model"
          value={model}
          onChange={handleModelBikeChange}
          placeholder="Modèle du vélo"
          required
        />

        <label htmlFor="serialNumber">Numéro de série:</label>
        <input
          type="text"
          id="serialNumber"
          value={serialNumber}
          onChange={handleSerialNumberChange}
          placeholder="Numéro de série"
          required
        />

        <label htmlFor="registrationNumber">
          Numéro d&apos;immatriculation:
        </label>
        <input
          type="text"
          id="registrationNumber"
          value={registrationNumber}
          onChange={handleRegistrationNumberChange}
          placeholder="Numéro d'immatriculation"
          required
        />
      </form>
    </div>
  );
};

export default BikeLenderForm;
