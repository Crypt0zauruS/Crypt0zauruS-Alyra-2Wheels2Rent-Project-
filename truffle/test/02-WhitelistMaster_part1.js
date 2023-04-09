const W2R = artifacts.require("W2R.sol");
const initialSupply = 160000000;
const VaultW2R = artifacts.require("VaultW2R.sol");
const TwoWheels2RentLender = artifacts.require("TwoWheels2RentLender.sol");
const TwoWheels2RentRenter = artifacts.require("TwoWheels2RentRenter.sol");
const LenderWhitelist = artifacts.require("LenderWhitelist.sol");
const RenterWhitelist = artifacts.require("RenterWhitelist.sol");
const lenderIPFS = "lenderIPFS";
const renterIPFS = "renterIPFS";
const { expect } = require("chai");

contract("Whitelist Masters", (accounts) => {
  let TwoWheels2RentLenderInstance;
  let TwoWheels2RentRenterInstance;
  let LenderWhitelistInstance;
  let RenterWhitelistInstance;
  let W2RInstance;
  const owner = accounts[0];

  beforeEach(async () => {
    // Deploy W2R
    W2RInstance = await W2R.new(initialSupply, { from: owner });
    // Deploy VaultW2R
    const VaultW2RInstance = await VaultW2R.new(W2RInstance.address, {
      from: owner,
    });
    TwoWheels2RentLenderInstance = await TwoWheels2RentLender.new({
      from: owner,
    });
    TwoWheels2RentRenterInstance = await TwoWheels2RentRenter.new({
      from: owner,
    });

    // Deploy LenderWhitelist contract
    LenderWhitelistInstance = await LenderWhitelist.new(
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

    await LenderWhitelistInstance.setBikeInfoAndMint(
      "Bike",
      "Brand",
      "Model",
      "Serial",
      "Registration",
      { from: owner }
    );

    await RenterWhitelistInstance.setRenterInfoAndMint("name", "rather", {
      from: owner,
    });
  });
  describe("Lender NFT Creation and Management", () => {
    const owner = accounts[0];
    const otherAccount = accounts[1];
    it("should only allow the whitelist contract to burn Lender NFTs", async () => {
      const NFTLenderRef = await LenderWhitelistInstance.whitelistedAddresses(
        owner,
        { from: owner }
      );
      const NFTID = NFTLenderRef.NFTId;

      try {
        await TwoWheels2RentLenderInstance.burnNFT(NFTID, {
          from: otherAccount,
        });
        assert.fail("Only the whitelist contract");
      } catch (error) {
        expect(error.message).to.contain("Only the whitelist contract");
      }
    });

    it("should have non-transferable Lender NFTs (soulbound)", async () => {
      const NFTLenderRef = await LenderWhitelistInstance.whitelistedAddresses(
        owner,
        { from: owner }
      );
      const NFTID = NFTLenderRef.NFTId;

      try {
        await TwoWheels2RentLenderInstance.safeTransferFrom(
          owner,
          otherAccount,
          NFTID,
          { from: owner }
        );
        assert.fail("Transfer should have failed");
      } catch (error) {
        expect(error.message).to.contain("Soulbound Token");
      }
    });

    it("should only allow the whitelist contract to burn Renter NFTs", async () => {
      const NFTRenterRef = await RenterWhitelistInstance.whitelistedAddresses(
        owner,
        { from: owner }
      );
      const NFTID = NFTRenterRef.NFTId;

      try {
        await TwoWheels2RentRenterInstance.burnNFT(NFTID, {
          from: otherAccount,
        });
        assert.fail("Only the whitelist contract");
      } catch (error) {
        expect(error.message).to.contain(
          "Only the whitelist contract can burn NFTs"
        );
      }
    });

    it("should remove an address from the whitelist", async () => {
      await LenderWhitelistInstance.removeAddressFromWhitelist({
        from: owner,
      });

      const isWhitelisted = await LenderWhitelistInstance.whitelistedAddresses(
        owner,
        { from: owner }
      );

      expect(isWhitelisted.isWhitelisted).to.equal(false);
    });

    it("should add an address to the blacklist and verify its addition", async () => {
      await LenderWhitelistInstance.addToBlacklist(owner, {
        from: owner,
      });

      const isBlacklisted = await LenderWhitelistInstance.blacklistedAddresses(
        owner,
        { from: owner }
      );

      expect(isBlacklisted).to.equal(true);
    });

    it("should remove an address from the blacklist and verify its removal", async () => {
      await LenderWhitelistInstance.addToBlacklist(owner, {
        from: owner,
      });

      await LenderWhitelistInstance.removeFromBlacklist(owner, {
        from: owner,
      });

      const isBlacklisted = await LenderWhitelistInstance.blacklistedAddresses(
        owner,
        { from: owner }
      );

      expect(isBlacklisted).to.equal(false);
    });

    it("should remove an address from the whitelist", async () => {
      await RenterWhitelistInstance.removeAddressFromWhitelist({
        from: owner,
      });

      const isWhitelisted = await RenterWhitelistInstance.whitelistedAddresses(
        owner,
        { from: owner }
      );

      expect(isWhitelisted.isWhitelisted).to.equal(false);
    });

    it("should add an address to the blacklist and verify its addition", async () => {
      await RenterWhitelistInstance.addToBlacklist(owner, {
        from: owner,
      });

      const isBlacklisted = await RenterWhitelistInstance.blacklistedAddresses(
        owner,
        { from: owner }
      );

      expect(isBlacklisted).to.equal(true);
    });

    it("should remove an address from the blacklist and verify its removal", async () => {
      await RenterWhitelistInstance.addToBlacklist(owner, {
        from: owner,
      });

      await RenterWhitelistInstance.removeFromBlacklist(owner, {
        from: owner,
      });

      const isBlacklisted = await RenterWhitelistInstance.blacklistedAddresses(
        owner,
        { from: owner }
      );

      expect(isBlacklisted).to.equal(false);
    });
  });
});
