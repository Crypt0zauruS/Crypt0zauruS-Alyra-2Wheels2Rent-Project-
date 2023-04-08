// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

//import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
//import "@openzeppelin/contracts/access/Ownable.sol";
//import "@openzeppelin/contracts/utils/Counters.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";
import "../node_modules/@openzeppelin/contracts/utils/Counters.sol";
import "./Base64.sol";

contract TwoWheels2RentRenter is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    address public whitelistContract;
    string ipfsHash;

    struct RenterInfo {
        string name;
        string rather;
    }

    event MintedNFTWithURI(address recipient, uint256 tokenId, string uri);
    event BurnedNFT(uint256 tokenId);

    constructor() ERC721("2Wheels2RentRenter", "W2RNFTT") {}

    function getIpfsHashLength() external view returns (bool) {
        require(msg.sender == whitelistContract, "Only the whitelist contract");
        return bytes(ipfsHash).length > 0;
    }

    function setRenterWhitelistContract(
        address _whitelistContract
    ) external onlyOwner returns (bool) {
        require(_whitelistContract != address(0), "Zero address not allowed");
        whitelistContract = _whitelistContract;
        return true;
    }

    function setIpfsHash(
        string memory _ipfsHash
    ) external onlyOwner returns (bool) {
        require(bytes(_ipfsHash).length > 0, "IPFS hash not set");
        ipfsHash = _ipfsHash;
        return true;
    }

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

    function renounceOwnership() public view override onlyOwner {
        revert("Ownership cannot be renounced");
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint, // tokenID
        uint // batchSize
    ) internal pure override {
        require(from == address(0) || to == address(0), "Soulbound Token");
    }
}
