const BikeRent = artifacts.require("./BikeRent.sol");
const BikeShare = artifacts.require("./BikeShare.sol");
const W2RToken = artifacts.require("./W2R.sol");
const { BN, expectRevert, expectEvent } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");

contract("Taking and Returning a Bike", (accounts) => {
  let bikeRent;
  let bikeShare;
  let w2rToken;
  const owner = accounts[0];
  const renter = accounts[1];

  beforeEach(async () => {
    w2rToken = await W2RToken.new();
    bikeRent = await BikeRent.new(renter, W2RToken);
    bikeShare = await BikeShare.new(owner, W2RToken);

    const dateMin = (await web3.eth.getBlock("latest")).timestamp + 10000;
    const dateMax = dateMin + 4 * 60 * 60;
    const rentalTime = 24 * 60 * 60;

    // Transfer W2R tokens to renter
    const tokensToTransfer = new BN(1000);
    await w2rToken.transfer(renter, tokensToTransfer, { from: owner });

    // Approve BikeRent contract to spend renter's W2R tokens
    await w2rToken.approve(bikeRent.address, tokensToTransfer, {
      from: renter,
    });

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

  describe("Taking and Returning a Bike", () => {
    it("should confirm bike taken", async () => {
      await bikeShare.confirmBikeTaken({ from: owner });

      const bikeShareEvents = await bikeShare.getPastEvents("BikeTaken");
      expect(bikeShareEvents.length).to.equal(1);
      expect(bikeShareEvents[0].returnValues._renter).to.equal(
        bikeRent.address
      );

      const bikeRentEvents = await bikeRent.getPastEvents("BikeTaken");
      expect(bikeRentEvents.length).to.equal(1);
      expect(bikeRentEvents[0].returnValues._lender).to.equal(
        bikeShare.address
      );
    });

    it("should handle bike return process", async () => {
      // Confirm bike taken
      await bikeShare.confirmBikeTaken({ from: owner });

      // Renter declares bike returned
      await bikeRent.returnBike({ from: renter });

      const bikeRentEvents = await bikeRent.getPastEvents(
        "RentalDeclaredAsReturned"
      );
      expect(bikeRentEvents.length).to.equal(1);
      expect(bikeRentEvents[0].returnValues._lender).to.equal(
        bikeShare.address
      );

      const bikeShareEvents = await bikeShare.getPastEvents(
        "RentalSeemsReturned"
      );
      expect(bikeShareEvents.length).to.equal(1);
      expect(bikeShareEvents[0].returnValues._renter).to.equal(
        bikeRent.address
      );

      // Lender confirms bike returned
      await bikeShare.confirmBikeReturned({ from: owner });

      const bikeShareReturnedEvents = await bikeShare.getPastEvents(
        "BikeReturned"
      );
      expect(bikeShareReturnedEvents.length).to.equal(1);
      expect(bikeShareReturnedEvents[0].returnValues._renter).to.equal(
        bikeRent.address
      );

      const bikeRentReturnedEvents = await bikeRent.getPastEvents(
        "RentalReturned"
      );
      expect(bikeRentReturnedEvents.length).to.equal(1);
      expect(bikeRentReturnedEvents[0].returnValues._lender).to.equal(
        bikeShare.address
      );
    });

    it("should not allow taking the bike before the start date", async () => {
      // Set the current block timestamp to be before the start date
      const currentDate = (await web3.eth.getBlock("latest")).timestamp;
      const startDate = currentDate + 2 * 60 * 60;

      // Advance the block timestamp to the start date
      await web3.currentProvider.send(
        {
          jsonrpc: "2.0",
          method: "evm_increaseTime",
          params: [startDate - currentDate],
          id: new Date().getTime(),
        },
        () => {}
      );

      await expectRevert(
        bikeShare.confirmBikeTaken({ from: owner }),
        "Must be in the past"
      );
    });

    it("should not allow returning the bike if not taken", async () => {
      await expectRevert(bikeRent.returnBike({ from: renter }), "Not taken");
    });

    it("should not allow confirming bike returned if not declared as returned", async () => {
      // Confirm bike taken
      await bikeShare.confirmBikeTaken({ from: owner });

      await expectRevert(
        bikeShare.confirmBikeReturned({ from: owner }),
        "Seems not returned"
      );
    });

    it("should not allow confirming bike returned if already returned", async () => {
      // Confirm bike taken
      await bikeShare.confirmBikeTaken({ from: owner });

      // Renter declares bike returned
      await bikeRent.returnBike({ from: renter });

      // Lender confirms bike returned
      await bikeShare.confirmBikeReturned({ from: owner });

      await expectRevert(
        bikeShare.confirmBikeReturned({ from: owner }),
        "Already returned"
      );
    });
  });
});
