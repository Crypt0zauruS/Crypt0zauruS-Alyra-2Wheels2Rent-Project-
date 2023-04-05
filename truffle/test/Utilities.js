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
const { BN, expectRevert } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");

contract("Utilities", (accounts) => {
  let utilities;
  let W2RInstance;
  const owner = accounts[0];

  beforeEach(async () => {
    // Deploy W2R
    W2RInstance = await W2R.new(initialSupply, { from: owner });
    // Deploy VaultW2R
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

    // Deploy LenderWhitelist contract
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
    utilities = await BikeShare.at(bikeShareAddress);
    await W2RInstance.approve(utilities.address, 1000000, { from: owner });
  });

  describe("Utilities Functions", () => {
    it("should be deactivated after initialization", async () => {
      const isDeactivated = await utilities.isDeactivated();
      expect(isDeactivated).to.equal(true);
    });

    it("should activate the contract successfully", async () => {
      const latitude = "42.3601";
      const longitude = "-71.0589";
      await utilities.activate(latitude, longitude, { from: owner });

      const isDeactivated = await utilities.isDeactivated();
      expect(isDeactivated).to.equal(false);
    });

    it("should set GPS data successfully", async () => {
      const latitude = "42.3601";
      const longitude = "-71.0589";
      await utilities.setGPS(latitude, longitude, { from: owner });

      const gps = await utilities.gpsData(utilities.address);
      expect(gps.latitude).to.equal(latitude);
      expect(gps.longitude).to.equal(longitude);
    });

    it("should revert if non-owner tries to set GPS data", async () => {
      const nonOwner = accounts[1];
      const latitude = "42.3601";
      const longitude = "-71.0589";
      await expectRevert(
        utilities.setGPS(latitude, longitude, { from: nonOwner }),
        "only owner"
      );
    });

    it("should revert if GPS data is empty", async () => {
      await expectRevert(
        utilities.setGPS("", "", { from: owner }),
        "GPS empty"
      );
    });

    it("should revert if non-owner tries to activate the contract", async () => {
      const nonOwner = accounts[1];
      const latitude = "42.3601";
      const longitude = "-71.0589";
      await expectRevert(
        utilities.activate(latitude, longitude, { from: nonOwner }),
        "only owner"
      );
    });

    it("should deposit W2R successfully", async () => {
      const latitude = "42.3601";
      const longitude = "-71.0589";
      await utilities.activate(latitude, longitude, { from: owner });
      const amount = new BN("100");
      await utilities.depositW2R(amount, { from: owner });
      const depositedW2R = await W2RInstance.balanceOf(utilities.address);
      expect(depositedW2R.toString()).to.equal(amount.toString());
    });

    it("should revert if W2R deposit amount is zero", async () => {
      const latitude = "42.3601";
      const longitude = "-71.0589";
      await utilities.activate(latitude, longitude, { from: owner });
      await expectRevert(
        utilities.depositW2R(0, { from: owner }),
        "Bad amount"
      );
    });

    it("should revert if W2R deposit is attempted without approval", async () => {
      const latitude = "42.3601";
      const longitude = "-71.0589";
      await utilities.activate(latitude, longitude, { from: owner });
      const amount = new BN("100");
      await W2RInstance.approve(utilities.address, 0, { from: owner });
      await expectRevert(
        utilities.depositW2R(amount, { from: owner }),
        "Need approval"
      );
    });

    it("should get total rewards successfully", async () => {
      const latitude = "42.3601";
      const longitude = "-71.0589";
      await utilities.activate(latitude, longitude, { from: owner });
      const totalRewards = await utilities.getTotalRewards({ from: owner });
      expect(totalRewards.toString()).to.equal("0");
    });
  });
});
