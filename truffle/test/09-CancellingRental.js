const { BN } = require("@openzeppelin/test-helpers");
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

contract("Cancel Renting", (accounts) => {
  let bikeRent;
  let bikeShare;
  let W2RInstance;
  const owner = accounts[0];
  const renter = accounts[1];
  let initialRenterBalance;
  let bikeShareAddress;
  let bikeRentAddress;
  let amount;
  beforeEach(async () => {
    W2RInstance = await W2R.new(initialSupply, { from: owner });
    amount = new BN("10000000000000000000000");
    await W2RInstance.transfer(renter, amount, { from: owner });

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

    await RenterWhitelistInstance.setRenterInfoAndMint("name", "rather", {
      from: renter,
    });

    const bikeShareRef = await LenderWhitelistInstance.whitelistedAddresses(
      owner,
      { from: owner }
    );

    bikeShareAddress = bikeShareRef.bikeShareContract;
    bikeShare = await BikeShare.at(bikeShareAddress);

    const bikeRentRef = await RenterWhitelistInstance.whitelistedAddresses(
      renter,
      { from: renter }
    );

    bikeRentAddress = bikeRentRef.bikeRentContract;
    bikeRent = await BikeRent.at(bikeRentAddress);

    let latitude = "42.3601";
    let longitude = "-71.0589";
    await bikeShare.activate(latitude, longitude, { from: owner });
    await bikeRent.activate(latitude, longitude, { from: renter });

    initialRenterBalance = await W2RInstance.balanceOf(renter);

    let date = (await web3.eth.getBlock("latest")).timestamp;
    date = new BN(date.toString());
    let dateMin = (await web3.eth.getBlock("latest")).timestamp + 10100;
    dateMin = new BN(dateMin.toString());
    let dateMax = (await web3.eth.getBlock("latest")).timestamp + 7 * 60 * 60;
    dateMax = new BN(dateMax.toString());
    let rentalTime = 24 * 60 * 60;
    rentalTime = new BN(rentalTime.toString());

    await W2RInstance.approve(
      bikeRentAddress,
      new BN("10000000000000000000000"),
      {
        from: renter,
      }
    );
    await bikeRent.depositW2R(new BN("10000000000000000000000"), {
      from: renter,
    });

    await bikeRent.makeProposal(
      bikeShareAddress,
      dateMin,
      dateMax,
      rentalTime,
      { from: renter }
    );

    const meetingHour =
      (await web3.eth.getBlock("latest")).timestamp + 3 * 60 * 60;

    await bikeShare.acceptProposal(
      bikeRent.address,
      meetingHour,
      latitude,
      longitude,
      {
        from: owner,
      }
    );
  });

  it("should be able to cancel renting as renter", async () => {
    await bikeRent.cancelRenting({ from: renter });

    const renterBalance = await W2RInstance.balanceOf(bikeRentAddress);
    assert.equal(
      renterBalance.toString(),
      initialRenterBalance.toString(),
      "renter balance should be the same as initial balance"
    );
  });

  it("should be able to cancel renting as lender", async () => {
    await bikeShare.cancelLending({ from: owner });
    const renterBalance = await W2RInstance.balanceOf(bikeRentAddress);
    assert.equal(
      renterBalance.toString(),
      initialRenterBalance.toString(),
      "renter balance should be the same as initial balance"
    );
  });
});
