import Select from "react-select";
import DOMPurify from "isomorphic-dompurify";

const BikeRenterForm = ({
  pseudo,
  onPseudoChange,
  selectedType,
  onTypeChange,
}) => {
  const bikeTypes = ["Sport", "Urbain", "Tout terrain"];

  const bikeTypeOptions = bikeTypes.map((type) => ({
    value: type,
    label: type,
  }));

  const handlePseudoChange = (e) => {
    onPseudoChange(
      DOMPurify.sanitize(e.target.value.replace(/</g, "").replace(/>/g, ""))
    );
  };

  const handleTypeChange = (selectedOption) => {
    onTypeChange(selectedOption);
  };

  return (
    <div className="bike-rental-form-container">
      <h1>Emprunteur de vélo</h1>
      <label htmlFor="pseudo" className="bike-rental-form-label">
        Pseudo :
      </label>
      <input
        type="text"
        id="pseudo"
        value={pseudo}
        onChange={handlePseudoChange}
        className="bike-rental-form-input"
        placeholder="Entrez votre pseudo"
      />
      <h2>Préférence de vélo</h2>
      <Select
        options={bikeTypeOptions}
        onChange={handleTypeChange}
        isSearchable={false}
        isClearable
        className="bike-rental-form-select"
        placeholder="Choisir un type de vélo"
      />
      {selectedType && (
        <p className="bike-rental-form-confirmation">
          Vous avez choisi : <strong>{selectedType.label}</strong>
        </p>
      )}
    </div>
  );
};

export default BikeRenterForm;
