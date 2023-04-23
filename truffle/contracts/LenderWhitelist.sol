// SPDX-License-Identifier: CC-BY-4.0
pragma solidity ^0.8.17;

//import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
//import "@openzeppelin/contracts/access/Ownable.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";
import "./BikeShare.sol";

/**
@dev This interface is used to interact with the Vault contract.
 */

interface IVaultW2R {
    function setApprovedContract(address contractAddress, bool status) external;

    function removeApprovedContract(
        address contractAddress
    ) external returns (bool);
}

/**
@dev This interface is used to interact with the TwoWheels2RentLender contract.
 */

interface I1TwoWheels2RentLender {
    struct BikeInfo {
        string name;
        string brand;
        string model;
        string serial;
        string registration;
    }

    // import string ipfsHash length from TwoWheels2RentLender.sol
    function getIpfsHashLength() external view returns (bool);

    function mintNFT(
        address recipient,
        BikeInfo calldata bikeInfo
    ) external returns (uint);

    function burnNFT(uint tokenId) external returns (bool);
}

/**

@title LenderWhitelist
@notice LenderWhitelist is a contract for managing a whitelist of approved lenders for the TwoWheels2Rent platform. 
It allows lenders to register their bikes, mint NFTs representing their bikes, and deploy BikeShare contracts.
@dev This contract is responsible for maintaining the whitelist of lenders, handling the creation of BikeShare contracts, 
and interacting with the TwoWheels2RentLender, W2R token, and RenterWhitelist contracts. 
It also manages the lender blacklist.
*/

