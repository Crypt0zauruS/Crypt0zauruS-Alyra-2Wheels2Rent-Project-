// SPDX-License-Identifier: CC-BY-4.0
pragma solidity ^0.8.9;

//import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
//import "@openzeppelin/contracts/access/Ownable.sol";
//import "@openzeppelin/contracts/utils/Counters.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";
import "../node_modules/@openzeppelin/contracts/utils/Counters.sol";
import "./Base64.sol";

/**
 * @title TwoWheels2RentRenter
 * @author Crypt0zaurus https://www.linkedin.com/in/maxence-a-a82081260
 * @notice This contract is used for creating and managing 2Wheels2Rent Renter NFTs
 * @dev This contract inherits from ERC721URIStorage, Ownable, and uses the Counters library
 */

contract TwoWheels2RentRenter is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    address public whitelistContract;
    string ipfsHash;

    /**
     * @dev Struct to store renter information
     */
    struct RenterInfo {
        string name;
        string rather;
    }

    event MintedNFTWithURI(address recipient, uint256 tokenId, string uri);
    event BurnedNFT(uint256 tokenId);

    /**
     * @dev Constructor that sets the name and symbol of the ERC721 token.
     */

    constructor() ERC721("2Wheels2RentRenter", "W2RNFTT") {}

    /**
     * @notice Check if the IPFS hash has been set.
     * @dev Only callable by the whitelist contract.
     * @return Returns true if the IPFS hash has been set.
     */

    function getIpfsHashLength() external view returns (bool) {
        require(msg.sender == whitelistContract, "Only the whitelist contract");
        return bytes(ipfsHash).length > 0;
    }

    /**
     * @notice Set the address of the whitelist contract.
     * @dev Only callable by the owner of the contract.
     * @param _whitelistContract The address of the new whitelist contract.
     * @return Returns true if the whitelist contract address has been set successfully.
     */

    function setRenterWhitelistContract(
        address _whitelistContract
    ) external onlyOwner returns (bool) {
        require(_whitelistContract != address(0), "Zero address not allowed");
        whitelistContract = _whitelistContract;
        return true;
    }

    /**
     * @notice Set the IPFS hash for the NFT metadata.
     * @dev Only callable by the owner of the contract.
     * @param _ipfsHash The IPFS hash to set.
     * @return Returns true if the IPFS hash has been set successfully.
     */

    function setIpfsHash(
        string memory _ipfsHash
    ) external onlyOwner returns (bool) {
        require(bytes(_ipfsHash).length > 0, "IPFS hash not set");
        ipfsHash = _ipfsHash;
        return true;
    }

    /**
     * @notice Mint a new NFT for the provided BikeInfo.
     * @dev Only callable by the whitelist contract.
     * @param recipient The address that will receive the minted NFT.
     * @param renterInfo The information about the bike represented by the NFT.
     * @return Returns the token ID of the newly minted NFT.
     */

    function mintNFT(
        address recipient,
        RenterInfo calldata renterInfo
    ) external returns (uint) {
        require(whitelistContract != address(0));
        require(recipient != address(0));
        require(bytes(ipfsHash).length > 0, "IPFS hash not set");
        require(msg.sender == whitelistContract, "Only the whitelist contract");
        // checking no strings are empty
        require(
            bytes(renterInfo.name).length > 0 &&
                bytes(renterInfo.rather).length > 0,
            "Empty fields"
        );
        // checking strings don't exceed 40 characters
        require(
            bytes(renterInfo.name).length <= 40 &&
                bytes(renterInfo.rather).length <= 40,
            "Too long"
        );
        _tokenIds.increment();

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "',
                        renterInfo.name,
                        '", "description": "2Wheels2Rent Renter NFT", "attributes": [{"trait_type": "rather", "value": "',
                        renterInfo.rather,
                        '"}], "image": "ipfs://',
                        ipfsHash,
                        '"}'
                    )
                )
            )
        );

        string memory finalTokenUri = string(
            abi.encodePacked("data:application/json;base64,", json)
        );

        uint newItemId = _tokenIds.current();
        _safeMint(recipient, newItemId);
        _setTokenURI(newItemId, finalTokenUri);
        emit MintedNFTWithURI(recipient, newItemId, finalTokenUri);
        return newItemId;
    }

    /**
     * @notice Burn an NFT with the specified token ID.
     * @dev Only callable by the whitelist contract.
     * @param tokenId The token ID of the NFT to burn.
     * @return Returns true if the NFT has been burned successfully.
     */

    function burnNFT(uint tokenId) external returns (bool) {
        require(whitelistContract != address(0), "Whitelist contract not set");
        require(
            msg.sender == whitelistContract,
            "Only the whitelist contract can burn NFTs"
        );
        _burn(tokenId);
        emit BurnedNFT(tokenId);
        return true;
    }

    /**
     * @notice Renounce ownership of the contract.
     * @dev Overridden to prevent the renouncing of ownership.
     */

    function renounceOwnership() public view override onlyOwner {
        revert("Ownership cannot be renounced");
    }

    /**
     * @dev Hook that is called before any token transfer, designed to prevent token transfers.
     * @param from The address sending the token.
     * @param to The address receiving the token.
     */

    function _beforeTokenTransfer(
        address from,
        address to,
        uint, // tokenID
        uint // batchSize
    ) internal pure override {
        require(from == address(0) || to == address(0), "Soulbound Token");
    }
}
