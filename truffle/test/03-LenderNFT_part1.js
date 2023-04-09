const { expect } = require("chai");
const { expectRevert } = require("@openzeppelin/test-helpers");
const TwoWheels2RentLender = artifacts.require("TwoWheels2RentLender");

contract(
  "TwoWheels2RentLender",
  ([deployer, whitelistContract, recipient, other]) => {
    let nftInstance;

    beforeEach(async () => {
      nftInstance = await TwoWheels2RentLender.new({ from: deployer });
    });

    const bikeInfo = {
      name: "Bike 1",
      brand: "Brand A",
      model: "Model X",
      serial: "AB1234",
      registration: "REG9876",
    };

    it("should have correct name and symbol", async () => {
      const name = await nftInstance.name();
      const symbol = await nftInstance.symbol();
      expect(name).to.equal("2Wheels2RentLender");
      expect(symbol).to.equal("W2RNFTL");
    });

    it("should set whitelist contract address", async () => {
      await nftInstance.setLenderWhitelistContract(whitelistContract, {
        from: deployer,
      });
      const whitelistAddress = await nftInstance.whitelistContract();
      expect(whitelistAddress).to.equal(whitelistContract);
    });

    it("should not allow non-whitelist contract to mint NFT", async () => {
      await nftInstance.setLenderWhitelistContract(whitelistContract, {
        from: deployer,
      });
      const ipfsHash = "QmXesx456TY9XzxmYYG2JRQZ5to5bP2q3tZ5h887S5zm1G";
      await nftInstance.setIpfsHash(ipfsHash, { from: deployer });
      await expectRevert(
        nftInstance.mintNFT(recipient, bikeInfo, { from: other }),
        "Only the whitelist contract"
      );
    });

    it("should mint NFT with correct token URI", async () => {
      await nftInstance.setLenderWhitelistContract(whitelistContract, {
        from: deployer,
      });
      const ipfsHash = "QmXesx456TY9XzxmYYG2JRQZ5to5bP2q3tZ5h887S5zm1G";
      await nftInstance.setIpfsHash(ipfsHash, { from: deployer });

      const tx = await nftInstance.mintNFT(recipient, bikeInfo, {
        from: whitelistContract,
      });

      const transferEvent = tx.logs.find((log) => log.event === "Transfer");
      const tokenId = transferEvent.args.tokenId.toString();

      const tokenURI = await nftInstance.tokenURI(tokenId);
      const base64json = tokenURI.split("data:application/json;base64,")[1];
      const jsonString = Buffer.from(base64json, "base64").toString("utf8");
      const jsonData = JSON.parse(jsonString);

      expect(jsonData.name).to.equal(bikeInfo.name);
      expect(jsonData.description).to.equal("2Wheels2Rent Bike NFT");
      expect(jsonData.attributes[0].trait_type).to.equal("brand");
      expect(jsonData.attributes[0].value).to.equal(bikeInfo.brand);
      expect(jsonData.attributes[1].trait_type).to.equal("model");
      expect(jsonData.attributes[1].value).to.equal(bikeInfo.model);
      expect(jsonData.attributes[2].trait_type).to.equal("serial");
      expect(jsonData.attributes[2].value).to.equal(bikeInfo.serial);
      expect(jsonData.attributes[3].trait_type).to.equal("registration");
      expect(jsonData.attributes[3].value).to.equal(bikeInfo.registration);
    });
  }
);
