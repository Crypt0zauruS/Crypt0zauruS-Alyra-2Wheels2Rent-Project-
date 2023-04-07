const { BN, expectRevert, time } = require("@openzeppelin/test-helpers");
const W2R = artifacts.require("W2R.sol");
const initialSupply = web3.utils.toBN("160000000");
const VaultW2R = artifacts.require("VaultW2R.sol");
const MaticW2RPairToken = artifacts.require("MaticW2RPairToken.sol");
const MaticW2Rdex = artifacts.require("MaticW2Rdex.sol");
const initialSwapRate = 10;

/// !!!!!!   Launch GANACHE WITH   ganache --defaultBalanceEther 10000000000000000000  to have sufficient funds for all tests !!!!!!////////

contract("MaticW2Rdex", (accounts) => {
  let W2RInstance;
  let [owner, bob, alice] = accounts;
  let amount;
  let VaultW2RInstance;
  let MaticW2RdexInstance;
  let MaticW2RPairTokenInstance;
  beforeEach(async () => {
    // Deploy W2R
    W2RInstance = await W2R.new(initialSupply, { from: owner });
    amount = new BN("10000000000000000000000");
    await W2RInstance.transfer(bob, amount, { from: owner });
    // Deploy VaultW2R
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
    const transferMatic = web3.utils.toWei("100000", "ether");
    const transferW2R = web3.utils.toWei("1000000", "ether");
   
    await W2RInstance.approve(MaticW2RdexInstance.address, transferW2R, {
      from: owner,
    });
   
    await MaticW2RdexInstance.addLiquidity(transferW2R, {
      from: owner,
      value: transferMatic,
    });
  });

  describe("add liquidity and swapping", () => {
    it("should fail to add Liquidity when W2R amount is less than or equal to 0", async () => {
      const w2rToLiquidity = new BN("0");
      const maticToLiquidity = new BN("100000000000000000000");
      await W2RInstance.approve(MaticW2RdexInstance.address, w2rToLiquidity, {
        from: bob,
      });
      await expectRevert(
        MaticW2RdexInstance.addLiquidity(w2rToLiquidity, {
          from: bob,
          value: maticToLiquidity,
        }),
        "W2R amount must be greater than 0"
      );
    });

    it("should fail when MATIC amount is less than or equal to 0", async () => {
      const w2rToLiquidity = new BN("1000000000000000000000");
      await W2RInstance.approve(MaticW2RdexInstance.address, w2rToLiquidity, {
        from: bob,
      });
      await expectRevert(
        MaticW2RdexInstance.addLiquidity(w2rToLiquidity, {
          from: bob,
          value: 0,
        }),
        "MATIC amount must be greater than 0"
      );
    });

    it("should fail when W2R allowance is insufficient", async () => {
      const w2rToLiquidity = new BN("1000000000000000000000");
      const maticToLiquidity = new BN("100000000000000000000");
      const insufficientAllowance = new BN("500000000000000000000");
      await W2RInstance.approve(
        MaticW2RdexInstance.address,
        insufficientAllowance,
        { from: bob }
      );
      await expectRevert(
        MaticW2RdexInstance.addLiquidity(w2rToLiquidity, {
          from: bob,
          value: maticToLiquidity,
        }),
        "You need to approve W2R first"
      );
    });

    it("should fail when MATIC-W2R ratio is not within the allowed slippage", async () => {
      const w2rToLiquidity = new BN("1000000000000000000000");
      const maticToLiquidity = new BN("200000000000000000000");
      await W2RInstance.approve(MaticW2RdexInstance.address, w2rToLiquidity, {
        from: bob,
      });
      await expectRevert(
        MaticW2RdexInstance.addLiquidity(w2rToLiquidity, {
          from: bob,
          value: maticToLiquidity,
        }),
        "MATIC-W2R ratio is not within the allowed slippage"
      );
    });

    it("should allow user to add liquidity", async () => {
      await W2RInstance.approve(
        MaticW2RdexInstance.address,
        new BN("100000000000000000000000"),
        { from: owner }
      );
      await MaticW2RdexInstance.addLiquidity(
        new BN("100000000000000000000000"),
        {
          from: owner,
          value: new BN("10000000000000000000000"),
        }
      );
      const w2rToLiquidity = new BN("1000000000000000000000");
      const maticToLiquidity = new BN("100000000000000000000");
      await W2RInstance.approve(MaticW2RdexInstance.address, w2rToLiquidity, {
        from: bob,
      });
      await MaticW2RdexInstance.addLiquidity(w2rToLiquidity, {
        from: bob,
        value: maticToLiquidity,
      });
      const lpBalance = await MaticW2RPairTokenInstance.balanceOf(bob);
      assert(
        lpBalance.gt(new BN("0")),
        "LP token balance should be greater than 0"
      );
    });

    it("should swap W2R tokens for Matic", async () => {
      await W2RInstance.approve(
        MaticW2RdexInstance.address,
        new BN("100000000000000000000000"),
        { from: owner }
      );
      await MaticW2RdexInstance.addLiquidity(
        new BN("100000000000000000000000"),
        {
          from: owner,
          value: new BN("10000000000000000000000"),
        }
      );
      const MaticBalance = await web3.eth.getBalance(bob);
      const w2rToSwap = new BN("10000000000000000000");
      const expectedMatic = w2rToSwap.div(new BN(initialSwapRate));
      const feesPercent = await MaticW2RdexInstance.feesPercent();
      const fees = expectedMatic.mul(new BN(feesPercent)).div(new BN("100"));
      const expectedMaticWithFees = w2rToSwap
        .div(new BN(initialSwapRate))
        .sub(fees);
      await W2RInstance.approve(MaticW2RdexInstance.address, w2rToSwap, {
        from: bob,
      });
      const tx = await MaticW2RdexInstance.swapW2RForMatic(w2rToSwap, {
        from: bob,
      });
      const transactionReceipt = await web3.eth.getTransactionReceipt(tx.tx);
      const gasUsed = transactionReceipt.gasUsed;
      const newMaticBalance = await web3.eth.getBalance(bob);
      const result = new BN(MaticBalance)
        .add(new BN(expectedMaticWithFees))
        .sub(new BN(gasUsed));
      const margin = new BN("10000000000000000");
      assert.approximately(
        parseFloat(newMaticBalance.toString()),
        parseFloat(result.toString()),
        parseFloat(margin.toString()),
        "Swapped pair token amount is incorrect"
      );
      const w2rBalance = await W2RInstance.balanceOf(bob);
      assert.equal(
        w2rBalance.toString(),
        amount.sub(w2rToSwap).toString(),
        "Remaining W2R balance is incorrect"
      );
    });

    it("should swap Matic for W2R tokens", async () => {
      await W2RInstance.approve(
        MaticW2RdexInstance.address,
        new BN("100000000000000000000000"),
        { from: owner }
      );
      await MaticW2RdexInstance.addLiquidity(
        new BN("100000000000000000000000"),
        {
          from: owner,
          value: new BN("10000000000000000000000"),
        }
      );
      const w2rBalance = await W2RInstance.balanceOf(bob);
      await web3.eth.getBalance(bob);
      const MaticToSwap = new BN("10000000000000000000");
      const feesPercent = await MaticW2RdexInstance.feesPercent();
      const fees = MaticToSwap.mul(new BN(feesPercent)).div(new BN("100"));
      let expectedW2R = MaticToSwap.mul(new BN(initialSwapRate));
      expectedW2R = expectedW2R.sub(new BN(fees));
      await MaticW2RdexInstance.swapMaticForW2R({
        from: bob,
        value: MaticToSwap,
      });
      const result = new BN(w2rBalance).add(new BN(expectedW2R));
      let newBalance = await W2RInstance.balanceOf(bob);
      newBalance = new BN(newBalance);
      const margin = new BN("100000000000000000000000");
      assert.approximately(
        parseFloat(newBalance.toString()),
        parseFloat(result.toString()),
        parseFloat(margin.toString()),
        "Swapped W2R token amount is incorrect"
      );
    });
  });

  describe("Remove Liquidity", () => {
    it("should allow user to remove liquidity", async () => {
      await W2RInstance.approve(
        MaticW2RdexInstance.address,
        new BN("100000000000000000000000"),
        { from: owner }
      );
      await MaticW2RdexInstance.addLiquidity(
        new BN("100000000000000000000000"),
        {
          from: owner,
          value: new BN("10000000000000000000000"),
        }
      );
      const w2rToLiquidity = new BN("1000000000000000000000");
      const maticToLiquidity = new BN("100000000000000000000");

      await W2RInstance.approve(MaticW2RdexInstance.address, w2rToLiquidity, {
        from: bob,
      });

      await MaticW2RdexInstance.addLiquidity(w2rToLiquidity, {
        from: bob,
        value: maticToLiquidity,
      });

      const lpTokenBalance = await MaticW2RPairTokenInstance.balanceOf(bob);
      await MaticW2RPairTokenInstance.approve(
        MaticW2RdexInstance.address,
        lpTokenBalance,
        { from: bob }
      );

      await MaticW2RdexInstance.removeLiquidity(lpTokenBalance, { from: bob });

      const w2rBalance = await W2RInstance.balanceOf(bob);
      const maticBalance = await web3.eth.getBalance(bob);

      assert.isAbove(
        parseFloat(w2rBalance.toString()),
        parseFloat(w2rToLiquidity.toString()),
        "W2R balance should be greater after removing liquidity"
      );

      assert.isAbove(
        parseFloat(maticBalance.toString()),
        parseFloat(maticToLiquidity.toString()),
        "MATIC balance should be greater after removing liquidity"
      );
    });

    it("should not allow user to remove more LP tokens than they have", async () => {
      await W2RInstance.approve(
        MaticW2RdexInstance.address,
        new BN("100000000000000000000000"),
        { from: owner }
      );
      await MaticW2RdexInstance.addLiquidity(
        new BN("100000000000000000000000"),
        {
          from: owner,
          value: new BN("10000000000000000000000"),
        }
      );
      const w2rToLiquidity = new BN("1000000000000000000000");
      const maticToLiquidity = new BN("100000000000000000000");

      await W2RInstance.approve(MaticW2RdexInstance.address, w2rToLiquidity, {
        from: bob,
      });

      await MaticW2RdexInstance.addLiquidity(w2rToLiquidity, {
        from: bob,
        value: maticToLiquidity,
      });

      const lpTokenBalance = await MaticW2RPairTokenInstance.balanceOf(bob);
      const excessLPTokens = lpTokenBalance.add(new BN("1000000000000000000"));
      await MaticW2RPairTokenInstance.approve(
        MaticW2RdexInstance.address,
        excessLPTokens,
        { from: bob }
      );

      await expectRevert(
        MaticW2RdexInstance.removeLiquidity(excessLPTokens, { from: bob }),
        "You don't have any LP tokens to remove"
      );
    });
  });

  describe("Farming", () => {
    it("should allow user to farm LP tokens", async () => {
      await W2RInstance.approve(
        MaticW2RdexInstance.address,
        new BN("100000000000000000000000"),
        { from: owner }
      );
      await MaticW2RdexInstance.addLiquidity(
        new BN("100000000000000000000000"),
        {
          from: owner,
          value: new BN("10000000000000000000000"),
        }
      );
      const w2rToLiquidity = new BN("1000000000000000000000");
      const maticToLiquidity = new BN("100000000000000000000");

      await W2RInstance.approve(MaticW2RdexInstance.address, w2rToLiquidity, {
        from: bob,
      });

      await MaticW2RdexInstance.addLiquidity(w2rToLiquidity, {
        from: bob,
        value: maticToLiquidity,
      });

      const lpTokenBalance = await MaticW2RPairTokenInstance.balanceOf(bob);
      await MaticW2RPairTokenInstance.approve(
        MaticW2RdexInstance.address,
        lpTokenBalance,
        { from: bob }
      );

      await MaticW2RdexInstance.farm(lpTokenBalance, { from: bob });

      const userFarming = await MaticW2RdexInstance.farming(bob);
      assert.equal(
        userFarming.lpAmount.toString(),
        lpTokenBalance.toString(),
        "Farming LP amount is incorrect"
      );
      const currentTime = await time.latest();
      assert.isAtLeast(
        parseInt(userFarming.lastTime),
        parseInt(currentTime),
        "Farming last time is incorrect"
      );
    });

    it("should not allow user to farm 0 LP tokens", async () => {
      await expectRevert(
        MaticW2RdexInstance.farm(0, { from: bob }),
        "LP amount must be greater than 0"
      );
    });

    it("should not allow user to farm LP tokens without approving LP tokens first", async () => {
      await W2RInstance.approve(
        MaticW2RdexInstance.address,
        new BN("100000000000000000000000"),
        { from: owner }
      );
      await MaticW2RdexInstance.addLiquidity(
        new BN("100000000000000000000000"),
        {
          from: owner,
          value: new BN("10000000000000000000000"),
        }
      );

      const w2rToLiquidity = new BN("1000000000000000000000");
      const maticToLiquidity = new BN("100000000000000000000");

      await W2RInstance.approve(MaticW2RdexInstance.address, w2rToLiquidity, {
        from: bob,
      });

      await MaticW2RdexInstance.addLiquidity(w2rToLiquidity, {
        from: bob,
        value: maticToLiquidity,
      });

      const lpTokenBalance = await MaticW2RPairTokenInstance.balanceOf(bob);

      try {
        await MaticW2RdexInstance.farm(lpTokenBalance, { from: bob });
        assert.fail("You need to approve LP token first");
      } catch (error) {
        assert(
          error.message.includes("You need to approve LP token first"),
          "Expected error message not found"
        );
      }
    });

    it("should not allow user to exit farm if they have no LP tokens to claim", async () => {
      await expectRevert(
        MaticW2RdexInstance.exitFarm({ from: alice }),
        "No LP tokens to claim rewards"
      );
    });

    it("should allow user to exit farm, retrieve their LP tokens, and harvest rewards successfully", async () => {
      await W2RInstance.approve(
        MaticW2RdexInstance.address,
        new BN("100000000000000000000000"),
        { from: owner }
      );
      await MaticW2RdexInstance.addLiquidity(
        new BN("100000000000000000000000"),
        {
          from: owner,
          value: new BN("10000000000000000000000"),
        }
      );
      const transferAmount = new BN("100000000000000000000000");
      await W2RInstance.approve(VaultW2RInstance.address, transferAmount, {
        from: owner,
      });

      await W2RInstance.transfer(VaultW2RInstance.address, transferAmount, {
        from: owner,
      });

      const w2rToLiquidity = new BN("1000000000000000000000");
      const maticToLiquidity = new BN("100000000000000000000");

      await W2RInstance.approve(MaticW2RdexInstance.address, w2rToLiquidity, {
        from: bob,
      });

      await MaticW2RdexInstance.addLiquidity(w2rToLiquidity, {
        from: bob,
        value: maticToLiquidity,
      });

      const lpTokenBalance = await MaticW2RPairTokenInstance.balanceOf(bob);
      await MaticW2RPairTokenInstance.approve(
        MaticW2RdexInstance.address,
        lpTokenBalance,
        { from: bob }
      );

      await MaticW2RdexInstance.farm(lpTokenBalance, { from: bob });

      const initialLpTokenBalance = await MaticW2RPairTokenInstance.balanceOf(
        bob
      );
      const initialW2RBalance = await W2RInstance.balanceOf(bob);

      assert.equal(
        initialLpTokenBalance.toString(),
        "0",
        "Initial LP token balance should be 0 after farming"
      );

      await time.increase(time.duration.days(1));
      await MaticW2RdexInstance.exitFarm({ from: bob });

      const finalLpTokenBalance = await MaticW2RPairTokenInstance.balanceOf(
        bob
      );
      const finalW2RBalance = await W2RInstance.balanceOf(bob);

      assert.equal(
        finalLpTokenBalance.toString(),
        lpTokenBalance.toString(),
        "Final LP token balance should be equal to initial balance after exitFarm"
      );

      assert.isTrue(
        finalW2RBalance.gt(initialW2RBalance),
        "Final W2R balance should be greater than initial balance after exitFarm and harvesting rewards"
      );
    });
  });
  describe("withdrw fess", () => {
    it("should allow owner to withdraw fees successfully", async () => {
      await W2RInstance.approve(
        MaticW2RdexInstance.address,
        new BN("100000000000000000000000"),
        { from: owner }
      );
      await MaticW2RdexInstance.addLiquidity(
        new BN("100000000000000000000000"),
        {
          from: owner,
          value: new BN("10000000000000000000000"),
        }
      );
      await web3.eth.getBalance(bob);
      const MaticToSwap = new BN("10000000000000000000");

      await MaticW2RdexInstance.swapMaticForW2R({
        from: bob,
        value: MaticToSwap,
      });

      const initialMaticBalance = await web3.eth.getBalance(owner);
      await MaticW2RdexInstance.withdrawFees({ from: owner });
      const finalMaticBalance = await web3.eth.getBalance(owner);
      assert.isTrue(
        new BN(finalMaticBalance).gt(new BN(initialMaticBalance)),
        "Final Matic balance should be greater than initial balance after withdrawFees"
      );
    });
  });
});
