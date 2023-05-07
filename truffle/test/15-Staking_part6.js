const { expectRevert, time } = require("@openzeppelin/test-helpers");
const W2R = artifacts.require("W2R.sol");
const VaultW2R = artifacts.require("VaultW2R.sol");
const MockPriceFeed = artifacts.require("MockPriceFeed");
const W2RStaking = artifacts.require("W2RStaking");
const priceDecimals = 8;
const initialPrice = 120000000;
const initialSupply = web3.utils.toBN("160000000");

contract("Staking", (accounts) => {
  let owner = accounts[0];
  let W2RInstance;
  let VaultW2RInstance;
  let MockPriceFeedInstance;
  let priceFeed;
  let W2RStakingInstance;

  beforeEach(async () => {
    W2RInstance = await W2R.new(initialSupply, { from: owner });

    VaultW2RInstance = await VaultW2R.new(W2RInstance.address, {
      from: owner,
    });

    MockPriceFeedInstance = await MockPriceFeed.new(
      priceDecimals,
      initialPrice,
      { from: owner }
    );

    priceFeed = MockPriceFeedInstance.address;

    W2RStakingInstance = await W2RStaking.new(
      W2RInstance.address,
      priceFeed,
      VaultW2RInstance.address,
      { from: owner }
    );

    await VaultW2RInstance.setApprovedContract(
      W2RStakingInstance.address,
      true,
      { from: owner }
    );

    const transferW2R = web3.utils.toWei("1000000", "ether");
    await W2RInstance.approve(W2RStakingInstance.address, transferW2R, {
      from: owner,
    });
    const transferAmount = web3.utils.toWei("1000000", "ether");
    await W2RInstance.transfer(VaultW2RInstance.address, transferAmount, {
      from: owner,
    });
  });
  // Test 1: Staking W2R tokens
  it("should stake W2R tokens", async () => {
    const staker = accounts[1];
    const stakeAmount = web3.utils.toWei("1000", "ether");

    await W2RInstance.transfer(staker, stakeAmount, { from: owner });
    await W2RInstance.approve(W2RStakingInstance.address, stakeAmount, {
      from: staker,
    });

    await W2RStakingInstance.stake(stakeAmount, 1, false, { from: staker });

    const stakerBalance = await W2RInstance.balanceOf(
      W2RStakingInstance.address
    );
    assert.equal(stakerBalance.toString(), stakeAmount, "Staking failed");
  });

  // Test 2: Unstaking W2R tokens
  it("should not unstake W2R tokens before 15 days", async () => {
    const staker = accounts[1];
    const stakeAmount = web3.utils.toWei("1000", "ether");

    await W2RInstance.transfer(staker, stakeAmount, { from: owner });
    await W2RInstance.approve(W2RStakingInstance.address, stakeAmount, {
      from: staker,
    });

    await W2RStakingInstance.stake(stakeAmount, 1, false, { from: staker });
    await time.increase(time.duration.days(14));

    expectRevert(
      W2RStakingInstance.unstake(stakeAmount, false, { from: staker }),
      "Cannot unstake before 15 days"
    );
  });

  // Test 3: Earning and claiming rewards
  it("should earn and claim rewards", async () => {
    const staker = accounts[1];
    const stakeAmount = web3.utils.toWei("1000", "ether");

    await W2RInstance.transfer(staker, stakeAmount, { from: owner });
    await W2RInstance.approve(W2RStakingInstance.address, stakeAmount, {
      from: staker,
    });

    await W2RStakingInstance.stake(stakeAmount, 1, false, { from: staker });

    // Advance time to simulate staking rewards
    await time.increase(time.duration.days(7));

    const rewardsEarned = await W2RStakingInstance.viewReward(staker);
    assert(rewardsEarned.gt(web3.utils.toBN("0")), "No rewards earned");

    await W2RStakingInstance.claimReward({ from: staker });

    const W2RBalanceAfterClaim = await W2RInstance.balanceOf(staker);
    assert(
      W2RBalanceAfterClaim.gt(web3.utils.toBN(stakeAmount)),
      "Claiming rewards failed"
    );
  });

  // Test 4: Reverting when trying to unstake more tokens than staked
  it("should revert when trying to unstake more tokens than staked", async () => {
    const staker = accounts[1];
    const stakeAmount = web3.utils.toWei("1000", "ether");
    const unstakeAmount = web3.utils.toWei("2000", "ether");

    await W2RInstance.transfer(staker, stakeAmount, { from: owner });
    await W2RInstance.approve(W2RStakingInstance.address, stakeAmount, {
      from: staker,
    });
    await W2RStakingInstance.stake(stakeAmount, 1, false, { from: staker });
    await time.increase(time.duration.days(16));
    await expectRevert(
      W2RStakingInstance.unstake(unstakeAmount, false, { from: staker }),
      "Not enough tokens staked"
    );
  });

  // Test 5: Reverting when trying to unstake before 15 days
  it("should revert when trying to unstake before 15 days", async () => {
    const staker = accounts[1];
    const stakeAmount = web3.utils.toWei("1000", "ether");
    await W2RInstance.transfer(staker, stakeAmount, { from: owner });
    await W2RInstance.approve(W2RStakingInstance.address, stakeAmount, {
      from: staker,
    });
    await W2RStakingInstance.stake(stakeAmount, 1, false, { from: staker });
    await time.increase(time.duration.days(14));
    await expectRevert(
      W2RStakingInstance.unstake(stakeAmount, false, { from: staker }),
      "Cannot unstake before 15 days"
    );
  });

  // Test 6: Reverting when trying to stake zero tokens
  it("should revert when trying to stake zero tokens", async () => {
    const staker = accounts[1];
    const stakeAmount = web3.utils.toWei("0", "ether");

    await expectRevert(
      W2RStakingInstance.stake(stakeAmount, 1, false, { from: staker }),
      "Amount too small"
    );
  });

  // Test 7: Staker should be able to withdraw staked tokens and rewards after lockup period
  it("should be able to withdraw staked tokens and rewards after lockup period", async () => {
    const staker = accounts[1];
    const stakeAmount = web3.utils.toWei("5000", "ether");
    const unstakeAmount = web3.utils.toWei("3000", "ether");

    await W2RInstance.transfer(staker, stakeAmount, { from: owner });
    await W2RInstance.approve(W2RStakingInstance.address, stakeAmount, {
      from: staker,
    });

    await W2RStakingInstance.stake(stakeAmount, 1, false, { from: staker });
    await time.increase(time.duration.days(40));

    const initialStakerBalance = await W2RInstance.balanceOf(staker);
    await W2RStakingInstance.unstake(unstakeAmount, false, { from: staker });
    const finalStakerBalance = await W2RInstance.balanceOf(staker);

    assert.isTrue(
      finalStakerBalance.gt(initialStakerBalance),
      "Staker balance did not increase after unstaking and claiming rewards"
    );
  });

  // Test 8: Reverting when trying to claim rewards without staking any tokens
  it("should revert when trying to claim rewards without staking any tokens", async () => {
    const staker = accounts[1];

    await expectRevert(
      W2RStakingInstance.claimReward({ from: staker }),
      "Nothing to claim"
    );
  });

  // Test 9: Reverting when trying to stake tokens without approval
  it("should revert when trying to stake tokens without approval", async () => {
    const staker = accounts[1];
    const stakeAmount = web3.utils.toWei("1000", "ether");

    await W2RInstance.transfer(staker, stakeAmount, { from: owner });

    await expectRevert(
      W2RStakingInstance.stake(stakeAmount, 1, false, { from: staker }),
      "Need approval for this amount"
    );
  });

  // Test 10: Authorize only owner to withdraw fees
  it("should authorize to withdraw fees only if caller is owner", async () => {
    const staker = accounts[1];
    const stakeAmount = web3.utils.toWei("1000", "ether");

    await W2RInstance.transfer(staker, stakeAmount, { from: owner });
    await W2RInstance.approve(W2RStakingInstance.address, stakeAmount, {
      from: staker,
    });

    await W2RStakingInstance.stake(stakeAmount, 1, false, { from: staker });

    // Advance time to simulate staking rewards
    await time.increase(time.duration.days(40));

    const rewardsEarned = await W2RStakingInstance.viewReward(staker);
    assert(rewardsEarned.gt(web3.utils.toBN("0")), "No rewards earned");

    await W2RStakingInstance.claimReward({ from: staker });

    expectRevert(
      W2RStakingInstance.withdrawFees({ from: staker }),
      "Ownable: caller is not the owner"
    );
  });
});
