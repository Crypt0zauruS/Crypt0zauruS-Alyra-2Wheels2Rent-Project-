// SPDX-License-Identifier: CC-BY-4.0
pragma solidity ^0.8.9;

//import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
//import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
//import "@openzeppelin/contracts/security/Pausable.sol";
//import "@openzeppelin/contracts/access/Ownable.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "../node_modules/@openzeppelin/contracts/security/Pausable.sol";
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title 2 Wheels 2 Rent Token (W2R)
 * @dev An ERC20 token contract with burnable, pausable, and ownable features.
 * Inherits from the OpenZeppelin ERC20, ERC20Burnable, Pausable, and Ownable contracts.
 */

contract W2R is ERC20, ERC20Burnable, Pausable, Ownable {
    uint public maxSupply = 200000000 * 10 ** decimals();

    /**
     * @dev Constructor to initialize the W2R token with a given initial supply.
     * @param _initialSupply The initial token supply to be minted.
     */

    constructor(uint _initialSupply) ERC20("2 Wheels 2 Rent Token", "W2R") {
        _mint(msg.sender, _initialSupply * 10 ** decimals());
    }

    /**
     * @dev Pause the token transfers. Only callable by the contract owner.
     */

    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the token transfers. Only callable by the contract owner.
     */

    function unpause() public onlyOwner {
        _unpause();
    }

    /**
     * @dev Mint new tokens and send them to a specified address. Only callable by the contract owner.
     * @param to The address to receive the minted tokens.
     * @param amount The amount of tokens to mint.
     */

    function mint(address to, uint amount) public whenNotPaused onlyOwner {
        require(
            totalSupply() + amount <= maxSupply,
            "ERC20Capped: cap exceeded"
        );
        _mint(to, amount);
    }

    /**
     * @dev Burn tokens from the contract owner's balance. Overrides the parent contract's burn function.
     * @param amount The amount of tokens to burn.
     */

    function burn(uint256 amount) public override onlyOwner {
        super.burn(amount);
    }

    /**
     * @dev Burn tokens from a specified account's balance. Overrides the parent contract's burnFrom function.
     * @param account The address from which to burn tokens.
     * @param amount The amount of tokens to burn.
     */

    function burnFrom(
        address account,
        uint amount
    ) public override whenNotPaused onlyOwner {
        super.burnFrom(account, amount);
    }

    /**
     * @dev Hook that is called before any token transfer, including minting and burning.
     * Overrides the parent contract's _beforeTokenTransfer function.
     * @param from The address the tokens are being transferred from.
     * @param to The address the tokens are being transferred to.
     * @param amount The amount of tokens being transferred.
     */

    function _beforeTokenTransfer(
        address from,
        address to,
        uint amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }
}
