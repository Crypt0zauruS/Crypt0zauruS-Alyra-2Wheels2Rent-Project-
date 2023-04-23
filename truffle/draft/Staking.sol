// SPDX-License-Identifier: CC-BY-4.0
pragma solidity ^0.8.0;

import "../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

interface I6VaultW2R {
    function distributeW2R(address receiver, uint amount) external;
}

contract W2RStaking is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public w2rToken;
    AggregatorV3Interface internal priceFeed;

    struct StakerInfo {
        uint stakedAmount;
        uint lastUpdated;
        uint reward;
    }

    uint public lockPeriod = 30 days;
    uint public earlyUnstakePenalty = 10; // 10% penalty for early unstaking
    uint public totalStakedValue;
    uint public rewardMultiplier = 1e18;

    mapping(address => StakerInfo) public stakers;

    // import VaultW2R interface
    I6VaultW2R private vaultW2R;

    event Staked(address indexed user, uint amount);
    event Unstaked(address indexed user, uint amount);
    event RewardClaimed(address indexed user, uint amount);
    event RewardMultiplierUpdated(uint newRewardMultiplier);
    event LockPeriodUpdated(uint newLockPeriod);
    event EarlyUnstakePenaltyUpdated(uint newEarlyUnstakePenalty);

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
    }

    modifier checkAllowance(uint amount) {
        require(
            w2rToken.allowance(msg.sender, address(this)) >= amount,
            "Need approval for this amount"
        );
        _;
    }

    function setLockPeriod(uint _newLockPeriod) external onlyOwner {
        require(_newLockPeriod > 0, "Lock period cannot be 0");
        lockPeriod = _newLockPeriod;
        emit LockPeriodUpdated(_newLockPeriod);
    }

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

    function stake(uint _amount) external checkAllowance(_amount) {
        require(msg.sender != address(0), "Invalid address");
        require(_amount > 0, "Staking amount must be greater than 0");
        require(
            w2rToken.balanceOf(msg.sender) >= _amount,
            "Not enough tokens to stake"
        );
        w2rToken.safeTransferFrom(msg.sender, address(this), _amount);
        StakerInfo storage staker = stakers[msg.sender];
        _updateReward(msg.sender);
        staker.stakedAmount += _amount;
        staker.lastUpdated = block.timestamp;
        totalStakedValue += getUSDValue(_amount);
        emit Staked(msg.sender, _amount);
    }

    function unstake(uint _amount) external {
        require(msg.sender != address(0), "Invalid address");
        require(_amount > 0, "Unstaking amount must be greater than 0");
        StakerInfo storage staker = stakers[msg.sender];
        require(staker.stakedAmount >= _amount, "Not enough tokens staked");
        require(
            block.timestamp >= staker.lastUpdated + lockPeriod,
            "Tokens are still locked"
        );

        _updateReward(msg.sender);
        uint reward = staker.reward;
        uint unstakeAmount = _amount;

        if (block.timestamp < staker.lastUpdated + lockPeriod) {
            uint penaltyAmount = (_amount * earlyUnstakePenalty) / 100;
            unstakeAmount -= penaltyAmount;
        }

        w2rToken.safeTransfer(msg.sender, unstakeAmount);
        w2rToken.safeTransfer(msg.sender, reward);

        staker.stakedAmount -= _amount;
        staker.reward = 0;
        totalStakedValue -= getUSDValue(_amount);

        emit Unstaked(msg.sender, _amount);
        emit RewardClaimed(msg.sender, reward);
    }

    function claimReward() external {
        require(msg.sender != address(0), "Invalid address");
        require(stakers[msg.sender].stakedAmount > 0, "Nothing to claim");
        StakerInfo storage staker = stakers[msg.sender];
        _updateReward(msg.sender);
        uint reward = staker.reward;
        staker.reward = 0;
        //w2rToken.safeTransfer(msg.sender, reward);
        vaultW2R.distributeW2R(msg.sender, reward);
        emit RewardClaimed(msg.sender, reward);
    }

    function _getReward(address _staker) private view returns (uint) {
        require(_staker != address(0), "Invalid address");
        require(stakers[_staker].stakedAmount > 0, "Nothing to get");
        StakerInfo memory staker = stakers[_staker];
        uint stakingDuration = block.timestamp - staker.lastUpdated;
        uint stakedUSDValue = getUSDValue(staker.stakedAmount);
        uint reward = (stakedUSDValue * stakingDuration * rewardMultiplier) /
            totalStakedValue;
        return reward;
    }

    function _updateReward(address _staker) private {
        require(_staker != address(0), "Invalid address");
        require(stakers[_staker].stakedAmount > 0, "Nothing to update");
        StakerInfo storage staker = stakers[_staker];
        uint reward = _getReward(_staker);
        staker.reward += reward;
        staker.lastUpdated = block.timestamp;
    }

    function getUSDValue(uint _amount) public view returns (uint) {
        require(_amount > 0, "Amount must be greater than 0");
        require(address(priceFeed) != address(0), "Invalid price feed address");
        (, int256 maticPrice, , , ) = priceFeed.latestRoundData();
        require(maticPrice > 0, "Invalid price data from Chainlink");
        uint maticPriceInUSD = uint(maticPrice) * 1e10; // Multiply by 1e10 to avoid decimals
        uint w2rPriceInMATIC = (1 * 1e18) / 10; // 1 W2R = 0.1 MATIC
        uint w2rPriceInUSD = (w2rPriceInMATIC * maticPriceInUSD) / 1e18; // Divide by 1e18 to remove the extra 1e10 factor
        uint usdValue = (_amount * w2rPriceInUSD) / 1e18;
        return usdValue;
    }

    function updateRewardMultiplier(
        uint _newRewardMultiplier
    ) external onlyOwner {
        require(
            _newRewardMultiplier > 0,
            "Reward multiplier must be greater than 0"
        );
        rewardMultiplier = _newRewardMultiplier;
        emit RewardMultiplierUpdated(_newRewardMultiplier);
    }
}
