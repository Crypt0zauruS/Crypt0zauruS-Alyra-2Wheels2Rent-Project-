// SPDX-License-Identifier: CC-BY-4.0
pragma solidity ^0.8.0;

//import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
//import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
//import "@openzeppelin/contracts/access/Ownable.sol";
//import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";
import "../node_modules/@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title VaultW2R
 * @author Crypt0zaurus https://www.linkedin.com/in/maxence-a-a82081260
 * @notice This contract serves as a vault for managing the distribution and withdrawal of W2R tokens.
 * @dev The contract uses OpenZeppelin's SafeERC20, Ownable, and IERC20 contracts.
 */

contract VaultW2R is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public W2R;
    address public whitelistLenders;
    address public whitelistRenters;

    mapping(address => bool) private approvedContracts;
    // incomes
    mapping(address => mapping(uint => uint)) private w2rIncomes;
    mapping(address => mapping(uint => uint)) private maticIncomes;
    // withdrawals
    mapping(address => mapping(uint => uint)) private w2rWithdraws;
    mapping(address => mapping(uint => uint)) private maticWithdraws;
    // distributions
    mapping(address => mapping(uint => uint)) private w2rDistributions;

    // in case a bikeShare contract is destroyed although rental dispute is still ongoing, deposit is placed here, waiting for the dispute to be resolved
    mapping(address => DepositsWhenDestroyed) private depositsWhenDestroyed;

    struct DepositsWhenDestroyed {
        address lenderContractOwner;
        address renterContract;
        address renterContractOwner;
        uint date;
        uint amount;
        bool sentToLender;
        bool sentToRenter;
    }

    uint public totalDepositsWhenDestroyed;

    event W2RTransferred(
        address indexed receiver,
        uint256 amount,
        uint date,
        address indexed from
    );
    event W2RWithdrawn(address indexed receiver, uint256 amount, uint date);
    event MaticWithdrawn(address indexed receiver, uint256 amount, uint date);
    event W2RIncome(address indexed sender, uint256 amount, uint date);
    event MaticIncome(address indexed sender, uint256 amount, uint date);
    event ContractApproved(address indexed contractAddress, bool status);
    event ContractRemoved(address indexed contractAddress);

    /**
     * @dev Modifier to check the W2R token amount ans allowance for the calling user.
     * @param amount Amount of LP tokens to check.
     */
    modifier checkAllowance(uint amount) {
        require(
            W2R.allowance(msg.sender, address(this)) >= amount,
            "Need approval for this amount"
        );
        _;
    }

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
    @notice A bikeShare contract can be destroyed after 2 days since the end of the rental period, or immediately if there is no rental
    The wait of 2 days is to give the renter time to return bike in case of delay or dispute
    After this time, if the lender has not received the bike and want to destroy the bikeShare contract,
    deposit will be placed here.
    @notice It's not mandatory to destroy the bikeShare contract, it's in case the lender wants to destroy it: deposit
    must be saved umtil the dispute is resolved
    @param _lenderContractOwner The address of the lender contract owner
    @param _renterContract The address of the renter contract
    @param _renterContractOwner The address of the renter contract owner
    @param _date The date of the deposit
    @param _amount The amount of the deposit
    */
    function receiveDepositsWhenDestroyed(
        address _lenderContractOwner,
        address _renterContract,
        address _renterContractOwner,
        uint _date,
        uint _amount
    ) external {
        require(
            approvedContracts[msg.sender],
            "Caller is not an approved contract"
        );
        require(
            _lenderContractOwner != address(0) &&
                _renterContract != address(0) &&
                _renterContractOwner != address(0)
        );
        require(_date > 0 && _amount > 0);
        depositsWhenDestroyed[msg.sender] = DepositsWhenDestroyed(
            _lenderContractOwner,
            _renterContract,
            _renterContractOwner,
            _date,
            _amount,
            false,
            false
        );
        totalDepositsWhenDestroyed += _amount;
    }

    /**
    @notice Send deposit to either lender or renter.
    @param _lender The address of the lender.
    @param _sentToLender Set to true if deposit is to be sent to the lender, false if it is to be sent to the renter.
    This function is only callable by the owner of the contract.
    It first checks if the lender address is not zero and if the deposit has not been sent yet.
    Then it checks if the deposit exists and updates the deposit status based on the _sentToLender parameter.
    Finally, it updates the totalDepositsWhenDestroyed and transfers the deposit amount to the appropriate recipient.
    */
    function sentDeposit(
        address _lender,
        bool _sentToLender
    ) external onlyOwner {
        require(_lender != address(0), "Lender address cannot be zero");
        DepositsWhenDestroyed storage deposit = depositsWhenDestroyed[_lender];
        require(
            deposit.sentToLender == false && deposit.sentToRenter == false,
            "Deposit already sent"
        );
        require(deposit.date > 0 && deposit.amount > 0, "Deposit not found");
        require(
            deposit.lenderContractOwner != address(0) &&
                deposit.renterContract != address(0) &&
                deposit.renterContractOwner != address(0),
            "Deposit not found"
        );
        _sentToLender
            ? deposit.sentToLender = true
            : deposit.sentToRenter = true;
        totalDepositsWhenDestroyed -= deposit.amount;
        _sentToLender
            ? W2R.safeTransfer(deposit.lenderContractOwner, deposit.amount)
            : W2R.safeTransfer(deposit.renterContractOwner, deposit.amount);
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
            W2R.balanceOf(address(this)) >= amount + totalDepositsWhenDestroyed,
            "Vault has insufficient W2R balance"
        );
        w2rDistributions[receiver][block.timestamp] = amount;
        W2R.safeTransfer(receiver, amount);
        emit W2RTransferred(receiver, amount, block.timestamp, msg.sender);
    }

    /**
     * @notice Withdraws W2R tokens from the contract to the owner's address.
     * @param amount The amount of W2R tokens to be withdrawn.
     */

    function withdrawW2R(uint amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(
            W2R.balanceOf(address(this)) >= amount + totalDepositsWhenDestroyed,
            "Vault has insufficient W2R balance"
        );
        w2rWithdraws[msg.sender][block.timestamp] = amount;
        W2R.safeTransfer(msg.sender, amount);
        emit W2RWithdrawn(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Withdraws Matic tokens from the contract to the owner's address.
     * @param amount The amount of Matic tokens to be withdrawn.
     */

    function withdrawMatic(uint amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(
            address(this).balance >= amount,
            "Vault has insufficient Matic balance"
        );
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Failed to withdraw fees");
        maticWithdraws[msg.sender][block.timestamp] = amount;
        emit MaticWithdrawn(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Updates the Matic and W2R incomes for the given date.
     * @dev Only the contract owner or approved contracts can call this function.
     * @param _maticIncome The amount of Matic income to be updated.
     * @param _w2rIncome The amount of W2R income to be updated.
     * @param _date The date for which the incomes should be updated, represented as a Unix timestamp.
     */

    function updateIncomes(
        uint _maticIncome,
        uint _w2rIncome,
        uint _date
    ) public {
        require(
            approvedContracts[msg.sender] || msg.sender == owner(),
            "Caller is not approved"
        );
        require(_maticIncome > 0 || _w2rIncome > 0, "Nothing to update");
        if (_maticIncome > 0) {
            maticIncomes[msg.sender][_date] = _maticIncome;
            emit MaticIncome(msg.sender, _maticIncome, _date);
        }
        if (_w2rIncome > 0) {
            w2rIncomes[msg.sender][_date] = _w2rIncome;
            emit W2RIncome(msg.sender, _w2rIncome, _date);
        }
    }

    /**
     * @notice Deposits W2R tokens to the contract.
     * @dev Only the contract owner can call this function, and the owner's W2R token allowance must be sufficient.
     * @param _amount The amount of W2R tokens to deposit.
     */

    function depositW2R(
        uint _amount
    ) external onlyOwner checkAllowance(_amount) {
        require(_amount > 0, "Amount must be greater than zero");
        updateIncomes(0, _amount, block.timestamp);
        W2R.safeTransferFrom(msg.sender, address(this), _amount);
    }

    /**
     * @dev Fallback function to receive Matic payments.
     * @notice This function is called when the contract receives Matic tokens and updates the income.
     */

    receive() external payable {
        updateIncomes(msg.value, 0, block.timestamp);
    }
}
