const BikeRent = artifacts.require("./BikeRent.sol");
const BikeShare = artifacts.require("./BikeShare.sol");
const W2R = artifacts.require("W2R.sol");
const initialSupply = 160000000;
const VaultW2R = artifacts.require("VaultW2R.sol");
const MaticW2RPairToken = artifacts.require("MaticW2RPairToken.sol");
const MaticW2Rdex = artifacts.require("MaticW2Rdex.sol");
const initialSwapRate = 10;
const TwoWheels2RentLender = artifacts.require("TwoWheels2RentLender.sol");
const TwoWheels2RentRenter = artifacts.require("TwoWheels2RentRenter.sol");
const LenderWhitelist = artifacts.require("LenderWhitelist.sol");
const RenterWhitelist = artifacts.require("RenterWhitelist.sol");
const lenderIPFS = "lenderIPFS";
const renterIPFS = "renterIPFS";
const { expect } = require("chai");

contract("BikeShare Deployment", (accounts) => {
  let bikeShare;
  let W2RInstance;
  const owner = accounts[0];

  beforeEach(async () => {
    W2RInstance = await W2R.new(initialSupply, { from: owner });

    const VaultW2RInstance = await VaultW2R.new(W2RInstance.address, {
      from: owner,
    });
    const MaticW2RPairTokenInstance = await MaticW2RPairToken.new({
      from: owner,
    });

    const MaticW2RdexInstance = await MaticW2Rdex.new(
      W2RInstance.address,
      initialSwapRate,
      VaultW2RInstance.address,
      MaticW2RPairTokenInstance.address,
      { from: owner }
    );

    await MaticW2RPairTokenInstance.addMinterAndBurner(
      MaticW2RdexInstance.address,
      { from: owner }
    );
    await VaultW2RInstance.setApprovedContract(
      MaticW2RdexInstance.address,
      true,
      { from: owner }
    );
    const TwoWheels2RentLenderInstance = await TwoWheels2RentLender.new({
      from: owner,
    });
    const TwoWheels2RentRenterInstance = await TwoWheels2RentRenter.new({
      from: owner,
    });

    const LenderWhitelistInstance = await LenderWhitelist.new(
      TwoWheels2RentLenderInstance.address,
      W2RInstance.address,
      TwoWheels2RentRenterInstance.address,
      VaultW2RInstance.address,
      { from: owner }
    );
    const RenterWhitelistInstance = await RenterWhitelist.new(
      TwoWheels2RentRenterInstance.address,
      W2RInstance.address,
      TwoWheels2RentLenderInstance.address,
      VaultW2RInstance.address,
      { from: owner }
    );
    await LenderWhitelistInstance.setRenterWhitelistAddress(
      RenterWhitelistInstance.address,
      { from: owner }
    );
    await RenterWhitelistInstance.setLenderWhitelistAddress(
      LenderWhitelistInstance.address,
      { from: owner }
    );
    await TwoWheels2RentLenderInstance.setLenderWhitelistContract(
      LenderWhitelistInstance.address,
      { from: owner }
    );
    await TwoWheels2RentLenderInstance.setIpfsHash(lenderIPFS, { from: owner });
    await TwoWheels2RentRenterInstance.setRenterWhitelistContract(
      RenterWhitelistInstance.address,
      { from: owner }
    );
    await TwoWheels2RentRenterInstance.setIpfsHash(renterIPFS, { from: owner });
    await VaultW2RInstance.setWhitelistLenders(
      LenderWhitelistInstance.address,
      { from: owner }
    );
    await VaultW2RInstance.setWhitelistRenters(
      RenterWhitelistInstance.address,
      { from: owner }
    );

    await LenderWhitelistInstance.setBikeInfoAndMint(
      "Bike",
      "Brand",
      "Model",
      "Serial",
      "Registration",
      { from: owner }
    );

    const bikeShareRef = await LenderWhitelistInstance.whitelistedAddresses(
      owner,
      { from: owner }
    );

    const bikeShareAddress = bikeShareRef.bikeShareContract;
    bikeShare = await BikeShare.at(bikeShareAddress);
  });

  describe("Deployment", () => {
    it("should deploy with the correct owner", async () => {
      const contractOwner = await bikeShare.owner();
      expect(contractOwner).to.equal(owner);
    });

    it("should deploy BikeShare contract with correct initial values", async () => {
      const contractOwner = await bikeShare.owner();
      expect(contractOwner).to.equal(owner);

      it("should have the correct initial totalRentals value", async () => {
        const totalRentals = await bikeShare.totalRentals();
        expect(totalRentals.toString()).to.equal("0");
      });

      it("should have the correct initial rewardAmount value", async () => {
        const rewardAmount = await bikeShare.rewardAmount();
        expect(rewardAmount.toString()).to.equal("10");
      });

      it("should have the correct initial proposalDuration value", async () => {
        const proposalDuration = await bikeShare.proposalDuration();
        expect(proposalDuration.toString()).to.equal(
          (2 * 24 * 60 * 60).toString()
        );
      });

      it("should have the correct initial minimalRental value", async () => {
        const minimalRental = await bikeShare.minimalRental();
        expect(minimalRental.toString()).to.equal(
          (1 * 24 * 60 * 60).toString()
        );
      });
    });
  });
});

