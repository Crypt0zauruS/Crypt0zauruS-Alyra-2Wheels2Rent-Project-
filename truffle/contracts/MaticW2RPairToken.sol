// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

//import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
//import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
//import "@openzeppelin/contracts/access/Ownable.sol";

import "../node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MaticW2RPairToken
 * @dev This contract represents an ERC20 token which is burnable and has restricted minting and burning functionality.
 * It uses the OpenZeppelin ERC20, ERC20Burnable, and Ownable contracts.
 */

contract MaticW2RPairToken is ERC20, ERC20Burnable, Ownable {
    /**
     * @dev Constructor that initializes the token with a name and symbol.
     */
    constructor() ERC20("Matic-W2R LP Token", "MATIC-W2R") {
        isMinterAndBurner[msg.sender] = true;
    }

    mapping(address => bool) isMinterAndBurner;

    /**
     * @notice Check if an address is authorized as a minter and burner.
     * @param authorized The address to be checked.
     * @return A boolean value indicating whether the address is authorized as a minter and burner.
     */

    function checkMinterAndBurner(
        address authorized
    ) external view onlyOwner returns (bool) {
        return isMinterAndBurner[authorized];
    }

    /**
     * @notice Add a minter and burner to the authorized list.
     * @param authorized The address to be added as a minter and burner.
     */

    function addMinterAndBurner(address authorized) external onlyOwner {
        require(!isMinterAndBurner[authorized], "Minter already exists");
        require(authorized != address(0), "Minter address cannot be 0x0");
        isMinterAndBurner[authorized] = true;
    }

    /**
     * @notice Remove a minter and burner from the authorized list.
     * @param authorized The address to be removed as a minter and burner.
     */

    function removeMinterAndBurner(address authorized) external onlyOwner {
        require(isMinterAndBurner[authorized], "Minter does not exist");
        require(authorized != address(0), "Minter address cannot be 0x0");
        isMinterAndBurner[authorized] = false;
    }

    /**
     * @notice Mint tokens to a specified address only for authorized minter.
     * @param to The address to receive the minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint amount) external {
        require(isMinterAndBurner[msg.sender], "You are not a minter");
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens from the caller's address only for authorized burner.
     * @param amount The amount of tokens to burn.
     */

    function burn(uint256 amount) public override {
        require(isMinterAndBurner[msg.sender], "You are not a burner");
        super.burn(amount);
    }

    /**
     * @dev Hook that is called before any token transfer.
     * This implementation checks whether the sender or receiver is authorized as a minter and burner.
     * @param from The address sending the tokens.
     * @param to The address receiving the tokens.
     * @param amount The amount of tokens being transferred.
     */

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
