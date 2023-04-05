const W2R = artifacts.require("W2R");
const initialSupply = 160000000;
const VaultW2R = artifacts.require("VaultW2R");
const MaticW2RPairToken = artifacts.require("MaticW2RPairToken");
const MaticW2Rdex = artifacts.require("MaticW2Rdex");
const initialSwapRate = 10;
const TwoWheels2RentLender = artifacts.require("TwoWheels2RentLender");
const TwoWheels2RentRenter = artifacts.require("TwoWheels2RentRenter");
const LenderWhitelist = artifacts.require("LenderWhitelist");
const RenterWhitelist = artifacts.require("RenterWhitelist");
const lenderIPFS =
  "bafybeif7bo3qj2ltdqiooyiqzl4wzxzqf5saxyfdoc6n3k7pnkydmm3kd4";
const renterIPFS =
  "bafybeihc4a3whkac7bg3eyaagki3j3emhshtzjymtieltp33ybkmkxqzfq";

module.exports = async (deployer, network, accounts) => {
  try {
    // Deploy W2R
    await deployer.deploy(W2R, initialSupply);
    const W2RInstance = await W2R.deployed();
    console.log("W2R address: ", W2RInstance.address);

    // Deploy VaultW2R
    await deployer.deploy(VaultW2R, W2RInstance.address);
    const VaultW2RInstance = await VaultW2R.deployed();
    console.log("VaultW2R address: ", VaultW2RInstance.address);

    // Transfer 1,000,000 W2R tokens to the Vault
    const transferAmount = web3.utils.toWei("1000000", "ether");
    const deployerAccount = accounts[0]; // pas nécessaire car account[0] par défaut mais pour la lisibilité
    await W2RInstance.transfer(VaultW2RInstance.address, transferAmount, {
      from: deployerAccount,
    });
    console.log("1,000,000 W2R tokens transferred to VaultW2R");
    const vaultBalance = await W2RInstance.balanceOf(VaultW2RInstance.address);
    console.log(
      "VaultW2R balance: ",
      web3.utils.fromWei(vaultBalance, "ether")
    );

    // deploy LP token
    await deployer.deploy(MaticW2RPairToken);
    const MaticW2RPairTokenInstance = await MaticW2RPairToken.deployed();
    console.log(
      "MaticW2RPairToken address: ",
      MaticW2RPairTokenInstance.address
    );

    // Deploy MaticW2Rdex
    await deployer.deploy(
      MaticW2Rdex,
      W2RInstance.address,
      initialSwapRate,
      VaultW2RInstance.address,
      MaticW2RPairTokenInstance.address
    );
    const MaticW2RdexInstance = await MaticW2Rdex.deployed();

    // add DEX as authorized Minter and Burner in LP token
    await MaticW2RPairTokenInstance.addMinterAndBurner(
      MaticW2RdexInstance.address
    );
    console.log(
      "MaticW2Rdex address set as authorized Minter and Burner in LP token"
    );

    // add DEX address to VaultW2R approved addresses
    await VaultW2RInstance.setApprovedContract(
      MaticW2RdexInstance.address,
      true
    );
    console.log("DEX address set in VaultW2R contract");

    // Deploy TwoWheels2RentLender NFT contract
    await deployer.deploy(TwoWheels2RentLender);
    const TwoWheels2RentLenderInstance = await TwoWheels2RentLender.deployed();
    console.log(
      "TwoWheels2RentLender address: ",
      TwoWheels2RentLenderInstance.address
    );

    // Deploy TwoWheels2RentRenter NFT contract
    await deployer.deploy(TwoWheels2RentRenter);
    const TwoWheels2RentRenterInstance = await TwoWheels2RentRenter.deployed();
    console.log(
      "TwoWheels2RentRenter address: ",
      TwoWheels2RentRenterInstance.address
    );

    // Deploy LenderWhitelist contract
    await deployer.deploy(
      LenderWhitelist,
      TwoWheels2RentLenderInstance.address,
      W2RInstance.address,
      TwoWheels2RentRenterInstance.address,
      VaultW2RInstance.address
    );

    // Deploy RenterWhitelist contract
    await deployer.deploy(
      RenterWhitelist,
      TwoWheels2RentRenterInstance.address,
      W2RInstance.address,
      TwoWheels2RentLenderInstance.address,
      VaultW2RInstance.address
    );
    const LenderWhitelistInstance = await LenderWhitelist.deployed();
    console.log("LenderWhitelist address: ", LenderWhitelistInstance.address);
    const RenterWhitelistInstance = await RenterWhitelist.deployed();
    console.log("RenterWhitelist address: ", RenterWhitelistInstance.address);

    // Set addresses of each other in contracts
    await LenderWhitelistInstance.setRenterWhitelistAddress(
      RenterWhitelistInstance.address
    );
    console.log("RenterWhitelist address set in LenderWhitelist contract");
    await RenterWhitelistInstance.setLenderWhitelistAddress(
      LenderWhitelistInstance.address
    );
    console.log("LenderWhitelist address set in RenterWhitelist contract");

    // Set whitelist contract addresses  in NFT contracts
    await TwoWheels2RentLenderInstance.setLenderWhitelistContract(
      LenderWhitelistInstance.address
    );
    console.log(
      "LenderWhitelist address set in TwoWheels2RentLender NFT contract"
    );

    // Set IPFS hash in NFT contracts
    await TwoWheels2RentLenderInstance.setIpfsHash(lenderIPFS);
    console.log("IPFS hash set in TwoWheels2RentLender NFT contract");
    await TwoWheels2RentRenterInstance.setRenterWhitelistContract(
      RenterWhitelistInstance.address
    );
    console.log(
      "RenterWhitelist address set in TwoWheels2RentRenter NFT contract"
    );
    await TwoWheels2RentRenterInstance.setIpfsHash(renterIPFS);
    console.log("IPFS hash set in TwoWheels2RentRenter NFT contract");

    // set whitelist contracts addresses in VaultW2R as approvers
    await VaultW2RInstance.setWhitelistLenders(LenderWhitelistInstance.address);
    console.log("LenderWhitelist address set in VaultW2R contract");
    await VaultW2RInstance.setWhitelistRenters(RenterWhitelistInstance.address);
    console.log("RenterWhitelist address set in VaultW2R contract");

    /////////////////////////////////////////////////////////////////////////////////

    // if Ganache, add liquidity to the DEX
    if (network === "development") {
      // Transfer 1,000 W2R tokens to the DEX
      const transferMatic = web3.utils.toWei("100", "ether");
      const transferW2R = web3.utils.toWei("1000", "ether");
      // account[0] approve W2R transfer to DEX
      await W2RInstance.approve(MaticW2RdexInstance.address, transferW2R, {
        from: deployerAccount,
      });
      // account[0] launch addLiquidity function
      await MaticW2RdexInstance.addLiquidity(transferW2R, {
        from: deployerAccount,
        value: transferMatic,
      });
      console.log("1,000 W2R tokens and 100 MATIC transferred to MaticW2Rdex");
      // LP token Total supply
      const LPtokenTotalSupply = await MaticW2RPairTokenInstance.totalSupply();
      console.log(
        "LP token total supply: ",
        web3.utils.fromWei(LPtokenTotalSupply, "ether")
      );
      const dexW2RBalance = await W2RInstance.balanceOf(
        MaticW2RdexInstance.address
      );
      console.log(
        "MaticW2Rdex balance: ",
        web3.utils.fromWei(dexW2RBalance, "ether")
      );
      const dexMaticBalance = await web3.eth.getBalance(
        MaticW2RdexInstance.address
      );
      console.log(
        "MaticW2Rdex balance: ",
        web3.utils.fromWei(dexMaticBalance, "ether")
      );
      const deployerLPBalance = await MaticW2RPairTokenInstance.balanceOf(
        deployerAccount
      );
      console.log(
        "deployer LP balance: ",
        web3.utils.fromWei(deployerLPBalance, "ether")
      );
      // transfer 100000 W2R from account[0] to account[1]
      const transferAmount2 = web3.utils.toWei("100000", "ether");
      await W2RInstance.transfer(accounts[1], transferAmount2, {
        from: deployerAccount,
      });
      console.log("100000 W2R tokens transferred to account[1]");

      // transfer 100000 W2R from account[0] to account[2]
      await W2RInstance.transfer(accounts[2], transferAmount2, {
        from: deployerAccount,
      });
      console.log("100000 W2R tokens transferred to account[2]");
    }
  } catch (error) {
    console.log(error);
  }
};
// todo:
// deploy staking contract
// add staking contract to approved contracts in VaultW2R
