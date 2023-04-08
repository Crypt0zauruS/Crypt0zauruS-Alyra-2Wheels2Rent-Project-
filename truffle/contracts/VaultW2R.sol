// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

//import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
//import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
//import "@openzeppelin/contracts/access/Ownable.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VaultW2R
 * @notice This contract serves as a vault for managing the distribution and withdrawal of W2R tokens.
 * @dev The contract uses OpenZeppelin's SafeERC20, Ownable, and IERC20 contracts.
 */

contract VaultW2R is Ownable {
    using SafeERC20 for IERC20;
    IERC20 public W2R;
    address public whitelistLenders;
    address public whitelistRenters;

    mapping(address => bool) private approvedContracts;

    event W2RTransferred(address indexed receiver, uint256 amount);
    event W2RWithdrawn(address indexed receiver, uint256 amount);
    event ContractApproved(address indexed contractAddress, bool status);
    event ContractRemoved(address indexed contractAddress);

    /**
     * @notice Constructs the VaultW2R contract.
     * @param _w2rToken The address of the W2R token contract.
     */

    constructor(address _w2rToken) {
        require(
            address(_w2rToken) != address(0),
            "W2R token address cannot be zero"
        );

        W2R = IERC20(_w2rToken);
    }

    /**
     * @notice Sets the WhitelistLenders contract address.
     * @param _whitelistLenders The address of the WhitelistLenders contract.
     */

    function setWhitelistLenders(address _whitelistLenders) external onlyOwner {
        require(
            _whitelistLenders != address(0),
            "WhitelistLenders address cannot be zero"
        );
        // authorize the whitelistLender contract to approve child contracts
        whitelistLenders = _whitelistLenders;
    }

    /**
     * @notice Sets the WhitelistRenters contract address.
     * @param _whitelistRenters The address of the WhitelistRenters contract.
     */

    function setWhitelistRenters(address _whitelistRenters) external onlyOwner {
        require(
            _whitelistRenters != address(0),
            "WhitelistRenters address cannot be zero"
        );
        // authorize the whitelistRenter contract to approve child contracts
        whitelistRenters = _whitelistRenters;
    }

    /**
     * @notice Approves or disapproves a contract address.
     * @param contractAddress The address of the contract to be approved or disapproved.
     * @param status The approval status to be set, true for approved and false for disapproved.
     */

    function setApprovedContract(
        address contractAddress,
        bool status
    ) external {
        require(
            msg.sender == whitelistLenders ||
                msg.sender == whitelistRenters ||
                msg.sender == owner(),
            "Caller is not an approved contract"
        );
        require(
            contractAddress != address(this),
            "Cannot add self to approved contracts"
        );
        approvedContracts[contractAddress] = status;
        emit ContractApproved(contractAddress, status);
    }

    /**
     * @notice Removes an approved contract address.
     * @param contractAddress The address of the contract to be removed.
     * @return A boolean value indicating whether the contract was successfully removed.
     */

    function removeApprovedContract(
        address contractAddress
    ) external returns (bool) {
        require(
            msg.sender == whitelistLenders ||
                msg.sender == whitelistRenters ||
                msg.sender == owner(),
            "Caller is not an approved contract"
        );
        require(approvedContracts[contractAddress], "Contract is not approved");
        require(
            contractAddress != address(this),
            "Cannot remove self from approved contracts"
        );
        delete approvedContracts[contractAddress];
        emit ContractRemoved(contractAddress);
        return true;
    }

    /**
     * @notice Gets the approval status of a contract address.
     * @param contractAddress The address of the contract.
     * @return A boolean value indicating whether the contract is approved.
     */

    function getApprovedContract(
        address contractAddress
    ) external view onlyOwner returns (bool) {
        return approvedContracts[contractAddress];
    }

    /**
     * @notice Distributes W2R tokens to a specified receiver.
     * @param receiver The address of the recipient.
     * @param amount The amount of W2R tokens to be distributed.
     */

    function distributeW2R(address receiver, uint256 amount) external {
        require(
            approvedContracts[msg.sender],
            "Caller is not an approved contract"
        );
        require(amount > 0, "Amount must be greater than 0");
        require(
            W2R.balanceOf(address(this)) >= amount,
            "Vault has insufficient W2R balance"
        );

        W2R.safeTransfer(receiver, amount);
        emit W2RTransferred(receiver, amount);
    }

    /**
     * @notice Withdraws W2R tokens from the contract to the owner's address.
     * @param amount The amount of W2R tokens to be withdrawn.
     */

    function withdrawW2R(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(
            W2R.balanceOf(address(this)) >= amount,
            "Vault has insufficient W2R balance"
        );

        W2R.safeTransfer(msg.sender, amount);
        emit W2RWithdrawn(msg.sender, amount);
    }
}
