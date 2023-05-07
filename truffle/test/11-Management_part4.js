const BikeRent = artifacts.require("./BikeRent.sol");
const BikeShare = artifacts.require("./BikeShare.sol");
const W2R = artifacts.require("W2R.sol");
const initialSupply = web3.utils.toBN("160000000");
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
const { expectRevert } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");

contract("BikeShare", (accounts) => {
  let bikeShare;
  let W2RInstance;
  const owner = accounts[0];
  let LenderWhitelistInstance;

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

    LenderWhitelistInstance = await LenderWhitelist.new(
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

    const latitude = "42.3601";
    const longitude = "-71.0589";
    await bikeShare.activate(latitude, longitude, { from: owner });
  });

  describe("Withdrawing funds", () => {
    beforeEach(async () => {
      await W2RInstance.transfer(bikeShare.address, web3.utils.toWei("10"), {
        from: owner,
      });
    });

    it("should allow the owner to withdraw funds", async () => {
      const initialBalance = await W2RInstance.balanceOf(owner);
      await bikeShare.withdrawFunds(web3.utils.toWei("5"), { from: owner });
      const finalBalance = await W2RInstance.balanceOf(owner);

      expect(finalBalance.sub(initialBalance)).to.be.bignumber.equal(
        web3.utils.toBN(web3.utils.toWei("5"))
      );
    });

    it("should not allow non-owners to withdraw funds", async () => {
      await expectRevert(
        bikeShare.withdrawFunds(web3.utils.toWei("5"), { from: accounts[2] }),
        "only owner"
      );
    });
  });

  describe("Destroying the contract", () => {
    it("should destroy the contract", async () => {
      await LenderWhitelistInstance.removeAddressFromWhitelist({
        from: owner,
      });
      const isDestroyed = await bikeShare.isDeactivated();
      expect(isDestroyed).to.be.true;
    });

    it("should not allow non-whitelistLender to destroy the contract", async () => {
      await expectRevert(bikeShare.destroy({ from: accounts[2] }), "wl");
    });

    it("should transfer funds to the owner", async () => {
      const initialBalance = await W2RInstance.balanceOf(owner);
      await W2RInstance.transfer(bikeShare.address, web3.utils.toWei("10"), {
        from: owner,
      });

      await LenderWhitelistInstance.removeAddressFromWhitelist({
        from: owner,
      });
      const finalBalance = await W2RInstance.balanceOf(owner);
      expect(finalBalance.sub(initialBalance)).to.be.bignumber.equal("0");
    });
  });
});

contract("BikeRent", (accounts) => {
  let bikeRent;
  let W2RInstance;
  const owner = accounts[0];
  let RenterWhitelistInstance;

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
    RenterWhitelistInstance = await RenterWhitelist.new(
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

    const latitude = "42.3601";
    const longitude = "-71.0589";
    await bikeRent.activate(latitude, longitude, { from: owner });
  });

  describe("Withdrawing funds", () => {
    beforeEach(async () => {
      await W2RInstance.transfer(bikeRent.address, web3.utils.toWei("10"), {
        from: owner,
      });
    });

    it("should allow the owner to withdraw funds", async () => {
      const initialBalance = await W2RInstance.balanceOf(owner);
      await bikeRent.withdrawFunds(web3.utils.toWei("5"), { from: owner });
      const finalBalance = await W2RInstance.balanceOf(owner);

      expect(finalBalance.sub(initialBalance)).to.be.bignumber.equal(
        web3.utils.toBN(web3.utils.toWei("5"))
      );
    });

    it("should not allow non-owners to withdraw funds", async () => {
      await expectRevert(
        bikeRent.withdrawFunds(web3.utils.toWei("5"), { from: accounts[2] }),
        "only owner"
      );
    });
  });

  describe("Destroying the contract", () => {
    it("should destroy the contract", async () => {
      await RenterWhitelistInstance.removeAddressFromWhitelist({
        from: owner,
      });
      const isDestroyed = await bikeRent.isDeactivated();
      expect(isDestroyed).to.be.true;
    });

    it("should not allow non-whitelistRenter to destroy the contract", async () => {
      await expectRevert(bikeRent.destroy({ from: accounts[2] }), "wl");
    });

    it("should transfer funds to the owner", async () => {
      const initialBalance = await W2RInstance.balanceOf(owner);
      await W2RInstance.transfer(bikeRent.address, web3.utils.toWei("10"), {
        from: owner,
      });

      await RenterWhitelistInstance.removeAddressFromWhitelist({
        from: owner,
      });
      const finalBalance = await W2RInstance.balanceOf(owner);
      expect(finalBalance.sub(initialBalance)).to.be.bignumber.equal("0");
    });
  });
});
