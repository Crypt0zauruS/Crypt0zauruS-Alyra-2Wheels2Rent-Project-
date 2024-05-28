// SPDX-License-Identifier: CC-BY-4.0
pragma solidity ^0.8.9;

//import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
//import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
//import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
//import "@openzeppelin/contracts/access/Ownable.sol";
//import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";
import "../node_modules/@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @dev Interface for the W2R Vault contract.
 */

interface I5VaultW2R {
    function distributeW2R(address receiver, uint amount) external;

    function updateIncomes(
        uint _maticIncome,
        uint _w2rIncome,
        uint _date
    ) external;
}

/**
 * @dev Interface for the Matic-W2R LP token contract.
 */

interface IMaticW2RPairToken is IERC20 {
    function checkMinterAndBurner(
        address authorized
    ) external view returns (bool);

    function mint(address to, uint amount) external;

    function burn(uint256 amount) external;
}

/**
 * @title MaticW2Rdex
 * @author Crypt0zaurus https://www.linkedin.com/in/maxence-a-a82081260
 * @dev A decentralized exchange for swapping Matic and W2R tokens, providing liquidity and farming.
 */

contract MaticW2Rdex is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeERC20 for IMaticW2RPairToken;
    IERC20 public W2R;
    IMaticW2RPairToken public lpToken;
    uint public swapRate;
    uint public totalMaticLiquidity;
    uint public totalW2RLiquidity;
    uint public annualYieldPercentage;
    uint public securityPercentage;
    uint public totalMaticFees;
    uint public totalW2RFees;
    uint public feesPercent;

    I5VaultW2R vaultW2R;
    address public vaultW2RAddress;

    mapping(address => uint) public LPBalance;
    mapping(address => Farming) public farming;

    // Mappings and uint for Tests on Amoy
    mapping(address => uint) private lastDistributeTimestamp;
    mapping(bytes32 => uint) private lastIPDistributeTimestamp;
    uint public testAmount;
    // End of Mappings and uint for Tests on Amoy

    struct Farming {
        uint lastTime;
        uint lpAmount;
        uint rewards;
    }

    event SwapMaticForW2R(
        address indexed user,
        uint maticAmount,
        uint w2rAmount,
        uint date
    );
    event SwapW2RForMatic(
        address indexed user,
        uint w2rAmount,
        uint maticAmount,
        uint date
    );

    event AddLiquidity(
        address indexed user,
        uint maticAmount,
        uint w2rAmount,
        uint lpAmount
    );
    event RemoveLiquidity(
        address indexed user,
        uint lpAmount,
        uint maticAmount,
        uint w2rAmount
    );
    event Farm(address indexed user, uint lpAmount, uint date);
    event Harvest(address indexed user, uint rewards, uint date);
    event ExitFarm(address indexed user, uint lpAmount, uint date);

    /**
     * @dev Constructor that initializes the contract with the token addresses, initial swap rate, Vault W2R address, and LP token address.
     * @param W2RAddress Address of the W2R token contract.
     * @param initialSwapRate Initial swap rate for Matic to W2R conversion.
     * @param _vaultW2RAddress Address of the Vault W2R contract.
     * @param lpTokenAddress Address of the LP token contract.
     */

    constructor(
        address W2RAddress,
        uint initialSwapRate,
        address _vaultW2RAddress,
        address lpTokenAddress
    ) {
        require(W2RAddress != address(0), "W2R address cannot be 0x0");
        require(initialSwapRate > 0, "Swap rate must be greater than 0");
        require(
            _vaultW2RAddress != address(0),
            "Vault W2R address cannot be 0x0"
        );
        W2R = IERC20(W2RAddress);
        lpToken = IMaticW2RPairToken(lpTokenAddress);
        vaultW2RAddress = _vaultW2RAddress;
        swapRate = initialSwapRate;
        annualYieldPercentage = 20;
        vaultW2R = I5VaultW2R(_vaultW2RAddress);
        securityPercentage = 5;
        feesPercent = 1;
        testAmount = 1000 * 10 ** 18;
    }

    /**
     * @dev Modifier to check the LP token amount ans allowance for the calling user.
     * @param lpAmount Amount of LP tokens to check.
     */

    modifier checkLPAmount(uint lpAmount) {
        require(lpAmount > 0, "LP amount must be greater than 0");

        require(
            lpToken.allowance(msg.sender, address(this)) >= lpAmount,
            "You need to approve LP token first"
        );
        require(
            LPBalance[msg.sender] >= lpAmount &&
                lpToken.balanceOf(msg.sender) >= lpAmount,
            "You don't have any LP tokens to remove"
        );
        require(lpAmount <= LPBalance[msg.sender], "Not enough LP tokens");

        _;
    }

    /**
     * @dev Distribute 2000 W2R tokens to the caller as a tester once per day, only on Amoy Testnet.
     * Owner can set testAmount to 0 to disable this function.
     * @param ipHash The keccak256 hash of the caller's IP address.
     */
    function distributeTestW2R(bytes32 ipHash) external {
        require(testAmount > 0, "Test amount must be greater than 0");
        // Make sure this function is only callable on Amoy Testnet
        uint chainId;
        assembly {
            chainId := chainid()
        }
        require(
            chainId == 80002,
            "This function can only be used on the Amoy Testnet"
        );
        uint currentTime = block.timestamp;
        // Check IP limit
        require(
            currentTime - lastIPDistributeTimestamp[ipHash] >= 1 days,
            "You can only call this function once a day per IP"
        );
        lastIPDistributeTimestamp[ipHash] = currentTime;
        // Check address limit
        require(
            currentTime - lastDistributeTimestamp[msg.sender] >= 1 days,
            "You can only call this function once a day"
        );
        lastDistributeTimestamp[msg.sender] = currentTime;
        vaultW2R.distributeW2R(msg.sender, testAmount);
    }

    /**
     * @dev Set the amount of W2R tokens to be distributed during testing.
     * Can only be called by the contract owner.
     * @param _amount The new test amount to be distributed (in W2R tokens).
     * Must be greater or equal to 0 and less than or equal to 10,000 W2R.
     */
    function setTestAmount(uint _amount) external onlyOwner {
        require(_amount >= 0, "Amount must be greater or equal to 0");
        require(
            _amount <= 10000 * 10 ** 18,
            "Amount must be less than 10000 W2R"
        );
        testAmount = _amount;
    }

    /**
     * @dev Get the contract balances for W2R, MATIC, and LP tokens.
     * @return A tuple containing the W2R, MATIC, and LP token balances of the contract.
     */

    function getContractBalances() external view returns (uint, uint, uint) {
        // W2R, MATIC, LP
        return (
            W2R.balanceOf(address(this)),
            address(this).balance,
            lpToken.balanceOf(address(this))
        );
    }

    /**
     * @dev Get the user balances for W2R and LP tokens.
     * @return A tuple containing the W2R and LP token balances of the caller.
     */

    function getUserBalances() external view returns (uint, uint) {
        return (W2R.balanceOf(msg.sender), lpToken.balanceOf(msg.sender));
    }

    /**
     * @dev Check if the given address is authorized as a minter and burner in the LP token contract.
     * @param _toCheck The address to check for authorization in the LP token contract.
     * @return A boolean value indicating whether the address is authorized as a minter and burner.
     */

    function checkIfAuthorizedInLPcontract(
        address _toCheck
    ) public view returns (bool) {
        return lpToken.checkMinterAndBurner(_toCheck);
    }

    /**
     * @dev Swap Matic for W2R tokens. Requires sending Matic along with the transaction.
     * Emits a SwapMaticForW2R event.
     */

    function swapMaticForW2R() external payable {
        require(msg.value > 0, "must be greater 0");
        require((msg.value * feesPercent * 100) >= 10000);
        uint fees = (msg.value * feesPercent * 100) / 10000;
        require(msg.sender.balance > msg.value + fees, "not enough Matic");
        uint w2rAmount = (msg.value - fees) * swapRate;
        require(w2rAmount > 0, "W2R must be greater 0");
        require((totalW2RLiquidity * securityPercentage * 100) >= 10000);
        require(
            (totalW2RLiquidity * securityPercentage * 100) / 10000 >= w2rAmount,
            "You can't swap more than 5% of the total W2R supply"
        );
        totalMaticFees += fees;
        totalMaticLiquidity += (msg.value - fees);
        totalW2RLiquidity -= w2rAmount;
        // transfer w2r to user
        W2R.safeTransfer(msg.sender, w2rAmount);
        emit SwapMaticForW2R(msg.sender, msg.value, w2rAmount, block.timestamp);
    }

    /**
     * @dev Swap W2R tokens for Matic tokens.
     * @param w2rAmount Amount of W2R tokens to swap for Matic tokens.
     * Emits a SwapW2RForMatic event.
     */
    function swapW2RForMatic(uint w2rAmount) external nonReentrant {
        require(msg.sender.balance > 0, "for MATIC fees");
        require(w2rAmount > 0, "W2R amount must be greater than 0");
        require(
            W2R.allowance(msg.sender, address(this)) >= w2rAmount,
            "You need to approve W2R first"
        );
        require(W2R.balanceOf(msg.sender) >= w2rAmount, "Not enough W2R");
        uint maticAmount = w2rAmount / swapRate;
        require((maticAmount * feesPercent * 100) >= 10000);
        uint fee = (maticAmount * feesPercent * 100) / 10000;
        require(
            (totalMaticLiquidity * securityPercentage * 100) / 10000 >=
                maticAmount,
            "You can't swap more than 5% of the contract's MATIC liquidity"
        );
        totalMaticFees += fee;
        totalMaticLiquidity -= (maticAmount - fee);
        totalW2RLiquidity += w2rAmount;
        W2R.safeTransferFrom(msg.sender, address(this), w2rAmount);
        (bool success, ) = payable(msg.sender).call{value: maticAmount - fee}(
            ""
        );
        require(success, "Transfer failed.");
        emit SwapW2RForMatic(
            msg.sender,
            w2rAmount,
            maticAmount,
            block.timestamp
        );
    }

    /**
     * @dev Add liquidity to the contract.
     * @param w2rAmount Amount of W2R tokens to add as liquidity.
     * Requires sending Matic along with the transaction.
     * Emits an AddLiquidity event.
     */

    function addLiquidity(uint w2rAmount) external payable {
        require(w2rAmount > 0, "W2R amount must be greater than 0");
        require(msg.value > 0, "MATIC amount must be greater than 0");
        require(
            W2R.allowance(msg.sender, address(this)) >= w2rAmount,
            "You need to approve W2R first"
        );
        uint maticAmount = msg.value;
        require((w2rAmount * 300) >= 10000);
        // limit tolerance to 3% for MATIC-W2R ratio of 10
        require(
            maticAmount * swapRate >= w2rAmount - ((w2rAmount * 300) / 10000) &&
                maticAmount * swapRate <=
                w2rAmount + ((w2rAmount * 300) / 10000),
            "MATIC-W2R ratio is not within the allowed slippage"
        );
        uint lpAmount;
        if (totalMaticLiquidity == 0 && totalW2RLiquidity == 0) {
            // the team has to bring the first (huge) liquidity
            require(msg.sender == owner(), "Only owner can add liquidity");
            lpAmount = maticAmount;
            totalMaticLiquidity = maticAmount;
            totalW2RLiquidity = w2rAmount;
        } else {
            // constant invariant formula
            uint k = totalMaticLiquidity * totalW2RLiquidity;
            totalMaticLiquidity += maticAmount;
            totalW2RLiquidity += w2rAmount;
            uint newK = totalMaticLiquidity * totalW2RLiquidity;
            lpAmount = (lpToken.totalSupply() * (newK - k)) / k;
            // prevent a user to have too much power on the contract
            require((lpToken.totalSupply() * securityPercentage) >= 100);
            require(
                w2rAmount <=
                    (totalW2RLiquidity * securityPercentage * 100) / 10000 ||
                    msg.sender == owner(),
                "You can't add more than the security % of the total LP supply"
            );
            totalMaticLiquidity += maticAmount;
            totalW2RLiquidity += w2rAmount;
        }
        LPBalance[msg.sender] += lpAmount;
        lpToken.mint(address(this), lpAmount);
        lpToken.safeTransfer(msg.sender, lpAmount);
        W2R.safeTransferFrom(msg.sender, address(this), w2rAmount);
        emit AddLiquidity(msg.sender, maticAmount, w2rAmount, lpAmount);
    }

    /**
     * @dev Remove liquidity from the contract.
     * @param lpAmount Amount of LP tokens to remove liquidity.
     * Emits a RemoveLiquidity event.
     */

    function removeLiquidity(
        uint lpAmount
    ) external checkLPAmount(lpAmount) nonReentrant {
        require(lpToken.totalSupply() > 0, "No liquidity to remove");
        require(
            totalMaticLiquidity > 0 && totalW2RLiquidity > 0,
            "No liquidity to remove"
        );
        require(LPBalance[msg.sender] >= lpAmount, "Not enough LP tokens");
        // Calculate the proportion of LP tokens the user is removing
        uint proportion = (lpAmount * 1e18) / lpToken.totalSupply();
        // Calculate the amount of MATIC and W2R to refund
        uint maticAmount = (totalMaticLiquidity * proportion) / 1e18;
        uint w2rAmount = (totalW2RLiquidity * proportion) / 1e18;
        LPBalance[msg.sender] -= lpAmount;
        totalMaticLiquidity -= maticAmount;
        totalW2RLiquidity -= w2rAmount;
        lpToken.transferFrom(msg.sender, address(this), lpAmount);
        lpToken.burn(lpAmount);
        W2R.safeTransfer(msg.sender, w2rAmount);
        (bool success, ) = payable(msg.sender).call{value: maticAmount}("");
        require(success, "Failed to send MATIC");
        emit RemoveLiquidity(msg.sender, maticAmount, w2rAmount, lpAmount);
    }

    /**
     * @dev Farm LP tokens to earn W2R rewards.
     * @param lpAmount Amount of LP tokens to farm.
     * Emits a Farm event.
     */

    function farm(uint lpAmount) external checkLPAmount(lpAmount) {
        // check if user has already farmed
        LPBalance[msg.sender] -= lpAmount;
        // update farming struct
        Farming storage user = farming[msg.sender];
        if (user.lpAmount > 0) {
            user.rewards += calculateReward();
        }
        user.lpAmount += lpAmount;
        user.lastTime = block.timestamp;
        lpToken.safeTransferFrom(msg.sender, address(this), lpAmount);
        emit Farm(msg.sender, lpAmount, block.timestamp);
    }

    /**
     * @dev Exit farm and claim LP tokens back.
     * Emits an ExitFarm event.
     */

    function exitFarm() external {
        require(msg.sender != address(0), "Invalid address");
        uint lpBalance = farming[msg.sender].lpAmount;
        require(lpBalance > 0, "No LP tokens to claim rewards");
        harvest();
        Farming storage user = farming[msg.sender];
        user.lpAmount -= lpBalance;
        LPBalance[msg.sender] += lpBalance;
        lpToken.safeTransfer(msg.sender, lpBalance);
        emit ExitFarm(msg.sender, lpBalance, block.timestamp);
    }

    /**
     * @dev View the pending W2R rewards for the user.
     * @return reward The pending W2R rewards for the user.
     */

    function viewRewards() external view returns (uint) {
        require(msg.sender != address(0), "Invalid address");
        uint lpBalance = farming[msg.sender].lpAmount;
        uint lastTime = farming[msg.sender].lastTime;
        uint timeElapsed = block.timestamp - lastTime;
        uint annualYieldDecimal = annualYieldPercentage * 10 ** 16;
        uint rewardRatePerSecond = annualYieldDecimal / 31536000;
        uint reward = ((lpBalance * timeElapsed * rewardRatePerSecond) /
            10 ** 18) + farming[msg.sender].rewards;
        return reward;
    }

    /**
     * @notice Calculates the reward for a user based on their LP balance, time elapsed, and the global reward rate.
     * @dev This function is private and should only be called within the contract.
     * @return The calculated reward amount for the user.
     */

    function calculateReward() private returns (uint) {
        uint lpBalance = farming[msg.sender].lpAmount;
        uint timeElapsed = block.timestamp - farming[msg.sender].lastTime;
        uint annualYieldDecimal = annualYieldPercentage * 10 ** 16;
        uint rewardRatePerSecond = annualYieldDecimal / 31536000;
        uint basis = (lpBalance * timeElapsed * rewardRatePerSecond) / 10 ** 18;
        require((basis * feesPercent * 100) >= 10000, "Risk of bad rounding");
        uint fees = (basis * feesPercent * 100) / 10000;
        uint reward = basis - fees;
        totalW2RFees += fees;
        return reward;
    }

    /**
     * @dev Claim W2R rewards from farming.
     * Emits a Harvest event.
     */

    function harvest() public {
        require(msg.sender != address(0), "Invalid address");
        uint lpBalance = farming[msg.sender].lpAmount;
        require(lpBalance > 0, "No LP tokens to claim rewards");
        Farming storage user = farming[msg.sender];
        uint reward = user.rewards += calculateReward();
        user.lastTime = block.timestamp;
        user.rewards = 0;
        vaultW2R.distributeW2R(msg.sender, reward);
        emit Harvest(msg.sender, user.rewards, block.timestamp);
    }

    /**
     * @dev Update the Matic to W2R swap rate.
     * @param newSwapRate New swap rate for Matic to W2R conversion.
     */

    function setSwapRate(uint newSwapRate) external onlyOwner {
        require(newSwapRate > 0, "Swap rate must be greater than 0");
        swapRate = newSwapRate;
    }

    /**
     * @dev Set the reward rate for farming.
     * @param _newPercentage New annual yield percentage.
     */

    function setAnnualYieldPercentage(uint _newPercentage) external onlyOwner {
        require(_newPercentage > 0, "Reward rate must be greater than 0");
        annualYieldPercentage = _newPercentage;
    }

    /**
     * @dev Set the security percentage for the contract.
     * @param _newSecurityPercentage New security percentage (must be greater than 0 and less than or equal to 100).
     */

    function setSecurityPercentage(
        uint _newSecurityPercentage
    ) external onlyOwner {
        require(
            _newSecurityPercentage > 0 && _newSecurityPercentage <= 100,
            "Security percentage must be greater than 0 and less than or equal to 100"
        );
        securityPercentage = _newSecurityPercentage;
    }

    /**
     * @dev Withdraw accumulated Matic fees for the vault.
     */
    function withdrawMaticFeesToVault() external onlyOwner nonReentrant {
        require(vaultW2RAddress != address(0), "Invalid address");
        require(totalMaticFees > 0, "No fees to withdraw");
        uint amount = totalMaticFees;
        totalMaticFees = 0;
        (bool success, ) = payable(vaultW2RAddress).call{value: amount}("");
        require(success, "Failed to withdraw fees");
    }

    /**
     * @dev Withdraw accumulated W2R fees to the vault.
     */
    function withdrawW2RFeesToVault() external onlyOwner {
        require(vaultW2RAddress != address(0), "Invalid address");
        require(totalW2RFees > 0, "No fees to withdraw");
        uint w2rToSend = totalW2RFees;
        totalW2RFees = 0;
        W2R.safeTransfer(vaultW2RAddress, w2rToSend);
        vaultW2R.updateIncomes(0, w2rToSend, block.timestamp);
    }

    /**
     * @dev Fallback function to receive Matic payments.
     */

    receive() external payable {}
}
