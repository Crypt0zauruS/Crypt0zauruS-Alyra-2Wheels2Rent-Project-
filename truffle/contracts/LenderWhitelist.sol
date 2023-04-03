// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

// import ERC20.sol
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./BikeShare.sol";

interface IVaultW2R {
    function setApprovedContract(address contractAddress, bool status) external;

    function removeApprovedContract(
        address contractAddress
    ) external returns (bool);
}

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

    // constructor with the address of the TwoWheels2RentLender contract and the W2R token contract
    constructor(
        address _TW2RL,
        address _W2R,
        address _TW2RRenterNFT,
        IVaultW2R _vaultW2R
    ) {
        require(_TW2RL != address(0));
        require(_W2R != address(0));
        require(_TW2RRenterNFT != address(0));
        require(address(_vaultW2R) != address(0));
        vaultW2R = _vaultW2R;
        // set the address of the TwoWheels2RentLender contract
        TW2RL = I1TwoWheels2RentLender(_TW2RL);
        // set the address of the W2R token contract
        W2R = ERC20(_W2R);
        // set the address of the lender NFT contract
        TW2RRenterNFT = _TW2RRenterNFT;
    }

    // set RenterWhitelist contract address
    function setRenterWhitelistAddress(
        address _renterWhitelist
    ) external onlyOwner {
        require(_renterWhitelist != address(0));
        // set the address of the TwoWheels2RentrenterWhitelist contract
        renterWhitelist = _renterWhitelist;
    }

    // add to whitelist, set BikeInfo struct and call mintNFT
    function setBikeInfoAndMint(
        string memory name,
        string memory brand,
        string memory model,
        string memory serial,
        string memory registration
    ) external {
        require(!blacklistedAddresses[msg.sender], "blacklisted");
        require(
            !whitelistedAddresses[msg.sender].isWhitelisted,
            "Already whitelisted"
        );
        require(
            whitelistedAddresses[msg.sender].bikeShareContract == address(0),
            "Already deployed"
        );
        require(whitelistedAddresses[msg.sender].NFTId == 0, "Already minted");
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
        require(TW2RL.getIpfsHashLength(), "IPFS not set");
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

    function deployBikeShareContract() private {
        require(!blacklistedAddresses[msg.sender], "blacklisted");
        require(
            whitelistedAddresses[msg.sender].isWhitelisted,
            "Not whitelisted"
        );
        require(
            whitelistedAddresses[msg.sender].bikeShareContract == address(0),
            "Already deployed"
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

    function removeAddressFromWhitelist() external {
        require(!blacklistedAddresses[msg.sender], "blacklisted");
        // msg.sender is the address of the caller of this function
        require(
            whitelistedAddresses[msg.sender].isWhitelisted,
            "Not whitelisted"
        );
        doRemoveStuff(msg.sender);
        // emit event
        emit LenderRemovedFromWhitelist(
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
            emit LenderBlacklisted(
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
        emit LenderRemovedFromBlacklist(_address);
    }

    function doRemoveStuff(address _address) private returns (bool) {
        // burn NFT
        require(
            TW2RL.burnNFT(whitelistedAddresses[_address].NFTId),
            "Can't burn NFT"
        );
        // destroy bikeShare contract
        bikeShare = BikeShare(whitelistedAddresses[_address].bikeShareContract);
        require(
            vaultW2R.removeApprovedContract(address(bikeShare)),
            "Error removing"
        );
        require(bikeShare.destroy(), "Can't destroy");
        // remove address from whitelist
        delete whitelistedAddresses[_address];
        numAddressesWhitelisted--;
        return true;
    }

    function renounceOwnership() public view override onlyOwner {
        revert("cannot be renounced");
    }
}
