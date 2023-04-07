const { BN, expectRevert } = require("@openzeppelin/test-helpers");
const W2R = artifacts.require("W2R.sol");
const initialSupply = web3.utils.toBN("160000000");
const VaultW2R = artifacts.require("VaultW2R.sol");
const MaticW2RPairToken = artifacts.require("MaticW2RPairToken.sol");
const MaticW2Rdex = artifacts.require("MaticW2Rdex.sol");
const initialSwapRate = 10;

contract("MaticW2Rdex", (accounts) => {
  let W2RInstance;
  let [owner, bob] = accounts;
  let amount;
  let VaultW2RInstance;
  let MaticW2RdexInstance;
  let MaticW2RPairTokenInstance;
  beforeEach(async () => {
    W2RInstance = await W2R.new(initialSupply, { from: owner });
    amount = new BN("10000000000000000000000");
    await W2RInstance.transfer(bob, amount, { from: owner });

    VaultW2RInstance = await VaultW2R.new(W2RInstance.address, {
      from: owner,
    });
    MaticW2RPairTokenInstance = await MaticW2RPairToken.new({
      from: owner,
    });

    MaticW2RdexInstance = await MaticW2Rdex.new(
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
  });

  it("should have the correct initial swap rate", async () => {
    const swapRate = await MaticW2RdexInstance.swapRate();
    assert.equal(
      swapRate.toString(),
      initialSwapRate.toString(),
      "Initial swap rate is incorrect"
    );
  });

  it("should allow owner to update swap rate", async () => {
    const newSwapRate = 15;
    await MaticW2RdexInstance.setSwapRate(newSwapRate, { from: owner });
    const updatedSwapRate = await MaticW2RdexInstance.swapRate();
    assert.equal(
      updatedSwapRate.toString(),
      newSwapRate.toString(),
      "Updated swap rate is incorrect"
    );
  });

  it("should not allow non-owner to update swap rate", async () => {
    const newSwapRate = 15;
    try {
      await MaticW2RdexInstance.setSwapRate(newSwapRate, {
        from: bob,
      });
      assert.fail("Non-owner should not be able to update swap rate");
    } catch (error) {
      assert(
        error.message.includes("Ownable: caller is not the owner"),
        "Expected error message not found"
      );
    }
  });

  it("should allow only owner to add liquidity first", async () => {
    const w2rToLiquidity = new BN("1000000000000000000000");
    const maticToLiquidity = new BN("100000000000000000000");
    await W2RInstance.approve(MaticW2RdexInstance.address, w2rToLiquidity, {
      from: bob,
    });

    try {
      await MaticW2RdexInstance.addLiquidity(w2rToLiquidity, {
        from: bob,
        value: maticToLiquidity,
      });

      assert.fail("Only owner can add liquidity");
    } catch (error) {
      const revertFound =
        error.message.search("Only owner can add liquidity") >= 0;
      assert(
        revertFound,
        `Expected "Only owner can add liquidity", got ${error} instead`
      );
    }
  });

  it("should not swap more W2R tokens than the user has", async () => {
    const OwnerW2RBalance = await W2RInstance.balanceOf(owner);
    const w2rToGiveToBob = OwnerW2RBalance.sub(new BN("10000000000000000000"));
    await W2RInstance.transfer(bob, w2rToGiveToBob, { from: owner });
    const w2rToSwap = new BN("11000000000000000000");
    await W2RInstance.approve(MaticW2RdexInstance.address, w2rToSwap, {
      from: owner,
    });
    await expectRevert(
      MaticW2RdexInstance.swapW2RForMatic(w2rToSwap, { from: owner }),
      "Not enough W2R"
    );
  });

  it("should not swap more Matic than the user has", async () => {
    const OwnerMaticBalance = await web3.eth.getBalance(owner);
    const maticToGiveToBob = new BN(OwnerMaticBalance.toString()).sub(
      new BN("10000000000000000000")
    );
    // transfer matic to bob
    await web3.eth.sendTransaction({
      from: owner,
      to: bob,
      value: maticToGiveToBob,
    });
    const MaticToSwap = new BN("11000000000000000000");
    try {
      await MaticW2RdexInstance.swapMaticForW2R({
        from: owner,
        value: MaticToSwap,
      }),
        assert.fail("not enough Matic");
    } catch (error) {
      const revertFound = error.message.search("not enough Matic") >= 0;
      assert(revertFound, `Expected "not enough Matic", got ${error} instead`);
    }
  });

  it("should not swap more W2R tokens than 5% the contract has", async () => {
    const w2rToSwap = new BN("10000000000000000000");
    await W2RInstance.approve(MaticW2RdexInstance.address, w2rToSwap, {
      from: bob,
    });
    await expectRevert(
      MaticW2RdexInstance.swapW2RForMatic(w2rToSwap, { from: bob }),
      "You can't swap more than 5% of the contract's MATIC liquidity"
    );
  });
});
