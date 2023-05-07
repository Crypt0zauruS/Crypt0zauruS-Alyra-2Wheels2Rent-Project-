// SPDX-License-Identifier: CC-BY-4.0
pragma solidity ^0.8.0;

//import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
//import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
//import "@openzeppelin/contracts/access/Ownable.sol";
//import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";
import "../node_modules/@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./ABDKMath64x64.sol";

/**
 * @notice Interface for the W2R Vault contract
 */

interface I6VaultW2R {
    function distributeW2R(address receiver, uint amount) external;

    function updateIncomes(
        uint _maticIncome,
        uint _w2rIncome,
        uint _date
    ) external;
}

/**
 * @title W2R Staking
 * @author Crypt0zaurus https://www.linkedin.com/in/maxence-a-a82081260
 * @notice This contract is a staking platform for W2R tokens, allowing users to stake their tokens, claim rewards, and unstake.
 * It includes an early unstake penalty and a reward multiplier. The contract also interacts with a W2R vault for reward distribution.
 * @dev This contract imports OpenZeppelin libraries, the Chainlink Aggregator V3 Interface, and the ABDKMath64x64 library.
 */

contract W2RStaking is Ownable {
    using SafeERC20 for IERC20;
    using ABDKMath64x64 for int128;

    IERC20 public w2rToken;
    AggregatorV3Interface internal priceFeed;

    struct StakerInfo {
        uint stakedAmount;
        uint lastUpdated;
        uint reward;
        uint stakedUSDValue;
        uint lockEndTime;
        uint LockInMonths;
        uint resetStakeDate;
    }

    uint public earlyUnstakePenalty;
    uint public totalStaking;
    uint public rewardMultiplier;
    uint public rewardsFeesPercentage;
    uint public totalPenalties;
    uint public totalW2Rfees;
    uint public maxLockPeriod;
    uint precisionFactor = 1e6;

    mapping(address => StakerInfo) public stakers;

    // import VaultW2R interface
    I6VaultW2R vaultW2R;
    address public vaultW2RAddress;

    event Staked(address indexed user, uint amount);
    event Unstaked(address indexed user, uint amount);
    event RewardClaimed(address indexed user, uint amount);
    event RewardMultiplierUpdated(uint newRewardMultiplier);
    event LockPeriodUpdated(
        uint newLockEndTime,
        uint months,
        address indexed staker
    );
    event EarlyUnstakePenaltyUpdated(uint newEarlyUnstakePenalty);
    event RewardsFeesPercentageUpdated(uint newRewardsFeesPercentage);
    event W2RfeesWithdrawn(address indexed receiver, uint amount);

    /**
     * @notice Initializes the W2RStaking contract with required dependencies.
     * @dev Constructor to set initial contract parameters.
     * @param _w2rToken The address of the W2R token contract.
     * @param _priceFeed The address of the Chainlink price feed contract.
     * @param _vaultW2R The address of the W2R vault contract.
     */

    constructor(
        IERC20 _w2rToken,
        AggregatorV3Interface _priceFeed,
        address _vaultW2R
    ) {
        require(
            address(_w2rToken) != address(0) &&
                address(_priceFeed) != address(0) &&
                address(_vaultW2R) != address(0),
            "Invalid address"
        );
        w2rToken = _w2rToken;
        priceFeed = _priceFeed;
        vaultW2R = I6VaultW2R(_vaultW2R);
        vaultW2RAddress = _vaultW2R;
        earlyUnstakePenalty = 10;
        rewardMultiplier = 60 * 1e9;
        rewardsFeesPercentage = 1;
        maxLockPeriod = 24;
    }

    /**
     * @dev Modifier to check if the sender has enough allowance for the specified amount.
     * @param amount The amount to check the allowance for.
     */

    modifier checkAllowance(uint amount) {
        require(
            w2rToken.allowance(msg.sender, address(this)) >= amount,
            "Need approval for this amount"
        );
        _;
    }

    /**
     * @notice Set the early unstake penalty percentage.
     * @dev Updates the earlyUnstakePenalty variable.
     * @param _newEarlyUnstakePenalty The new early unstake penalty percentage.
     */

    function setEarlyUnstakePenalty(
        uint _newEarlyUnstakePenalty
    ) external onlyOwner {
        require(
            _newEarlyUnstakePenalty <= 100,
            "Early unstake penalty cannot be greater than 100%"
        );
        require(
            _newEarlyUnstakePenalty >= 0,
            "Early unstake penalty cannot be less than 0%"
        );
        earlyUnstakePenalty = _newEarlyUnstakePenalty;
        emit EarlyUnstakePenaltyUpdated(_newEarlyUnstakePenalty);
    }

    /**
     * @notice Set the reward multiplier.
     * @dev Updates the rewardMultiplier variable.
     * @param _newRewardMultiplier The new reward multiplier.
     */

    function setRewardMultiplier(uint _newRewardMultiplier) external onlyOwner {
        require(
            _newRewardMultiplier > 0,
            "Reward multiplier must be greater than 0"
        );
        require(
            _newRewardMultiplier <= 100,
            "Reward multiplier must be less than 100"
        );
        rewardMultiplier = _newRewardMultiplier * 1e17;
        emit RewardMultiplierUpdated(_newRewardMultiplier);
    }

    /**
     * @notice Set the reward fees percentage.
     * @dev Updates the rewardsFeesPercentage variable.
     * @param _newRewardFeesPercentage The new reward fees percentage.
     */

    function setRewardFeesPercentage(
        uint _newRewardFeesPercentage
    ) external onlyOwner {
        require(
            _newRewardFeesPercentage <= 100,
            "Reward fees percentage cannot be greater than 100%"
        );
        require(
            _newRewardFeesPercentage >= 0,
            "Reward fees percentage cannot be less than 0%"
        );
        rewardsFeesPercentage = _newRewardFeesPercentage;
        emit RewardsFeesPercentageUpdated(rewardsFeesPercentage);
    }

    /**
     * @notice Set the max lock period in Months.
     * @dev Updates the maxLockPeriod variable.
     * @param _newMaxLockPeriod The new max lock period.
     */

    function setMaxLockPeriodInMonths(
        uint _newMaxLockPeriod
    ) external onlyOwner {
        require(
            _newMaxLockPeriod > 0,
            "Max lock period must be greater than 0"
        );
        maxLockPeriod = _newMaxLockPeriod;
    }

    /**
     * @notice Stake W2R tokens.
     * @dev Allows users to stake their W2R tokens with a specified lock period.
     * @param _amount The amount of W2R tokens to stake.
     * @param lockPeriodInMonths The lock period in months.
     * @param _extend Indicates if the lock period should be extended.
     */

    function stake(
        uint _amount,
        uint lockPeriodInMonths,
        bool _extend
    ) external checkAllowance(_amount) {
        require(msg.sender != address(0), "Invalid address");
        require(_amount >= 1e8, "Amount too small");
        require(
            w2rToken.balanceOf(msg.sender) >= _amount,
            "Not enough tokens to stake"
        );
        StakerInfo storage staker = stakers[msg.sender];
        if (staker.stakedAmount == 0 || (staker.stakedAmount > 0 && _extend)) {
            require(
                lockPeriodInMonths > 0 && lockPeriodInMonths <= maxLockPeriod,
                "Lock period must be between 1 month and maxLockPeriod"
            );
        } else if (staker.stakedAmount > 0 && !_extend) {
            require(lockPeriodInMonths == 0, "Lock period must be 0");
        }
        _updateReward(msg.sender, false);
        if (_extend) {
            require(
                staker.LockInMonths + lockPeriodInMonths <= maxLockPeriod,
                "Cannot extend lock period by more than maxLockPeriod"
            );
            _extendLockPeriod(staker, lockPeriodInMonths, msg.sender);
        } else {
            _updateLockPeriod(staker, lockPeriodInMonths, msg.sender);
        }
        staker.stakedAmount += _amount;
        totalStaking += _amount;
        uint usdAmount = getUSDValue(_amount);
        staker.stakedUSDValue += usdAmount;
        w2rToken.safeTransferFrom(msg.sender, address(this), _amount);
        emit Staked(msg.sender, _amount);
    }

    /**
     * @dev Extends the lock period for the specified user.
     * @param staker The user's struct.
     * @param lockPeriodInMonths The number of months to extend the lock period.
     * @param stakerAddress The user's address.
     */

    function _extendLockPeriod(
        StakerInfo storage staker,
        uint lockPeriodInMonths,
        address stakerAddress
    ) private {
        require(staker.stakedAmount > 0, "Nothing staked");
        require(staker.lockEndTime > block.timestamp, "Lock period ended");
        staker.lockEndTime += lockPeriodInMonths * 30 days;
        staker.LockInMonths += lockPeriodInMonths;
        emit LockPeriodUpdated(
            staker.lockEndTime,
            lockPeriodInMonths,
            stakerAddress
        );
    }

    /**
     * @dev Updates the lock period for the specified user.
     * @param staker The user's struct.
     * @param lockPeriodInMonths The number of months to extend the lock period.
     * @param stakerAddress The user's address.
     */

    function _updateLockPeriod(
        StakerInfo storage staker,
        uint lockPeriodInMonths,
        address stakerAddress
    ) private {
        if (staker.stakedAmount == 0 || staker.lockEndTime < block.timestamp) {
            // initial staking or re-staking after lock period ended
            staker.lockEndTime = block.timestamp + lockPeriodInMonths * 30 days;
            staker.LockInMonths = lockPeriodInMonths;
            staker.resetStakeDate = block.timestamp;
            emit LockPeriodUpdated(
                staker.lockEndTime,
                lockPeriodInMonths,
                stakerAddress
            );
        }
    }

    /**
     * @notice Unstake W2R tokens.
     * @dev Allows users to unstake their W2R tokens with possible penalties.
     * @param _amount The amount of W2R tokens to unstake.
     * @param proportional Indicates if the reward should be proportional to the unstaking amount.
     */

    function unstake(uint _amount, bool proportional) external {
        require(msg.sender != address(0), "Invalid address");
        require(_amount >= 1e8, "Amount too small");
        StakerInfo storage staker = stakers[msg.sender];
        require(
            staker.resetStakeDate + 15 days < block.timestamp,
            "Cannot unstake before 15 days"
        );
        uint usdAmount = getUSDValue(_amount);
        require(staker.stakedAmount >= _amount, "Not enough tokens staked");
        _updateReward(msg.sender, block.timestamp < staker.lockEndTime);
        uint reward;
        if (proportional) {
            reward = (staker.reward * _amount) / staker.stakedAmount;
        } else {
            reward = staker.reward;
        }
        uint unstakeAmount = _amount;
        if (block.timestamp < staker.lockEndTime) {
            uint penaltyAmount = (_amount * earlyUnstakePenalty) / 100;
            unstakeAmount -= penaltyAmount;
            totalPenalties += penaltyAmount;
        }
        if (_amount == staker.stakedAmount) {
            staker.lockEndTime = 0;
            staker.LockInMonths = 0;
        }
        staker.stakedAmount -= _amount;
        totalStaking -= _amount;
        staker.reward -= reward;
        uint fees = (reward * rewardsFeesPercentage) / 100;
        reward -= fees;
        totalW2Rfees += fees;
        // in case of great price fluctuations, the result value can become negative
        if (staker.stakedUSDValue <= usdAmount) {
            staker.stakedUSDValue = 0;
        } else {
            staker.stakedUSDValue -= usdAmount;
        }
        w2rToken.safeTransfer(msg.sender, unstakeAmount);
        vaultW2R.distributeW2R(msg.sender, reward);
        emit Unstaked(msg.sender, _amount);
        emit RewardClaimed(msg.sender, reward);
    }

    /**
     * @notice Claim rewards.
     * @dev Allows users to claim their rewards.
     */

    function claimReward() external {
        require(msg.sender != address(0), "Invalid address");
        require(stakers[msg.sender].stakedAmount > 0, "Nothing to claim");
        StakerInfo storage staker = stakers[msg.sender];
        _updateReward(msg.sender, false);
        uint reward = staker.reward;
        uint fees = (reward * rewardsFeesPercentage) / 100;
        reward -= fees;
        totalW2Rfees += fees;
        staker.reward = 0;
        vaultW2R.distributeW2R(msg.sender, reward);
        emit RewardClaimed(msg.sender, reward);
    }

    /**
     * @dev Calculates the reward for the specified user based on the staked amount and time.
     * @param _staker The user's address.
     * @param earlyUnstake Indicates if the user unstaked before the lock period ended.
     * @notice The reward is calculated as follows:
     * 1. Calculate the staking duration.
     * 2. Calculate the staked amount in USD at the time of staking.
     * 3. Calculate the staked amount in USD at the current time.
     * 4. Calculate the adjustment factor to consider variations of Matic price.
     * 5. Calculate the total staked value.
     * 6. Calculate the adjusted reward multiplier.
     * 7. Calculate the reward.
     * @notice Helper for _getReward() and viewReward() functions
     * @return The calculated reward for the user.
     */

    function _calculateReward(
        address _staker,
        bool earlyUnstake
    ) private view returns (uint) {
        StakerInfo memory staker = stakers[_staker];
        uint stakingDuration = block.timestamp - staker.lastUpdated;
        require(stakingDuration > 0, "Staking duration is 0");
        require(staker.stakedAmount > 0, "Nothing staked");
        uint stakedUSDValueAtTimeOfStaking = staker.stakedUSDValue;
        uint stakedUSDValue = getUSDValue(staker.stakedAmount);
        uint totalStakedValue = getUSDValue(totalStaking);
        require(
            stakedUSDValue > 0 && totalStakedValue > 0,
            "Invalid priceFeed values"
        );
        // adjustment factor to consider variations of Matic price
        uint adjustmentFactor = (stakedUSDValue * 1e18) /
            stakedUSDValueAtTimeOfStaking;
        uint multiplier = calculateMultiplier(_staker, earlyUnstake);
        // Convert in 64x64 fixed point
        int128 scaleFactor64x64 = ABDKMath64x64.divu(1, 100000);
        int128 rewardMultiplier64x64 = ABDKMath64x64.divu(rewardMultiplier, 1);
        int128 totalStakedValue64x64 = ABDKMath64x64.divu(totalStakedValue, 1);
        int128 adjustedRewardMultiplier64x64 = ABDKMath64x64.mul(
            rewardMultiplier64x64,
            ABDKMath64x64.ln(
                ABDKMath64x64.mul(scaleFactor64x64, totalStakedValue64x64)
            )
        );
        uint reward = (stakedUSDValueAtTimeOfStaking *
            stakingDuration *
            adjustedRewardMultiplier64x64.toUInt() *
            adjustmentFactor *
            10000) / (totalStakedValue * 1e18);
        return (reward * multiplier) / precisionFactor;
    }

    /**
     * @notice Calculate the reward multiplier for a given staker.
     * @dev This function calculates the multiplier based on the staker's lock-in period.
     * The multiplier starts from 1, and depends on the lock-in period (1 month to maxLockPeriod).
     * A precision factor is used to handle decimal values.
     * @param _staker The address of the staker.
     * @param earlyUnstake A boolean flag indicating whether the unstaking is done early or not.
     * @return multiplier The calculated multiplier as a uint.
     */

    function calculateMultiplier(
        address _staker,
        bool earlyUnstake
    ) public view returns (uint) {
        StakerInfo memory staker = stakers[_staker];
        if (staker.stakedAmount == 0) return 0;
        if (earlyUnstake) return precisionFactor;
        uint multiplier = staker.LockInMonths * 2 <= 10
            ? precisionFactor
            : (staker.LockInMonths * precisionFactor * 2) / 10;
        return multiplier;
    }

    /**
     * @notice Calculate the annual percentage yield (APY) for staking rewards
     * @dev This function uses a fake staking amount of 100 W2R to calculate the APY based on the current total staking
     * @return apy The calculated annual percentage yield (APY) as a uint
     */

    function viewRewardPercentage() external view returns (uint) {
        if (totalStaking == 0) {
            return 0;
        }
        uint totalStakedValue = getUSDValue(totalStaking);
        uint fakeStaking = getUSDValue(100 * 1e18);
        // Convert in 64x64 fixed point
        int128 scaleFactor64x64 = ABDKMath64x64.divu(1, 100000);
        int128 rewardMultiplier64x64 = ABDKMath64x64.divu(rewardMultiplier, 1);
        int128 totalStakedValue64x64 = ABDKMath64x64.divu(totalStakedValue, 1);
        int128 adjustedRewardMultiplier64x64 = ABDKMath64x64.mul(
            rewardMultiplier64x64,
            ABDKMath64x64.ln(
                ABDKMath64x64.mul(scaleFactor64x64, totalStakedValue64x64)
            )
        );
        uint apy = (fakeStaking *
            3600 *
            24 *
            365 *
            adjustedRewardMultiplier64x64.toUInt() *
            10000) / (totalStakedValue * 1e18);
        return apy;
    }

    /**
     * @dev Returns the reward for the specified user.
     * @notice return the user's reward for the _updateReward function.
     * @param _staker The user's address.
     * @param earlyUnstake A boolean flag indicating whether the unstaking is done early or not.
     * @return The user's reward.
     */

    function _getReward(
        address _staker,
        bool earlyUnstake
    ) private view returns (uint) {
        require(_staker != address(0), "Invalid address");
        require(stakers[_staker].stakedAmount > 0, "Nothing to get");
        uint reward = _calculateReward(_staker, earlyUnstake);
        return reward;
    }

    /**
     * @notice View the user's reward.
     * @dev Allows users to view their reward without claiming.
     * @param _staker The user's address.
     * @return The user's reward.
     */

    function viewReward(address _staker) external view returns (uint) {
        require(_staker != address(0), "Invalid address");
        if (
            stakers[_staker].stakedAmount > 0 &&
            block.timestamp - stakers[_staker].lastUpdated > 0
        ) {
            uint reward = _calculateReward(_staker, false);
            return reward + stakers[_staker].reward;
        } else {
            return 0;
        }
    }

    /**
     * @notice Get the USD value of the specified amount of W2R tokens.
     * @dev Converts the W2R tokens to USD value using the Chainlink oracle price feed.
     * @param _amount The amount of W2R tokens.
     * @return The USD value of the given W2R tokens.
     */

    function getUSDValue(uint _amount) private view returns (uint) {
        require(_amount > 0, "Amount must be greater than 0");
        require(address(priceFeed) != address(0), "Invalid price feed address");
        (, int256 maticPrice, , , ) = priceFeed.latestRoundData();
        require(maticPrice > 0, "Invalid price data from Chainlink");
        uint maticPriceInUSD = uint(maticPrice);
        uint w2rPriceInMATIC = (1 * 1e18) / 10; // 1 W2R = 0.1 MATIC
        uint w2rPriceInUSD = (w2rPriceInMATIC * maticPriceInUSD) / 1e18;
        uint usdValue = (_amount * w2rPriceInUSD) / 1e18;
        // value with 8 decimals
        return usdValue;
    }

    /**
     * @dev Updates the reward for the specified user.
     * @notice Helper function for the stake, unstake and claimReward functions.
     * @param _staker The user's address.
     * @param earlyUnstake A boolean flag indicating whether the unstaking is done early or not.
     */

    function _updateReward(address _staker, bool earlyUnstake) private {
        require(_staker != address(0), "Invalid address");
        StakerInfo storage staker = stakers[_staker];
        require(
            block.timestamp - stakers[_staker].lastUpdated > 0,
            "Staking duration is 0"
        );
        if (stakers[_staker].stakedAmount > 0) {
            uint reward = _getReward(_staker, earlyUnstake);
            staker.reward += reward;
        }
        staker.lastUpdated = block.timestamp;
    }

    /**
     * @notice Withdraw the fees.
     * @dev Allows the owner to withdraw the totalW2Rfees and totalPenalties.
     */

    function withdrawFees() external onlyOwner {
        require(msg.sender != address(0), "Invalid address");
        require(totalW2Rfees + totalPenalties > 0, "Nothing to withdraw");
        uint w2rToSend = totalW2Rfees + totalPenalties;
        totalW2Rfees = 0;
        totalPenalties = 0;
        vaultW2R.updateIncomes(0, w2rToSend, block.timestamp);
        w2rToken.safeTransfer(vaultW2RAddress, w2rToSend);
        emit W2RfeesWithdrawn(vaultW2RAddress, w2rToSend);
    }
}