contract("BikeRent Deployment", (accounts) => {
  let bikeRent;
  let W2RInstance;
  const owner = accounts[0];

  beforeEach(async () => {
    W2RInstance = await W2R.new(initialSupply, { from: owner });

    const VaultW2RInstance = await VaultW2R.new(W2RInstance.address, {
      from: owner,
    });
    const MaticW2RPairTokenInstance = await MaticW2RPairToken.new({
      from: owner,
    });

    const MaticW2RdexInstance = await MaticW2Rdex.new(
      W2RInstance.address,
      initialSwapRate,
      VaultW2RInstance.address,
      MaticW2RPairTokenInstance.address,
      { from: owner }
    );

    await MaticW2RPairTokenInstance.addMinterAndBurner(
      MaticW2RdexInstance.address,
      { from: owner }
    );
    await VaultW2RInstance.setApprovedContract(
      MaticW2RdexInstance.address,
      true,
      { from: owner }
    );
    const TwoWheels2RentLenderInstance = await TwoWheels2RentLender.new({
      from: owner,
    });
    const TwoWheels2RentRenterInstance = await TwoWheels2RentRenter.new({
      from: owner,
    });

    const LenderWhitelistInstance = await LenderWhitelist.new(
      TwoWheels2RentLenderInstance.address,
      W2RInstance.address,
      TwoWheels2RentRenterInstance.address,
      VaultW2RInstance.address,
      { from: owner }
    );
    const RenterWhitelistInstance = await RenterWhitelist.new(
      TwoWheels2RentRenterInstance.address,
      W2RInstance.address,
      TwoWheels2RentLenderInstance.address,
      VaultW2RInstance.address,
      { from: owner }
    );
    await LenderWhitelistInstance.setRenterWhitelistAddress(
      RenterWhitelistInstance.address,
      { from: owner }
    );
    await RenterWhitelistInstance.setLenderWhitelistAddress(
      LenderWhitelistInstance.address,
      { from: owner }
    );
    await TwoWheels2RentLenderInstance.setLenderWhitelistContract(
      LenderWhitelistInstance.address,
      { from: owner }
    );
    await TwoWheels2RentLenderInstance.setIpfsHash(lenderIPFS, { from: owner });
    await TwoWheels2RentRenterInstance.setRenterWhitelistContract(
      RenterWhitelistInstance.address,
      { from: owner }
    );
    await TwoWheels2RentRenterInstance.setIpfsHash(renterIPFS, { from: owner });
    await VaultW2RInstance.setWhitelistLenders(
      LenderWhitelistInstance.address,
      { from: owner }
    );
    await VaultW2RInstance.setWhitelistRenters(
      RenterWhitelistInstance.address,
      { from: owner }
    );

    await RenterWhitelistInstance.setRenterInfoAndMint("name", "rather", {
      from: owner,
    });

    const bikeRentRef = await RenterWhitelistInstance.whitelistedAddresses(
      owner,
      { from: owner }
    );

    const bikeRentAddress = bikeRentRef.bikeRentContract;
    bikeRent = await BikeRent.at(bikeRentAddress);
  });
  describe("Deployment", () => {
    it("should deploy with the correct owner", async () => {
      const contractOwner = await bikeRent.owner();
      expect(contractOwner).to.equal(owner);
    });

    it("should deploy BikeRent contract with correct initial values", async () => {
      const contractOwner = await bikeRent.owner();
      expect(contractOwner).to.equal(owner);

      it("should have the correct initial totalRentals value", async () => {
        const totalRentals = await bikeRent.totalRentals();
        expect(totalRentals.toString()).to.equal("0");
      });

      it("should have the correct initial totalRewards value", async () => {
        const totalRewards = await bikeRent.totalRewards();
        expect(totalRewards.toString()).to.equal("0");
      });

      it("should have the correct initial isDestroyed value", async () => {
        const isDestroyed = await bikeRent.isDestroyed();
        expect(isDestroyed).to.equal(false);
      });

      it("should have the correct initial GPS data values", async () => {
        const gps = await bikeRent.gpsData(bikeRent.address);
        expect(gps.latitude).to.equal("");
        expect(gps.longitude).to.equal("");
      });
    });
  });
});