contract LenderWhitelist is Ownable {
    // keep track of the number of whitelisted addresses
    uint8 public numAddressesWhitelisted;

    // address of the renter NFT contract
    address TW2RRenterNFT;

    // address of the renter whitelist contract
    address renterWhitelist;

    // import W2R token contract
    ERC20 public W2R;

    // import VaultW2R interface
    IVaultW2R private vaultW2R;

    // struct of whitelisted addresses
    struct Lender {
        bool isWhitelisted;
        address bikeShareContract;
        uint NFTId;
    }

    // mapping of whitelisted addresses, starting false for all addresses
    mapping(address => Lender) public whitelistedAddresses;
    // blacklist mapping
    mapping(address => bool) public blacklistedAddresses;

    I1TwoWheels2RentLender TW2RL;

    BikeShare bikeShare;

    event LenderWhitelisted(address indexed lender, uint NFTId);
    event LenderBlacklisted(address indexed lender, uint NFTId);
    event LenderRemovedFromBlacklist(address indexed lender);
    event LenderRemovedFromWhitelist(address indexed lender, uint NFTId);

    /**
     * @notice Constructor that initializes the contract with the TwoWheels2RentLender, W2R token, Renter NFT contract, and VaultW2R contract addresses.
     * @param _TW2RL The address of the TwoWheels2RentLender contract.
     * @param _W2R The address of the W2R token contract.
     * @param _TW2RRenterNFT The address of the Renter NFT contract.
     * @param _vaultW2R The address of the VaultW2R contract.
     */
    constructor(
        address _TW2RL,
        address _W2R,
        address _TW2RRenterNFT,
        IVaultW2R _vaultW2R
    ) {
        require(
            _TW2RL != address(0) &&
                _W2R != address(0) &&
                _TW2RRenterNFT != address(0) &&
                address(_vaultW2R) != address(0),
            "bad address"
        );
        vaultW2R = _vaultW2R;
        // set the address of the TwoWheels2RentLender contract
        TW2RL = I1TwoWheels2RentLender(_TW2RL);
        // set the address of the W2R token contract
        W2R = ERC20(_W2R);
        // set the address of the lender NFT contract
        TW2RRenterNFT = _TW2RRenterNFT;
    }

    /**
     * @notice Sets the RenterWhitelist contract address.
     * @param _renterWhitelist The address of the RenterWhitelist contract.
     */
    function setRenterWhitelistAddress(
        address _renterWhitelist
    ) external onlyOwner {
        require(_renterWhitelist != address(0));
        // set the address of the TwoWheels2RentrenterWhitelist contract
        renterWhitelist = _renterWhitelist;
    }

    /**
    @notice Whitelists a lender, sets bike information, and mints a new NFT representing the bike.
    @param name The name of the bike.
    @param brand The brand of the bike.
    @param model The model of the bike.
    @param serial The serial number of the bike.
    @param registration The registration number of the bike.
    */
    function setBikeInfoAndMint(
        string memory name,
        string memory brand,
        string memory model,
        string memory serial,
        string memory registration
    ) external {
        require(!blacklistedAddresses[msg.sender], "bl");
        require(!whitelistedAddresses[msg.sender].isWhitelisted, "wl");
        require(
            whitelistedAddresses[msg.sender].bikeShareContract == address(0),
            "deployed"
        );
        require(whitelistedAddresses[msg.sender].NFTId == 0, "minted");
        require(
            bytes(name).length > 0 &&
                bytes(brand).length > 0 &&
                bytes(model).length > 0 &&
                bytes(serial).length > 0 &&
                bytes(registration).length > 0,
            "Empty fields"
        );
        require(
            bytes(name).length <= 40 &&
                bytes(brand).length <= 40 &&
                bytes(model).length <= 40 &&
                bytes(serial).length <= 40 &&
                bytes(registration).length <= 40,
            "Too long"
        );
        // check if the image is set
        require(TW2RL.getIpfsHashLength(), "no IPFS");
        // set the BikeInfo struct
        I1TwoWheels2RentLender.BikeInfo memory bikeInfo = I1TwoWheels2RentLender
            .BikeInfo(name, brand, model, serial, registration);
        // add the address to the whitelist
        whitelistedAddresses[msg.sender].isWhitelisted = true;
        numAddressesWhitelisted++;
        // mint and add the NFT id to the mapping
        whitelistedAddresses[msg.sender].NFTId = TW2RL.mintNFT(
            msg.sender,
            bikeInfo
        );
        // deploy bikeShare contract
        deployBikeShareContract();
        // emit event
        emit LenderWhitelisted(
            msg.sender,
            whitelistedAddresses[msg.sender].NFTId
        );
    }

    /**
    @notice Deploys a new BikeShare contract for the lender.
    */

    function deployBikeShareContract() private {
        require(!blacklistedAddresses[msg.sender], "bl");
        require(whitelistedAddresses[msg.sender].isWhitelisted, "Not wl");
        require(
            whitelistedAddresses[msg.sender].bikeShareContract == address(0),
            "deployed"
        );
        require(whitelistedAddresses[msg.sender].NFTId != 0, "Not minted");
        require(renterWhitelist != address(0), "not set");
        bikeShare = new BikeShare(
            // the address of the caller of this function
            msg.sender,
            // the address of the W2R token contract
            address(W2R),
            // the address of the Renter NFT contract
            TW2RRenterNFT,
            // address of this contract
            address(this),
            // address of vaultW2R
            address(vaultW2R),
            // address of renterWhitelist
            renterWhitelist
        );
        // add the bikeShare contract address to the mapping
        whitelistedAddresses[msg.sender].bikeShareContract = address(bikeShare);
        // authorize the bikeShare contract to spend vault W2R tokens
        vaultW2R.setApprovedContract(address(bikeShare), true);
    }

    /**
    @notice Removes a lender from the whitelist, burns their NFT, and destroys their BikeShare contract.
    */

    function removeAddressFromWhitelist() external {
        require(!blacklistedAddresses[msg.sender], "bl");
        // msg.sender is the address of the caller of this function
        require(whitelistedAddresses[msg.sender].isWhitelisted, "Not wl");
        doRemoveStuff(msg.sender);
        // emit event
        emit LenderRemovedFromWhitelist(
            msg.sender,
            whitelistedAddresses[msg.sender].NFTId
        );
    }

    /**
    @notice Adds a lender's address to the blacklist.
    @param _address The address of the lender to be blacklisted.
    */

    function addToBlacklist(address _address) external onlyOwner {
        require(!blacklistedAddresses[_address], "bl");
        // if address was whitelisted
        if (whitelistedAddresses[_address].isWhitelisted) {
            require(doRemoveStuff(_address), "Error");
            // add address to blacklist
            blacklistedAddresses[_address] = true;
            // emit event
            emit LenderBlacklisted(
                _address,
                whitelistedAddresses[_address].NFTId
            );
        }
    }

    /**
    @notice Removes a lender's address from the blacklist.
    @param _address The address of the lender to be removed from the blacklist.
    */

    function removeFromBlacklist(address _address) external onlyOwner {
        require(blacklistedAddresses[_address], "Not bl");
        // remove address from blacklist
        delete blacklistedAddresses[_address];
        // emit event
        emit LenderRemovedFromBlacklist(_address);
    }

    /**
    @notice Helper function that handles the removal of a lender from the whitelist and performs necessary actions like burning their NFT and destroying their BikeShare contract.
    @param _address The address of the lender to be removed.
    @return true if the operation is successful, false otherwise.
    */

    function doRemoveStuff(address _address) private returns (bool) {
        // burn NFT
        require(
            TW2RL.burnNFT(whitelistedAddresses[_address].NFTId),
            "Can't burn NFT"
        );
        // destroy bikeShare contract
        bikeShare = BikeShare(whitelistedAddresses[_address].bikeShareContract);
        require(bikeShare.destroy(), "Can't destroy");
        require(
            vaultW2R.removeApprovedContract(address(bikeShare)),
            "Error removing"
        );
        // remove address from whitelist
        delete whitelistedAddresses[_address];
        numAddressesWhitelisted--;
        return true;
    }

    /**
    @notice Disallows renouncing ownership of the contract.
    */

    function renounceOwnership() public view override onlyOwner {
        revert("cannot be renounced");
    }
}
