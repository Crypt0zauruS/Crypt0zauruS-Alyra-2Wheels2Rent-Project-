// SPDX-License-Identifier: CC-BY-4.0
pragma solidity ^0.8.17;

//import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
//import "@openzeppelin/contracts/access/Ownable.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";
import "./BikeRent.sol";

/**
 * @title I2VaultW2R
 * @dev Interface for interacting with the VaultW2R contract.
 */
interface I2VaultW2R {
    function setApprovedContract(address contractAddress, bool status) external;

    function removeApprovedContract(
        address contractAddress
    ) external returns (bool);
}

/**
 * @title I1TwoWheels2RentRenter
 * @dev Interface for interacting with the TwoWheels2RentRenter contract.
 */

interface I1TwoWheels2RentRenter {
    struct RenterInfo {
        string name;
        string rather;
    }

    function getIpfsHashLength() external view returns (bool);

    function mintNFT(
        address recipient,
        RenterInfo calldata renterInfo
    ) external returns (uint);

    function burnNFT(uint tokenId) external returns (bool);
}

/**
 * @title RenterWhitelist
 * @dev This contract manages a whitelist of renters and their associated BikeRent contracts.
 * It allows renters to be added to the whitelist and to deploy BikeRent contracts.
 * The contract owner can add and remove renters from the blacklist.
 */

