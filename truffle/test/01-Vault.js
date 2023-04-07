const { BN, expectRevert, expectEvent } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");

const W2R = artifacts.require("W2R");
const VaultW2R = artifacts.require("VaultW2R");

contract("VaultW2R", (accounts) => {
  const owner = accounts[0];
  const approvedContract = accounts[1];
  const notApprovedContract = accounts[2];
  const receiver = accounts[3];
  const initialSupply = new BN("160000000");

  beforeEach(async () => {
    W2RInstance = await W2R.new(initialSupply, { from: owner });
    VaultW2RInstance = await VaultW2R.new(W2RInstance.address, { from: owner });
    await W2RInstance.transfer(
      VaultW2RInstance.address,
      new BN("80000000000000000000000000"),
      {
        from: owner,
      }
    );
  });

  it("should set the correct W2R token address", async () => {
    const W2RAddress = await VaultW2RInstance.W2R();
    expect(W2RAddress).to.equal(W2RInstance.address);
  });

  it("should set and get whitelistLenders", async () => {
    await VaultW2RInstance.setWhitelistLenders(approvedContract, {
      from: owner,
    });
    const whitelistLenders = await VaultW2RInstance.whitelistLenders();
    expect(whitelistLenders).to.equal(approvedContract);
  });

  it("should set and get whitelistRenters", async () => {
    await VaultW2RInstance.setWhitelistRenters(approvedContract, {
      from: owner,
    });
    const whitelistRenters = await VaultW2RInstance.whitelistRenters();
    expect(whitelistRenters).to.equal(approvedContract);
  });

  it("should set and remove approved contract", async () => {
    await VaultW2RInstance.setWhitelistLenders(approvedContract, {
      from: owner,
    });
    await VaultW2RInstance.setApprovedContract(approvedContract, true, {
      from: approvedContract,
    });

    const isApproved = await VaultW2RInstance.getApprovedContract(
      approvedContract,
      { from: owner }
    );
    expect(isApproved).to.equal(true);

    await VaultW2RInstance.removeApprovedContract(approvedContract, {
      from: approvedContract,
    });

    const isRemoved = await VaultW2RInstance.getApprovedContract(
      approvedContract,
      { from: owner }
    );
    expect(isRemoved).to.equal(false);
  });

  it("should distribute W2R tokens to receiver", async () => {
    const amount = new BN("1000000000000000000000");

    await VaultW2RInstance.setWhitelistLenders(approvedContract, {
      from: owner,
    });
    await VaultW2RInstance.setApprovedContract(approvedContract, true, {
      from: approvedContract,
    });

    await VaultW2RInstance.distributeW2R(receiver, amount, {
      from: approvedContract,
    });

    const receiverBalance = await W2RInstance.balanceOf(receiver);
    expect(receiverBalance.toString()).to.equal(amount.toString());
  });

  it("should revert when trying to distribute W2R from not approved contract", async () => {
    const amount = new BN("1000000000000000000000");

    await expectRevert(
      VaultW2RInstance.distributeW2R(receiver, amount, {
        from: notApprovedContract,
      }),
      "Caller is not an approved contract"
    );
  });

  it("should revert when trying to distribute W2R with 0 amount", async () => {
    await VaultW2RInstance.setWhitelistLenders(approvedContract, {
      from: owner,
    });
    await VaultW2RInstance.setApprovedContract(approvedContract, true, {
      from: approvedContract,
    });

    const amount = new BN("0");

    await expectRevert(
      VaultW2RInstance.distributeW2R(receiver, amount, {
        from: approvedContract,
      }),
      "Amount must be greater than 0"
    );
  });

  it("should revert when trying to distribute W2R with insufficient balance", async () => {
    await VaultW2RInstance.setWhitelistLenders(approvedContract, {
      from: owner,
    });
    await VaultW2RInstance.setApprovedContract(approvedContract, true, {
      from: approvedContract,
    });
    const amount = new BN("80000000000000000000000001");

    await expectRevert(
      VaultW2RInstance.distributeW2R(receiver, amount, {
        from: approvedContract,
      }),
      "Vault has insufficient W2R balance"
    );
  });

  it("should allow owner to withdraw W2R", async () => {
    const amount = new BN("80000000000000000000000000");
    await VaultW2RInstance.withdrawW2R(amount, { from: owner });

    const ownerBalance = await W2RInstance.balanceOf(owner);
    expect(ownerBalance.toString()).to.equal(
      new BN("160000000000000000000000000").toString()
    );
  });

  it("should revert when trying to withdraw W2R with 0 amount", async () => {
    const amount = new BN("0");
    await expectRevert(
      VaultW2RInstance.withdrawW2R(amount, { from: owner }),
      "Amount must be greater than 0"
    );
  });

  it("should revert when trying to withdraw W2R with insufficient balance", async () => {
    const amount = new BN("80000000000000000000000001");
    await expectRevert(
      VaultW2RInstance.withdrawW2R(amount, { from: owner }),
      "Vault has insufficient W2R balance"
    );
  });

  it("should emit W2RTransferred event when distributing W2R", async () => {
    await VaultW2RInstance.setWhitelistLenders(approvedContract, {
      from: owner,
    });
    await VaultW2RInstance.setApprovedContract(approvedContract, true, {
      from: approvedContract,
    });

    const amount = new BN("1000000000000000000");

    const { logs } = await VaultW2RInstance.distributeW2R(receiver, amount, {
      from: approvedContract,
    });

    expectEvent.inLogs(logs, "W2RTransferred", {
      receiver: receiver,
      amount: amount,
    });
  });

  it("should emit W2RWithdrawn event when owner withdraws W2R", async () => {
    const amount = new BN("1000000000000000000");

    const { logs } = await VaultW2RInstance.withdrawW2R(amount, {
      from: owner,
    });

    expectEvent.inLogs(logs, "W2RWithdrawn", {
      receiver: owner,
      amount: amount,
    });
  });

  it("should emit ContractApproved event when setting approved contract", async () => {
    await VaultW2RInstance.setWhitelistLenders(approvedContract, {
      from: owner,
    });

    const { logs } = await VaultW2RInstance.setApprovedContract(
      approvedContract,
      true,
      { from: approvedContract }
    );

    expectEvent.inLogs(logs, "ContractApproved", {
      contractAddress: approvedContract,
      status: true,
    });
  });

  it("should emit ContractRemoved event when removing approved contract", async () => {
    await VaultW2RInstance.setWhitelistLenders(approvedContract, {
      from: owner,
    });
    await VaultW2RInstance.setApprovedContract(approvedContract, true, {
      from: approvedContract,
    });

    const { logs } = await VaultW2RInstance.removeApprovedContract(
      approvedContract,
      { from: approvedContract }
    );

    expectEvent.inLogs(logs, "ContractRemoved", {
      contractAddress: approvedContract,
    });
  });
});
