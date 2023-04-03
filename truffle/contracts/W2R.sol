// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract W2R is ERC20, ERC20Burnable, Pausable, Ownable {
    uint public maxSupply = 200000000 * 10 ** decimals();

    constructor(uint _initialSupply) ERC20("2 Wheels 2 Rent Token", "W2R") {
        _mint(msg.sender, _initialSupply * 10 ** decimals());
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function mint(address to, uint amount) public whenNotPaused onlyOwner {
        require(
            totalSupply() + amount <= maxSupply,
            "ERC20Capped: cap exceeded"
        );
        _mint(to, amount);
    }

    function burn(uint256 amount) public override onlyOwner {
        super.burn(amount);
    }

    function burnFrom(
        address account,
        uint amount
    ) public override whenNotPaused onlyOwner {
        super.burnFrom(account, amount);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }
}
