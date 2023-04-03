// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

// import ERC20.sol
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./BikeRent.sol";

interface I2VaultW2R {
    function setApprovedContract(address contractAddress, bool status) external;

    function removeApprovedContract(
        address contractAddress
    ) external returns (bool);
}

interface I1TwoWheels2RentRenter {
    struct RenterInfo {
        string name;
        string rather;
    }

    // import string ipfsHash length from TwoWheels2RentRenter.sol
    function getIpfsHashLength() external view returns (bool);

    function mintNFT(
        address recipient,
        RenterInfo calldata renterInfo
    ) external returns (uint);

    function burnNFT(uint tokenId) external returns (bool);
}

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

    // constructor with the address of the TwoWheels2RentLender contract and the W2R token contract
    constructor(
        address _TW2RR,
        address _W2R,
        address _TW2RLenderNFT,
        I2VaultW2R _vaultW2R
    ) {
        require(_TW2RR != address(0));
        require(_W2R != address(0));
        require(_TW2RLenderNFT != address(0));
        require(address(_vaultW2R) != address(0));
        vaultW2R = _vaultW2R;
        // set the address of the TwoWheels2RentRenter contract
        TW2RR = I1TwoWheels2RentRenter(_TW2RR);
        // set the address of the W2R token contract
        W2R = ERC20(_W2R);
        // set the address of the lender NFT contract
        TW2RLenderNFT = _TW2RLenderNFT;
    }

    // set LenderWhitelist contract address
    function setLenderWhitelistAddress(
        address _lenderWhitelist
    ) external onlyOwner {
        require(_lenderWhitelist != address(0));
        // set the address of the TwoWheels2RentLenderWhitelist contract
        lenderWhitelist = _lenderWhitelist;
    }

    // add to whitelist, set Renter struct and call mintNFT
    function setRenterInfoAndMint(
        string memory name,
        string memory rather
    ) public {
        require(!blacklistedAddresses[msg.sender], "blacklisted");
        require(!whitelistedAddresses[msg.sender].isWhitelisted, "whitelisted");
        require(
            whitelistedAddresses[msg.sender].bikeRentContract == address(0),
            "deployed"
        );
        require(whitelistedAddresses[msg.sender].NFTId == 0, "minted");
        require(
            bytes(name).length > 0 && bytes(rather).length > 0,
            "Empty fields"
        );
        require(
            bytes(name).length <= 40 && bytes(rather).length <= 40,
            "Too long"
        );
        // check if the image is set
        require(TW2RR.getIpfsHashLength(), "IPFS not set");
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

    function deployBikeRentContract() private {
        require(!blacklistedAddresses[msg.sender], "blacklisted");
        require(
            whitelistedAddresses[msg.sender].isWhitelisted,
            "Not whitelisted"
        );
        require(
            whitelistedAddresses[msg.sender].bikeRentContract == address(0),
            "deployed"
        );
        require(whitelistedAddresses[msg.sender].NFTId != 0, "Not minted");
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

    function removeAddressFromWhitelist() external {
        require(!blacklistedAddresses[msg.sender], "blacklisted");
        // msg.sender is the address of the caller of this function
        require(
            whitelistedAddresses[msg.sender].isWhitelisted,
            "Not whitelisted"
        );
        doRemoveStuff(msg.sender);
        // emit event
        emit RenterRemovedFromWhitelist(
            msg.sender,
            whitelistedAddresses[msg.sender].NFTId
        );
    }

    function addToBlacklist(address _address) external onlyOwner {
        require(!blacklistedAddresses[_address], "blacklisted");
        // if address was whitelisted
        if (whitelistedAddresses[_address].isWhitelisted) {
            require(doRemoveStuff(_address), "Error");
            // add address to blacklist
            blacklistedAddresses[_address] = true;
            // emit event
            emit RenterRemovedFromWhitelist(
                _address,
                whitelistedAddresses[_address].NFTId
            );
        }
    }

    function removeFromBlacklist(address _address) external onlyOwner {
        require(blacklistedAddresses[_address], "Not blacklisted");
        // remove address from blacklist
        delete blacklistedAddresses[_address];
        // emit event
        emit RenterRemovedFromBlacklist(_address);
    }

    function doRemoveStuff(address _address) private returns (bool) {
        // burn NFT
        require(
            TW2RR.burnNFT(whitelistedAddresses[_address].NFTId),
            "Error burning NFT"
        );
        // destroy bikeRent contract
        bikeRent = BikeRent(whitelistedAddresses[_address].bikeRentContract);
        require(
            vaultW2R.removeApprovedContract(address(bikeRent)),
            "Error removing"
        );
        require(bikeRent.destroy(), "Error destroying");
        // remove address from whitelist
        delete whitelistedAddresses[_address];
        numAddressesWhitelisted--;
        return true;
    }

    function renounceOwnership() public view override onlyOwner {
        revert("Cannot be renounced");
    }
}