contract RenterWhitelist is Ownable {
    // keep track of the number of whitelisted addresses
    uint8 public numAddressesWhitelisted;
    // address of the lender NFT contract
    address TW2RLenderNFT;
    // address of the lender whitelist contract
    address lenderWhitelist;
    // import W2R token contract
    ERC20 public W2R;
    // import VaultW2R interface
    I2VaultW2R private vaultW2R;

    event RenterWhitelisted(address indexed renter, uint NFTId);
    event RenterBlacklisted(address indexed renter, uint NFTId);
    event RenterRemovedFromBlacklist(address indexed renter);
    event RenterRemovedFromWhitelist(address indexed renter, uint NFTId);

    // struct of whitelisted addresses
    struct Renter {
        bool isWhitelisted;
        address bikeRentContract;
        uint NFTId;
    }

    // mapping of whitelisted addresses, starting false for all addresses
    mapping(address => Renter) public whitelistedAddresses;
    // blacklist mapping
    mapping(address => bool) public blacklistedAddresses;

    I1TwoWheels2RentRenter TW2RR;

    BikeRent bikeRent;

    /**
     * @notice Constructor to set the required addresses for the contract.
     * @param _TW2RR Address of the TwoWheels2RentRenter contract.
     * @param _W2R Address of the W2R token contract.
     * @param _TW2RLenderNFT Address of the Lender NFT contract.
     * @param _vaultW2R Address of the VaultW2R contract.
     */

    constructor(
        address _TW2RR,
        address _W2R,
        address _TW2RLenderNFT,
        I2VaultW2R _vaultW2R
    ) {
        require(
            _TW2RR != address(0) &&
                _W2R != address(0) &&
                _TW2RLenderNFT != address(0) &&
                address(_vaultW2R) != address(0),
            "bad address"
        );
        vaultW2R = _vaultW2R;
        // set the address of the TwoWheels2RentRenter contract
        TW2RR = I1TwoWheels2RentRenter(_TW2RR);
        // set the address of the W2R token contract
        W2R = ERC20(_W2R);
        // set the address of the lender NFT contract
        TW2RLenderNFT = _TW2RLenderNFT;
    }

    /**
     * @notice Set the LenderWhitelist contract address.
     * @param _lenderWhitelist Address of the LenderWhitelist contract.
     */
    function setLenderWhitelistAddress(
        address _lenderWhitelist
    ) external onlyOwner {
        require(_lenderWhitelist != address(0));
        // set the address of the TwoWheels2RentLenderWhitelist contract
        lenderWhitelist = _lenderWhitelist;
    }

    /**
     * @notice Add a renter to the whitelist, set Renter struct and call mintNFT.
     * @param name Renter's name.
     * @param rather Renter's rather.
     */
    function setRenterInfoAndMint(
        string memory name,
        string memory rather
    ) public {
        require(!blacklistedAddresses[msg.sender], "bl");
        require(!whitelistedAddresses[msg.sender].isWhitelisted, "wl");
        require(
            whitelistedAddresses[msg.sender].bikeRentContract == address(0),
            "deployed"
        );
        require(whitelistedAddresses[msg.sender].NFTId == 0, "minted");
        require(bytes(name).length > 0 && bytes(rather).length > 0, "empty");
        require(
            bytes(name).length <= 40 && bytes(rather).length <= 40,
            "too long"
        );
        // check if the image is set
        require(TW2RR.getIpfsHashLength(), "no IPFS");
        // set the RenterInfo struct
        I1TwoWheels2RentRenter.RenterInfo
            memory renterInfo = I1TwoWheels2RentRenter.RenterInfo(name, rather);
        // add the address to the whitelist
        whitelistedAddresses[msg.sender].isWhitelisted = true;
        numAddressesWhitelisted++;
        // mint and add the NFT id to the mapping
        whitelistedAddresses[msg.sender].NFTId = TW2RR.mintNFT(
            msg.sender,
            renterInfo
        );
        // deploy bikeRent contract
        deployBikeRentContract();
        emit RenterWhitelisted(
            msg.sender,
            whitelistedAddresses[msg.sender].NFTId
        );
    }

    /**
     * @dev Deploy a BikeRent contract for the renter.
     */

    function deployBikeRentContract() private {
        require(!blacklistedAddresses[msg.sender], "bl");
        require(whitelistedAddresses[msg.sender].isWhitelisted, "not wl");
        require(
            whitelistedAddresses[msg.sender].bikeRentContract == address(0),
            "deployed"
        );
        require(whitelistedAddresses[msg.sender].NFTId != 0, "not minted");
        require(lenderWhitelist != address(0));
        // deploy bikeRent contract
        bikeRent = new BikeRent(
            // the address of the caller of this function
            msg.sender,
            // the address of the W2R token contract
            address(W2R),
            // the address of the Lender NFT contract
            TW2RLenderNFT,
            // address of this contract
            address(this),
            // address of vaultW2R
            address(vaultW2R),
            // address of lenderWhitelist
            lenderWhitelist
        );
        // add the bikeRent contract address to the mapping
        whitelistedAddresses[msg.sender].bikeRentContract = address(bikeRent);
        // authorize the bikeShare contract to spend vault W2R tokens
        vaultW2R.setApprovedContract(address(bikeRent), true);
    }

    /**
     * @notice Remove a renter from the whitelist.
     */

    function removeAddressFromWhitelist() external {
        require(!blacklistedAddresses[msg.sender], "bl");
        // msg.sender is the address of the caller of this function
        require(whitelistedAddresses[msg.sender].isWhitelisted, "not wl");
        doRemoveStuff(msg.sender);
        // emit event
        emit RenterRemovedFromWhitelist(
            msg.sender,
            whitelistedAddresses[msg.sender].NFTId
        );
    }

    /**
     * @notice Add an address to the blacklist.
     * @param _address Address to be blacklisted.
     */

    function addToBlacklist(address _address) external onlyOwner {
        require(!blacklistedAddresses[_address], "bl");
        // if address was whitelisted
        if (whitelistedAddresses[_address].isWhitelisted) {
            require(doRemoveStuff(_address), "error");
            // add address to blacklist
            blacklistedAddresses[_address] = true;
            // emit event
            emit RenterRemovedFromWhitelist(
                _address,
                whitelistedAddresses[_address].NFTId
            );
        }
    }

    /**
     * @notice Remove an address from the blacklist.
     * @param _address Address to be removed from the blacklist.
     */

    function removeFromBlacklist(address _address) external onlyOwner {
        require(blacklistedAddresses[_address], "not bl");
        // remove address from blacklist
        delete blacklistedAddresses[_address];
        // emit event
        emit RenterRemovedFromBlacklist(_address);
    }

    /**
     * @dev Perform necessary actions to remove a renter from the whitelist.
     * @param _address Address of the renter to be removed.
     * @return true if successful, false otherwise.
     */

    function doRemoveStuff(address _address) private returns (bool) {
        // burn NFT
        require(
            TW2RR.burnNFT(whitelistedAddresses[_address].NFTId),
            "burn error"
        );
        // destroy bikeRent contract
        bikeRent = BikeRent(whitelistedAddresses[_address].bikeRentContract);
        require(bikeRent.destroy(), "error destroy");
        require(
            vaultW2R.removeApprovedContract(address(bikeRent)),
            "Error removing"
        );
        // remove address from whitelist
        delete whitelistedAddresses[_address];
        numAddressesWhitelisted--;
        return true;
    }

    /**
     * @notice Prevent renouncing ownership of this contract.
     */

    function renounceOwnership() public view override onlyOwner {
        revert("Cant be renounced");
    }
}
