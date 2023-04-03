// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
//import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MaticW2RPairToken is ERC20, ERC20Burnable, Ownable {
    //using SafeERC20 for MaticW2RPairToken;

    constructor() ERC20("Matic-W2R LP Token", "MATIC-W2R") {
        isMinterAndBurner[msg.sender] = true;
    }

    mapping(address => bool) isMinterAndBurner;

    function checkMinterAndBurner(
        address authorized
    ) external view onlyOwner returns (bool) {
        return isMinterAndBurner[authorized];
    }

    function addMinterAndBurner(address authorized) external onlyOwner {
        require(!isMinterAndBurner[authorized], "Minter already exists");
        require(authorized != address(0), "Minter address cannot be 0x0");
        isMinterAndBurner[authorized] = true;
    }

    function removeMinterAndBurner(address authorized) external onlyOwner {
        require(isMinterAndBurner[authorized], "Minter does not exist");
        require(authorized != address(0), "Minter address cannot be 0x0");
        isMinterAndBurner[authorized] = false;
    }

    // only mintable to authorized addresses, only burnable from authorized addresses
    function mint(address to, uint amount) external {
        require(isMinterAndBurner[msg.sender], "You are not a minter");
        _mint(to, amount);
    }

    function burn(uint256 amount) public override {
        require(isMinterAndBurner[msg.sender], "You are not a burner");
        super.burn(amount);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        if (!isMinterAndBurner[from])
            require(isMinterAndBurner[to], "You are not a minter");

        if (to == address(0))
            require(isMinterAndBurner[from], "You are not a burner");
        super._beforeTokenTransfer(from, to, amount);
    }
}
