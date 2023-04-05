const W2R = artifacts.require("./W2R.sol");
const { BN, expectRevert } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");

contract("W2R", (accounts) => {
  let W2RToken;
  const owner = accounts[0];

  beforeEach(async () => {
    W2RToken = await W2R.new(100000000);
  });

  describe("Token Deployment", () => {
    it("should have the correct name and symbol", async () => {
      const name = await W2RToken.name();
      const symbol = await W2RToken.symbol();

      expect(name).to.equal("2 Wheels 2 Rent Token");
      expect(symbol).to.equal("W2R");
    });

    it("should have the correct initial supply and owner balance", async () => {
      const totalSupply = await W2RToken.totalSupply();
      const ownerBalance = await W2RToken.balanceOf(owner);

      expect(totalSupply).to.be.bignumber.equal(
        web3.utils.toBN(100000000).mul(web3.utils.toBN(10).pow(new BN(18)))
      );
      expect(ownerBalance).to.be.bignumber.equal(totalSupply);
    });
  });

  describe("Minting tokens", () => {
    it("should allow the owner to mint tokens", async () => {
      await W2RToken.mint(accounts[1], 1000, { from: owner });
      const balance = await W2RToken.balanceOf(accounts[1]);
      expect(balance).to.be.bignumber.equal(web3.utils.toBN(1000));
    });

    it("should not allow non-owners to mint tokens", async () => {
      await expectRevert(
        W2RToken.mint(accounts[1], 1000, { from: accounts[2] }),
        "Ownable: caller is not the owner"
      );
    });

    it("should not allow minting tokens beyond the max supply", async () => {
      await expectRevert(
        W2RToken.mint(
          accounts[1],
          web3.utils.toBN(200000001).mul(web3.utils.toBN(10).pow(new BN(18))),
          { from: owner }
        ),
        "ERC20Capped: cap exceeded"
      );
    });
  });

  describe("Burning tokens", () => {
    it("should allow the owner to burn tokens", async () => {
      const initialBalance = await W2RToken.balanceOf(owner);
      await W2RToken.burn(1000, { from: owner });
      const finalBalance = await W2RToken.balanceOf(owner);
      expect(initialBalance.sub(finalBalance)).to.be.bignumber.equal(
        web3.utils.toBN(1000)
      );
    });

    it("should not allow non-owners to burn tokens", async () => {
      await W2RToken.transfer(accounts[1], 1000, { from: owner });
      await expectRevert(
        W2RToken.burn(1000, { from: accounts[1] }),
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("Pausing and unpausing", () => {
    it("should allow the owner to pause the token", async () => {
      await W2RToken.pause({ from: owner });
      const isPaused = await W2RToken.paused();
      expect(isPaused).to.equal(true);
    });

    it("should not allow non-owners to pause the token", async () => {
      await expectRevert(
        W2RToken.pause({ from: accounts[1] }),
        "Ownable: caller is not the owner"
      );
    });

    it("should not allow transfers when paused", async () => {
      await W2RToken.pause({ from: owner });
      await expectRevert(
        W2RToken.transfer(accounts[1], 1000, { from: owner }),
        "Pausable: paused"
      );
    });

    it("should allow the owner to unpause the token", async () => {
      await W2RToken.pause({ from: owner });
      await W2RToken.unpause({ from: owner });
      const isPaused = await W2RToken.paused();
      expect(isPaused).to.equal(false);
    });

    it("should not allow non-owners to unpause the token", async () => {
      await W2RToken.pause({ from: owner });
      await expectRevert(
        W2RToken.unpause({ from: accounts[1] }),
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("Burning tokens from another account", () => {
    it("should allow the owner to burn tokens from another account", async () => {
      await W2RToken.transfer(accounts[1], 1000, { from: owner });
      const initialBalance = await W2RToken.balanceOf(accounts[1]);
      await W2RToken.approve(owner, 500, { from: accounts[1] });
      await W2RToken.burnFrom(accounts[1], 500, { from: owner });
      const finalBalance = await W2RToken.balanceOf(accounts[1]);
      expect(initialBalance.sub(finalBalance)).to.be.bignumber.equal(
        web3.utils.toBN(500)
      );
    });
  });
});
