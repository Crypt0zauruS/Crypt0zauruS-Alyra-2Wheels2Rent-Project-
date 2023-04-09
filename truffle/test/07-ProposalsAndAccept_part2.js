const { BN, expectRevert, expectEvent } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");
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

contract("Propose and accept", (accounts) => {
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

    const latitude = "42.3601";
    const longitude = "-71.0589";
    await bikeShare.activate(latitude, longitude, { from: owner });
    await bikeRent.activate(latitude, longitude, { from: renter });
    initialRenterBalance = await W2RInstance.balanceOf(renter);
  });

  describe("Renter makes a proposal", () => {
    it("should make a valid proposal", async () => {
      let date = (await web3.eth.getBlock("latest")).timestamp;
      date = new BN(date.toString());
      let dateMin = (await web3.eth.getBlock("latest")).timestamp + 10100;
      dateMin = new BN(dateMin.toString());
      let dateMax = (await web3.eth.getBlock("latest")).timestamp + 7 * 60 * 60;
      dateMax = new BN(dateMax.toString());
      let rentalTime = 24 * 60 * 60;
      rentalTime = new BN(rentalTime.toString());
      let rate = await bikeShare.rate();
      rate = new BN(rate.toString());
      let depositAmount = await bikeShare.depositAmount();
      depositAmount = new BN(depositAmount.toString());
      const latitude = "42.3601";
      const longitude = "-71.0589";

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

      const proposalTx = await bikeRent.makeProposal(
        bikeShareAddress,
        dateMin,
        dateMax,
        rentalTime,
        { from: renter }
      );

      const proposalMadeEvent = expectEvent(proposalTx, "ProposalMade", {
        renter: bikeRentAddress,
        date,
        lender: bikeShareAddress,
        rentalDateMin: dateMin,
        rentalDateMax: dateMax,
        rentalTime,
        rate,
        depositAmount,
        latitude,
        longitude,
      });

      const proposalReceivedLogs = await bikeShare.getPastEvents(
        "ProposalReceived",
        {
          fromBlock: proposalTx.receipt.blockNumber,
          toBlock: proposalTx.receipt.blockNumber,
        }
      );

      const proposalReceivedEvent = expectEvent.inLogs(
        proposalReceivedLogs,
        "ProposalReceived",
        {
          renter: bikeRentAddress,
          date,
          lender: bikeShareAddress,
          rentalDateMin: dateMin,
          rentalDateMax: dateMax,
          rentalTime,
          rate,
          depositAmount,
          latitude,
          longitude,
        }
      );

      expect(proposalMadeEvent.args.renter).to.equal(bikeRentAddress);
      expect(proposalMadeEvent.args.date.toString()).to.equal(date.toString());
      expect(proposalMadeEvent.args.lender).to.equal(bikeShareAddress);
      expect(proposalMadeEvent.args.rentalDateMin.toString()).to.equal(
        dateMin.toString()
      );
      expect(proposalMadeEvent.args.rentalDateMax.toString()).to.equal(
        dateMax.toString()
      );
      expect(proposalMadeEvent.args.rentalTime.toString()).to.equal(
        rentalTime.toString()
      );
      expect(proposalMadeEvent.args.rate.toString()).to.equal(rate.toString());
      expect(proposalMadeEvent.args.depositAmount.toString()).to.equal(
        depositAmount.toString()
      );
      expect(proposalMadeEvent.args.latitude).to.equal(latitude);
      expect(proposalMadeEvent.args.longitude).to.equal(longitude);

      // Check if the proposalReceivedEvent data is as expected
      expect(proposalReceivedEvent.args.renter).to.equal(bikeRentAddress);
      expect(proposalReceivedEvent.args.date.toString()).to.equal(
        date.toString()
      );
      expect(proposalReceivedEvent.args.lender).to.equal(bikeShareAddress);
      expect(proposalReceivedEvent.args.rentalDateMin.toString()).to.equal(
        dateMin.toString()
      );
      expect(proposalReceivedEvent.args.rentalDateMax.toString()).to.equal(
        dateMax.toString()
      );
      expect(proposalReceivedEvent.args.rentalTime.toString()).to.equal(
        rentalTime.toString()
      );
      expect(proposalReceivedEvent.args.rate.toString()).to.equal(
        rate.toString()
      );
      expect(proposalReceivedEvent.args.depositAmount.toString()).to.equal(
        depositAmount.toString()
      );
      expect(proposalReceivedEvent.args.latitude).to.equal(latitude);
      expect(proposalReceivedEvent.args.longitude).to.equal(longitude);
    });

    it("should not allow a proposal with invalid parameters", async () => {
      const dateMin = (await web3.eth.getBlock("latest")).timestamp + 10000;
      const dateMax = dateMin + 1 * 60 * 60;
      const rentalTime = 12 * 60 * 60;

      await expectRevert(
        bikeRent.makeProposal(bikeShare.address, dateMin, dateMax, rentalTime, {
          from: renter,
        }),
        "Date too soon"
      );
    });
  });

  describe("Cancel a proposal", async () => {
    let date;
    beforeEach(async () => {
      date = (await web3.eth.getBlock("latest")).timestamp;
      date = new BN(date.toString());
      let dateMin = (await web3.eth.getBlock("latest")).timestamp + 10100;
      dateMin = new BN(dateMin.toString());
      let dateMax = (await web3.eth.getBlock("latest")).timestamp + 7 * 60 * 60;
      dateMax = new BN(dateMax.toString());
      let rentalTime = 24 * 60 * 60;
      rentalTime = new BN(rentalTime.toString());
      let rate = await bikeShare.rate();
      rate = new BN(rate.toString());
      let depositAmount = await bikeShare.depositAmount();
      depositAmount = new BN(depositAmount.toString());
      const latitude = "42.3601";
      const longitude = "-71.0589";

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
    });

    it("should be able to cancel a proposal as a renter", async () => {
      const proposalTx = await bikeRent.cancelProposal(bikeShare.address, {
        from: renter,
      });
      const proposalCancelledByRenterEvent = expectEvent(
        proposalTx,
        "ProposalCancelled",
        {
          renter: bikeRentAddress,
          date,
          lender: bikeShareAddress,
        }
      );

      expect(proposalCancelledByRenterEvent.args.renter).to.equal(
        bikeRentAddress
      );
      expect(proposalCancelledByRenterEvent.args.date.toString()).to.equal(
        date.toString()
      );
      expect(proposalCancelledByRenterEvent.args.lender).to.equal(
        bikeShareAddress
      );
    });

    it("should be able to cancel a proposal as a lender", async () => {
      const proposalTx = await bikeShare.cancelProposal(bikeRent.address, {
        from: owner,
      });
      const proposalCancelledByLenderEvent = expectEvent(
        proposalTx,
        "ProposalCancelled",
        {
          renter: bikeRentAddress,
          date,
          lender: bikeShareAddress,
        }
      );

      expect(proposalCancelledByLenderEvent.args.renter).to.equal(
        bikeRentAddress
      );
      expect(proposalCancelledByLenderEvent.args.date.toString()).to.equal(
        date.toString()
      );
      expect(proposalCancelledByLenderEvent.args.lender).to.equal(
        bikeShareAddress
      );
    });
  });

  describe("Accepting a rental", () => {
    let date;
    beforeEach(async () => {
      date = (await web3.eth.getBlock("latest")).timestamp;
      date = new BN(date.toString());
      let dateMin = (await web3.eth.getBlock("latest")).timestamp + 10100;
      dateMin = new BN(dateMin.toString());
      let dateMax = (await web3.eth.getBlock("latest")).timestamp + 7 * 60 * 60;
      dateMax = new BN(dateMax.toString());
      let rentalTime = 24 * 60 * 60;
      rentalTime = new BN(rentalTime.toString());
      let rate = await bikeShare.rate();
      rate = new BN(rate.toString());
      let depositAmount = await bikeShare.depositAmount();
      depositAmount = new BN(depositAmount.toString());

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
        bikeShare.address,
        dateMin,
        dateMax,
        rentalTime,
        {
          from: renter,
        }
      );
    });

    it("should accept a rental", async () => {
      const meetingHour =
        (await web3.eth.getBlock("latest")).timestamp + 3 * 60 * 60;
      const latitude = "48.8566";
      const longitude = "2.3522";

      await bikeShare.acceptProposal(
        bikeRent.address,
        meetingHour,
        latitude,
        longitude,
        {
          from: owner,
        }
      );

      const bikeShareEvents = await bikeShare.getPastEvents("BikeRented");
      expect(bikeShareEvents.length).to.equal(1);
      expect(bikeShareEvents[0].returnValues.renter).to.equal(bikeRent.address);

      const bikeRentEvents = await bikeRent.getPastEvents("RentalStarted");
      expect(bikeRentEvents.length).to.equal(1);
      expect(bikeRentEvents[0].returnValues.lender).to.equal(bikeShare.address);

      expect(bikeRentEvents[0].returnValues.date.toString()).to.equal(
        meetingHour.toString()
      );
    });

    it("should not accept a rental with invalid parameters", async () => {
      const meetingHour =
        (await web3.eth.getBlock("latest")).timestamp + 3 * 60 * 60;
      const latitude = "";
      const longitude = "";

      await expectRevert(
        bikeShare.acceptProposal(
          bikeRent.address,
          meetingHour,
          latitude,
          longitude,
          { from: owner }
        ),
        "GPS not set"
      );
    });
  });
});
