const { expect } = require("chai");
const { expectRevert } = require("@openzeppelin/test-helpers");
const MaticW2RPairToken = artifacts.require("MaticW2RPairToken");

contract("MaticW2RPairToken", ([deployer, minter, burner, user1]) => {
  let tokenInstance;

  beforeEach(async () => {
    tokenInstance = await MaticW2RPairToken.new({ from: deployer });
  });

  it("should have correct name and symbol", async () => {
    const name = await tokenInstance.name();
    const symbol = await tokenInstance.symbol();
    expect(name).to.equal("Matic-W2R LP Token");
    expect(symbol).to.equal("MATIC-W2R");
  });

  it("should allow owner to add a minter and burner", async () => {
    await tokenInstance.addMinterAndBurner(minter, { from: deployer });
    const isMinterAndBurner = await tokenInstance.checkMinterAndBurner(minter);
    expect(isMinterAndBurner).to.equal(true);
  });

  it("should not allow non-owner to add a minter and burner", async () => {
    await expectRevert(
      tokenInstance.addMinterAndBurner(minter, { from: user1 }),
      "Ownable: caller is not the owner"
    );
  });

  it("should allow owner to remove a minter and burner", async () => {
    await tokenInstance.addMinterAndBurner(burner, { from: deployer });
    await tokenInstance.removeMinterAndBurner(burner, { from: deployer });
    const isMinterAndBurner = await tokenInstance.checkMinterAndBurner(burner);
    expect(isMinterAndBurner).to.equal(false);
  });

  it("should not allow non-minter to mint tokens", async () => {
    try {
      assert.fail("You are not a minter");
    } catch (error) {
      const revertFound = error.message.search("You are not a minter") >= 0;
      assert(
        revertFound,
        `Expected "You are not a minter", got ${error} instead`
      );
    }
  });

  it("should only allow burner to burn tokens", async () => {
    await tokenInstance.addMinterAndBurner(burner, { from: deployer });
    await tokenInstance.mint(burner, 1000, { from: deployer });
    await tokenInstance.burn(500, { from: burner });

    const balance = await tokenInstance.balanceOf(burner);
    expect(balance.toString()).to.equal("500");
  });

  it("should allow minter to transfer tokens to another minter", async () => {
    await tokenInstance.addMinterAndBurner(minter, { from: deployer });
    await tokenInstance.addMinterAndBurner(user1, { from: deployer });

    await tokenInstance.mint(minter, 1000, { from: deployer });
    await tokenInstance.transfer(user1, 500, { from: minter });

    const balance = await tokenInstance.balanceOf(user1);
    expect(balance.toString()).to.equal("500");
  });

  it("should not allow non-owner to remove a minter and burner", async () => {
    await tokenInstance.addMinterAndBurner(minter, { from: deployer });
    try {
      await tokenInstance.removeMinterAndBurner(minter, { from: user1 });
      assert.fail("Ownable: caller is not the owner");
    } catch (error) {
      const revertFound =
        error.message.search("Ownable: caller is not the owner") >= 0;
      assert(
        revertFound,
        `Expected "Ownable: caller is not the owner", got ${error} instead`
      );
    }
  });

  it("should not allow minter to transfer tokens to a non-minter", async () => {
    await tokenInstance.addMinterAndBurner(minter, { from: deployer });
    await tokenInstance.mint(minter, 1000, { from: deployer });
    try {
      await tokenInstance.transfer(user1, 500, { from: minter });
      assert.fail("You are not a minter");
    } catch (error) {
      const revertFound = error.message.search("You are not a minter") >= 0;
      assert(
        revertFound,
        `Expected "You are not a minter", got ${error} instead`
      );
    }
  });

  it("should not allow minting to zero address", async () => {
    await tokenInstance.addMinterAndBurner(minter, { from: deployer });
    try {
      await tokenInstance.mint(
        "0x0000000000000000000000000000000000000000",
        1000,
        { from: minter }
      );
      assert.fail("ERC20: mint to the zero address");
    } catch (error) {
      const revertFound =
        error.message.search("ERC20: mint to the zero address") >= 0;
      assert(
        revertFound,
        `Expected "ERC20: mint to the zero address", got ${error} instead`
      );
    }
  });
});
