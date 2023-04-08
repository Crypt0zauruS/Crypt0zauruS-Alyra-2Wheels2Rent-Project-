// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

//import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
//import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
//import "@openzeppelin/contracts/access/Ownable.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";

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

    constructor(address _w2rToken) {
        require(
            address(_w2rToken) != address(0),
            "W2R token address cannot be zero"
        );

        W2R = IERC20(_w2rToken);
    }

    function setWhitelistLenders(address _whitelistLenders) external onlyOwner {
        require(
            _whitelistLenders != address(0),
            "WhitelistLenders address cannot be zero"
        );
        // authorize the whitelistLender contract to approve child contracts
        whitelistLenders = _whitelistLenders;
    }

    function setWhitelistRenters(address _whitelistRenters) external onlyOwner {
        require(
            _whitelistRenters != address(0),
            "WhitelistRenters address cannot be zero"
        );
        // authorize the whitelistRenter contract to approve child contracts
        whitelistRenters = _whitelistRenters;
    }

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

    function getApprovedContract(
        address contractAddress
    ) external view onlyOwner returns (bool) {
        return approvedContracts[contractAddress];
    }

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
