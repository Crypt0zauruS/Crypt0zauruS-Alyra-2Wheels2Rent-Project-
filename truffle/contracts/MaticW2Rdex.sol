// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface I5VaultW2R {
    function distributeW2R(address receiver, uint amount) external;
}

interface IMaticW2RPairToken is IERC20 {
    function checkMinterAndBurner(
        address authorized
    ) external view returns (bool);

    function addMinterAndBurner(address authorized) external;

    function removeMinterAndBurner(address authorized) external;

    function mint(address to, uint amount) external;

    function burn(uint256 amount) external;
}

contract MaticW2Rdex is Ownable {
    using SafeERC20 for IERC20;
    using SafeERC20 for IMaticW2RPairToken;
    IERC20 public W2R;
    IMaticW2RPairToken public lpToken;
    uint public swapRate;
    uint public totalMaticLiquidity;
    uint public totalW2RLiquidity;
    uint public rewardRatePerSecond;
    uint public securityPercentage;
    uint public totalMaticFees;
    uint public totalW2RFees;
    uint public feesPercent;

    I5VaultW2R vaultW2R;

    mapping(address => uint) public LPBalance;
    mapping(address => Farming) public farming;

    struct Farming {
        uint lastTime;
        uint lpAmount;
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

    constructor(
        address W2RAddress,
        uint initialSwapRate,
        address vaultW2RAddress,
        address lpTokenAddress
    ) {
        require(W2RAddress != address(0), "W2R address cannot be 0x0");
        require(initialSwapRate > 0, "Swap rate must be greater than 0");
        require(
            vaultW2RAddress != address(0),
            "Vault W2R address cannot be 0x0"
        );
        W2R = IERC20(W2RAddress);
        lpToken = IMaticW2RPairToken(lpTokenAddress);
        swapRate = initialSwapRate;
        rewardRatePerSecond = 10 ** 11; // 30% de la valeur initiale MATIC-W2R récompensée en W2R par an
        vaultW2R = I5VaultW2R(vaultW2RAddress);
        securityPercentage = 5;
        feesPercent = 1;
    }

    modifier checkLPAmount(uint lpAmount) {
        require(lpAmount > 0, "LP amount must be greater than 0");

        require(
            checkLPAllowance(msg.sender) >= lpAmount,
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

    function getContractBalances() external view returns (uint, uint, uint) {
        // W2R, MATIC, LP
        return (
            W2R.balanceOf(address(this)),
            address(this).balance,
            lpToken.balanceOf(address(this))
        );
    }

    function getUserBalances() external view returns (uint, uint, uint) {
        return (
            W2R.balanceOf(msg.sender),
            msg.sender.balance,
            lpToken.balanceOf(msg.sender)
        );
    }

    function checkIfAuthorizedInLPcontract(
        address _toCheck
    ) public view returns (bool) {
        return lpToken.checkMinterAndBurner(_toCheck);
    }

    function setAuthorizedInLPcontract(address _authorized) external onlyOwner {
        lpToken.addMinterAndBurner(_authorized);
    }

    function removeAuthorizedInLPcontract(
        address _authorized
    ) external onlyOwner {
        lpToken.removeMinterAndBurner(_authorized);
    }

    function checkW2Rallowance(address _W2Rowner) public view returns (uint) {
        return W2R.allowance(_W2Rowner, address(this));
    }

    function checkLPAllowance(address _LPowner) public view returns (uint) {
        return lpToken.allowance(_LPowner, address(this));
    }

    function swapMaticForW2R() external payable {
        require(msg.value > 0, "MATIC amount must be greater than 0");
        require((msg.value * feesPercent * 100) >= 10000);
        uint fees = (msg.value * feesPercent * 100) / 10000;
        uint w2rAmount = (msg.value - fees) * swapRate;
        require(w2rAmount > 0, "W2R amount must be greater than 0");
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

    // entrer un montant incluant les décimales, en wei, pour matic et W2R
    function swapW2RForMatic(uint w2rAmount) external {
        bool guard;
        require(!guard, "ReentrancyGuard: reentrant call");
        require(msg.sender.balance > 0, "MATIC balance must be greater than 0");
        require(w2rAmount > 0, "W2R amount must be greater than 0");
        require(
            checkW2Rallowance(msg.sender) >= w2rAmount,
            "You need to approve W2R first"
        );
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
        guard = true;
        (bool success, ) = payable(msg.sender).call{value: maticAmount - fee}(
            ""
        );
        guard = false;
        require(success, "Transfer failed.");
        emit SwapW2RForMatic(
            msg.sender,
            w2rAmount,
            maticAmount,
            block.timestamp
        );
    }

    function addLiquidity(uint w2rAmount) external payable {
        require(w2rAmount > 0, "W2R amount must be greater than 0");
        require(msg.value > 0, "MATIC amount must be greater than 0");
        require(
            checkW2Rallowance(msg.sender) >= w2rAmount,
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
            lpAmount = maticAmount; // Initial liquidity is 1:1
            totalMaticLiquidity = maticAmount;
            totalW2RLiquidity = w2rAmount;
        } else {
            uint totalLiquidity = totalMaticLiquidity +
                totalW2RLiquidity /
                swapRate;
            lpAmount = (maticAmount * 1e18) / totalLiquidity;
            // prevent a user to have too much power on the contract
            require(
                (lpToken.totalSupply() * securityPercentage * 100) >= 10000
            );
            require(
                lpAmount + LPBalance[msg.sender] <=
                    (lpToken.totalSupply() * securityPercentage * 100) / 10000,
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

    function removeLiquidity(uint lpAmount) external checkLPAmount(lpAmount) {
        bool guard;
        require(!guard, "ReentrancyGuard: reentrant call");
        require(lpToken.totalSupply() > 0, "No liquidity to remove");
        require(
            totalMaticLiquidity > 0 && totalW2RLiquidity > 0,
            "No liquidity to remove"
        );
        // Calculate the amount of MATIC and W2R to refund to the user based on existing LP tokens
        uint maticAmount = (lpAmount * totalMaticLiquidity) /
            lpToken.totalSupply();
        uint w2rAmount = (lpAmount * totalW2RLiquidity) / lpToken.totalSupply();
        // update liquidity
        LPBalance[msg.sender] -= lpAmount;
        totalMaticLiquidity -= maticAmount;
        totalW2RLiquidity -= w2rAmount;
        W2R.safeTransfer(msg.sender, w2rAmount);
        lpToken.transferFrom(msg.sender, address(this), lpAmount);
        lpToken.burn(lpAmount);
        // Send MATIC funds using call instead of transfer
        guard = true;
        (bool success, ) = payable(msg.sender).call{value: maticAmount}("");
        guard = false;
        require(success, "Failed to send MATIC");
        emit RemoveLiquidity(msg.sender, maticAmount, w2rAmount, lpAmount);
    }

    function farm(uint lpAmount) external checkLPAmount(lpAmount) {
        // check if user has already farmed
        LPBalance[msg.sender] -= lpAmount;
        // update farming struct
        farming[msg.sender].lpAmount += lpAmount;
        lpToken.safeTransferFrom(msg.sender, address(this), lpAmount);
        farming[msg.sender].lastTime = block.timestamp;
        emit Farm(msg.sender, lpAmount, block.timestamp);
    }

    function exitFarm() external {
        uint lpBalance = farming[msg.sender].lpAmount;
        require(lpBalance > 0, "No LP tokens to claim rewards");
        harvest();
        farming[msg.sender].lpAmount -= lpBalance;
        LPBalance[msg.sender] += lpBalance;
        lpToken.safeTransfer(msg.sender, lpBalance);
        emit ExitFarm(msg.sender, lpBalance, block.timestamp);
    }

    function calculateReward(address user) private returns (uint) {
        require(user != address(0), "Invalid address");
        uint lpBalance = farming[msg.sender].lpAmount;
        uint timeElapsed = block.timestamp - farming[user].lastTime;
        uint basis = lpBalance * timeElapsed * rewardRatePerSecond;
        require((basis * feesPercent * 100) >= 10000);
        uint fees = (basis * feesPercent * 100) / 10000;
        uint reward = basis - fees;
        totalW2RFees += fees;
        return reward;
    }

    function harvest() public {
        uint lpBalance = farming[msg.sender].lpAmount;
        require(lpBalance > 0, "No LP tokens to claim rewards");
        uint reward = calculateReward(msg.sender);
        require(reward > 0, "No rewards available");
        // distribute rewards from vault to user
        vaultW2R.distributeW2R(msg.sender, reward);
        farming[msg.sender].lastTime = block.timestamp;
        emit Harvest(msg.sender, reward, block.timestamp);
    }

    function setSwapRate(uint newSwapRate) external onlyOwner {
        require(newSwapRate > 0, "Swap rate must be greater than 0");
        swapRate = newSwapRate;
    }

    function setRewardRate(uint _newRewardRate) external onlyOwner {
        require(_newRewardRate > 0, "Reward rate must be greater than 0");
        rewardRatePerSecond = _newRewardRate;
    }

    function setSecurityPercentage(
        uint _newSecurityPercentage
    ) external onlyOwner {
        require(
            _newSecurityPercentage > 0 && _newSecurityPercentage <= 100,
            "Security percentage must be greater than 0 and less than or equal to 100"
        );
        securityPercentage = _newSecurityPercentage;
    }

    function withdrawFees() external onlyOwner {
        if (totalW2RFees > 0) {
            vaultW2R.distributeW2R(msg.sender, totalW2RFees);
            totalW2RFees = 0;
        }
        require(totalMaticFees > 0, "No fees to withdraw");
        totalMaticFees = 0;
        (bool success, ) = payable(msg.sender).call{value: totalMaticFees}("");
        require(success, "Failed to withdraw fees");
    }

    receive() external payable {}
}