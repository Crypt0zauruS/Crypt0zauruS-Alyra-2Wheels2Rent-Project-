const BikeRent = artifacts.require("./BikeRent.sol");
const BikeShare = artifacts.require("./BikeShare.sol");
const W2R = artifacts.require("./W2R.sol");
const { BN, expectRevert, expectEvent } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");

contract("Renter Proposes Rental", (accounts) => {
  let bikeRent;
  let bikeShare;
  let W2RToken;
  const owner = accounts[0];
  const renter = accounts[1];
  let initialRenterBalance;

  beforeEach(async () => {
    W2RToken = await W2R.new("1000000", { from: owner });
    bikeRent = await BikeRent.new(renter, W2RToken.address);
    bikeShare = await BikeShare.new(owner, W2RToken.address);
    initialRenterBalance = await W2RToken.balanceOf(renter);
  });

  describe("Renter makes a proposal", () => {
    it("should make a valid proposal", async () => {
      const dateMin = (await web3.eth.getBlock("latest")).timestamp + 10000;
      const dateMax = dateMin + 4 * 60 * 60;
      const rentalTime = 24 * 60 * 60;

      // Assuming renter has enough W2R tokens and has approved the BikeRent contract to spend them
      const proposalTx = await bikeRent.makeProposal(
        bikeShare.address,
        dateMin,
        dateMax,
        rentalTime,
        { from: renter }
      );

      const proposalMadeEvent = expectEvent(proposalTx, "ProposalMade", {
        _renter: renter,
        _bikeShare: bikeShare.address,
        _dateMin: new BN(dateMin),
        _dateMax: new BN(dateMax),
        _rentalTime: new BN(rentalTime),
      });

      const proposalReceivedEvent = expectEvent(
        await bikeShare.getPastEvents("ProposalReceived"),
        "ProposalReceived",
        {
          _bikeRent: bikeRent.address,
          _bikeShare: bikeShare.address,
          _dateMin: new BN(dateMin),
          _dateMax: new BN(dateMax),
          _rentalTime: new BN(rentalTime),
        }
      );

      expect(proposalMadeEvent.args._renter).to.equal(renter);
      expect(proposalMadeEvent.args._bikeShare).to.equal(bikeShare.address);
      expect(proposalMadeEvent.args._dateMin.toString()).to.equal(
        dateMin.toString()
      );
      expect(proposalMadeEvent.args._dateMax.toString()).to.equal(
        dateMax.toString()
      );
      expect(proposalMadeEvent.args._rentalTime.toString()).to.equal(
        rentalTime.toString()
      );

      // Check if the proposalReceivedEvent data is as expected
      expect(proposalReceivedEvent.args._bikeRent).to.equal(bikeRent.address);
      expect(proposalReceivedEvent.args._bikeShare).to.equal(bikeShare.address);
      expect(proposalReceivedEvent.args._dateMin.toString()).to.equal(
        dateMin.toString()
      );
      expect(proposalReceivedEvent.args._dateMax.toString()).to.equal(
        dateMax.toString()
      );
      expect(proposalReceivedEvent.args._rentalTime.toString()).to.equal(
        rentalTime.toString()
      );
    });

    it("should not allow a proposal with invalid parameters", async () => {
      const dateMin = (await web3.eth.getBlock("latest")).timestamp + 10000;
      const dateMax = dateMin + 1 * 60 * 60;
      const rentalTime = 12 * 60 * 60;

      await expectRevert(
        bikeRent.makeProposal(bikeShare.address, dateMin, dateMax, rentalTime, {
          from: renter,
        }),
        "Too short"
      );
    });
  });

  describe("Cancel and delete proposals", () => {
    beforeEach(async () => {
      const dateMin = (await web3.eth.getBlock("latest")).timestamp + 10000;
      const dateMax = dateMin + 4 * 60 * 60;
      const rentalTime = 24 * 60 * 60;

      // Assuming renter has enough W2R tokens and has approved the BikeRent contract to spend them
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

    it("should cancel a proposal", async () => {
      await bikeShare.cancelProposal(bikeRent.address, { from: owner });
      await bikeRent.cancelProposal(bikeShare.address, { from: renter });

      const bikeShareEvents = await bikeShare.getPastEvents(
        "ProposalCancelled"
      );
      expect(bikeShareEvents.length).to.equal(1);
      expect(bikeShareEvents[0].returnValues._renter).to.equal(
        bikeRent.address
      );

      const bikeRentEvents = await bikeRent.getPastEvents("ProposalCancelled");
      expect(bikeRentEvents.length).to.equal(1);
      expect(bikeRentEvents[0].returnValues._lender).to.equal(
        bikeShare.address
      );
    });

    it("should delete expired proposals", async () => {
      // Increase time to make the proposal expired
      await web3.currentProvider.send(
        {
          jsonrpc: "2.0",
          method: "evm_increaseTime",
          params: [proposalDuration],
          id: new Date().getTime(),
        },
        () => {}
      );

      await bikeShare.deleteOldProposals();
      await bikeRent.deleteOldProposals();

      const bikeShareEvents = await bikeShare.getPastEvents(
        "ProposalCancelled"
      );
      expect(bikeShareEvents.length).to.equal(1);
      expect(bikeShareEvents[0].returnValues._renter).to.equal(
        bikeRent.address
      );

      const bikeRentEvents = await bikeRent.getPastEvents("ProposalCancelled");
      expect(bikeRentEvents.length).to.equal(1);
      expect(bikeRentEvents[0].returnValues._lender).to.equal(
        bikeShare.address
      );
    });
  });

  describe("Accepting a rental", () => {
    beforeEach(async () => {
      const dateMin = (await web3.eth.getBlock("latest")).timestamp + 10000;
      const dateMax = dateMin + 4 * 60 * 60;
      const rentalTime = 24 * 60 * 60;

      // Assuming renter has enough W2R tokens and has approved the BikeRent contract to spend them
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
        (await web3.eth.getBlock("latest")).timestamp + 2 * 60 * 60;
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
      expect(bikeShareEvents[0].returnValues._renter).to.equal(
        bikeRent.address
      );

      const bikeRentEvents = await bikeRent.getPastEvents("RentalStarted");
      expect(bikeRentEvents.length).to.equal(1);
      expect(bikeRentEvents[0].returnValues._lender).to.equal(
        bikeShare.address
      );

      expect(bikeRentEvents[0].returnValues._meetingHour.toString()).to.equal(
        meetingHour.toString()
      );
      expect(bikeRentEvents[0].returnValues._latitude).to.equal(latitude);
      expect(bikeRentEvents[0].returnValues._longitude).to.equal(longitude);
    });

    it("should not accept a rental with invalid parameters", async () => {
      const meetingHour =
        (await web3.eth.getBlock("latest")).timestamp + 2 * 60 * 60;
      const latitude = "91.0000";
      const longitude = "2.3522";

      await expectRevert(
        bikeShare.acceptProposal(
          bikeRent.address,
          meetingHour,
          latitude,
          longitude,
          { from: owner }
        ),
        "Invalid latitude"
      );
    });
  });

  describe("Cancelling a rental", () => {
    beforeEach(async () => {
      const dateMin = (await web3.eth.getBlock("latest")).timestamp + 10000;
      const dateMax = dateMin + 4 * 60 * 60;
      const rentalTime = 24 * 60 * 60;

      // Assuming renter has enough W2R tokens and has approved the BikeRent contract to spend them
      await bikeRent.makeProposal(
        bikeShare.address,
        dateMin,
        dateMax,
        rentalTime,
        {
          from: renter,
        }
      );

      const meetingHour =
        (await web3.eth.getBlock("latest")).timestamp + 2 * 60 * 60;
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
    });

    it("should cancel a rental by lender", async () => {
      await bikeShare.cancelLending({ from: owner });

      const bikeShareEvents = await bikeShare.getPastEvents("RentingCancelled");
      expect(bikeShareEvents.length).to.equal(1);
      expect(bikeShareEvents[0].returnValues._renter).to.equal(
        bikeRent.address
      );

      const bikeRentEvents = await bikeRent.getPastEvents("RentalCancelled");
      expect(bikeRentEvents.length).to.equal(1);
      expect(bikeRentEvents[0].returnValues._lender).to.equal(
        bikeShare.address
      );
    });

    it("should cancel a rental by renter", async () => {
      await bikeRent.cancelRenting({ from: renter });

      const bikeRentEvents = await bikeRent.getPastEvents("RentalCancelled");
      expect(bikeRentEvents.length).to.equal(1);
      expect(bikeRentEvents[0].returnValues._lender).to.equal(
        bikeShare.address
      );

      const bikeShareEvents = await bikeShare.getPastEvents("RentingCancelled");
      expect(bikeShareEvents.length).to.equal(1);
      expect(bikeShareEvents[0].returnValues._renter).to.equal(
        bikeRent.address
      );
    });
  });
});
