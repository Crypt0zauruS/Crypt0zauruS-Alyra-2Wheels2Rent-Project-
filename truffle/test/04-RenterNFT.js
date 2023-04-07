const { expect } = require("chai");
const { expectRevert } = require("@openzeppelin/test-helpers");
const TwoWheels2RentRenter = artifacts.require("TwoWheels2RentRenter");

contract(
  "TwoWheels2RentRenter",
  ([deployer, whitelistContract, recipient, other]) => {
    let nftInstance;

    beforeEach(async () => {
      nftInstance = await TwoWheels2RentRenter.new({ from: deployer });
    });

    const RenterInfo = {
      name: "Alice",
      rather: "sport",
    };

    it("should have correct name and symbol", async () => {
      const name = await nftInstance.name();
      const symbol = await nftInstance.symbol();
      expect(name).to.equal("2Wheels2RentRenter");
      expect(symbol).to.equal("W2RNFTT");
    });

    it("should set whitelist contract address", async () => {
      await nftInstance.setRenterWhitelistContract(whitelistContract, {
        from: deployer,
      });
      const whitelistAddress = await nftInstance.whitelistContract();
      expect(whitelistAddress).to.equal(whitelistContract);
    });

    it("should not allow non-whitelist contract to mint NFT", async () => {
      await nftInstance.setRenterWhitelistContract(whitelistContract, {
        from: deployer,
      });
      const ipfsHash = "QmXesx456TY9XzxmYYG2JRQZ5to5bP2q3tZ5h887S5zm1G";
      await nftInstance.setIpfsHash(ipfsHash, { from: deployer });
      await expectRevert(
        nftInstance.mintNFT(recipient, RenterInfo, { from: other }),
        "Only the whitelist contract"
      );
    });

    it("should mint NFT with correct token URI", async () => {
      await nftInstance.setRenterWhitelistContract(whitelistContract, {
        from: deployer,
      });
      const ipfsHash = "QmXesx456TY9XzxmYYG2JRQZ5to5bP2q3tZ5h887S5zm1G";
      await nftInstance.setIpfsHash(ipfsHash, { from: deployer });

      const tx = await nftInstance.mintNFT(recipient, RenterInfo, {
        from: whitelistContract,
      });

      const transferEvent = tx.logs.find((log) => log.event === "Transfer");
      const tokenId = transferEvent.args.tokenId.toString();

      const tokenURI = await nftInstance.tokenURI(tokenId);
      const base64json = tokenURI.split("data:application/json;base64,")[1];
      const jsonString = Buffer.from(base64json, "base64").toString("utf8");
      const jsonData = JSON.parse(jsonString);

      expect(jsonData.name).to.equal(RenterInfo.name);
      expect(jsonData.description).to.equal("2Wheels2Rent Renter NFT");
      expect(jsonData.attributes[0].trait_type).to.equal("rather");
      expect(jsonData.attributes[0].value).to.equal(RenterInfo.rather);
    });
  }
);
