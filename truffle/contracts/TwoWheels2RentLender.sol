// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./Base64.sol";

contract TwoWheels2RentLender is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    address public whitelistContract;
    string ipfsHash;

    struct BikeInfo {
        string name;
        string brand;
        string model;
        string serial;
        string registration;
    }

    event MintedNFTWithURI(address recipient, uint256 tokenId, string uri);
    event BurnedNFT(uint256 tokenId);

    constructor() ERC721("2Wheels2RentLender", "W2RNFTL") {}

    function getIpfsHashLength() external view returns (bool) {
        require(msg.sender == whitelistContract, "Only the whitelist contract");
        return bytes(ipfsHash).length > 0;
    }

    function setLenderWhitelistContract(
        address _whitelistContract
    ) external onlyOwner returns (bool) {
        require(_whitelistContract != address(0));
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
        BikeInfo calldata bikeInfo
    ) external returns (uint) {
        require(whitelistContract != address(0));
        require(recipient != address(0));
        require(bytes(ipfsHash).length > 0, "IPFS hash not set");
        require(msg.sender == whitelistContract, "Only the whitelist contract");
        // checking no strings are empty
        require(
            bytes(bikeInfo.name).length > 0 &&
                bytes(bikeInfo.brand).length > 0 &&
                bytes(bikeInfo.model).length > 0 &&
                bytes(bikeInfo.serial).length > 0 &&
                bytes(bikeInfo.registration).length > 0,
            "Empty fields"
        );
        // checking strings don't exceed 40 characters
        require(
            bytes(bikeInfo.name).length <= 40 &&
                bytes(bikeInfo.brand).length <= 40 &&
                bytes(bikeInfo.model).length <= 40 &&
                bytes(bikeInfo.serial).length <= 40 &&
                bytes(bikeInfo.registration).length <= 40,
            "Too long"
        );
        _tokenIds.increment();

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "',
                        bikeInfo.name,
                        '", "description": "2Wheels2Rent Bike NFT", "attributes": [{"trait_type": "brand", "value": "',
                        bikeInfo.brand,
                        '"}, {"trait_type": "model", "value": "',
                        bikeInfo.model,
                        '"}, {"trait_type": "serial", "value": "',
                        bikeInfo.serial,
                        '"}, {"trait_type": "registration", "value": "',
                        bikeInfo.registration,
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
        require(whitelistContract != address(0));
        require(msg.sender == whitelistContract, "Only the whitelist contract");
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
        uint,
        uint
    ) internal pure override {
        require(from == address(0) || to == address(0), "Soulbound Token");
    }
}
