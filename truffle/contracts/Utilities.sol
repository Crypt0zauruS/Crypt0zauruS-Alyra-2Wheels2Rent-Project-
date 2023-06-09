// SPDX-License-Identifier: CC-BY-4.0
pragma solidity ^0.8.17;

//import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
//import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
@title I3VaultW2R Interface
@notice This is the interface of the VaultW2R contract that handles distribution of W2R tokens.
*/

interface I3VaultW2R {
    function distributeW2R(address receiver, uint256 amount) external;

    function receiveDepositsWhenDestroyed(
        address _lenderContractOwner,
        address _renterContract,
        address _renterContractOwner,
        uint _date,
        uint _amount
    ) external;
}

/**
 * @title Utilities
 * @author Crypt0zaurus https://www.linkedin.com/in/maxence-a-a82081260
 * @notice A contract for managing utility services and token deposits common to both the Lender and Renter contracts.
 * @dev This contract uses OpenZeppelin's SafeERC20 library to handle the W2R token
 */

contract Utilities {
    using SafeERC20 for IERC20;

    /**
     * @dev Modifier to check if the caller is the contract owner
     */

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    /**
     * @dev Modifier to check if the contract is activated
     */

    modifier isActivated() {
        require(!isDeactivated, "deactivated");
        _;
    }

    /**
     * @dev Modifier to check if the caller has enough allowance for the specified amount
     * @param amount The amount to check for allowance
     */

    modifier checkAllowance(uint amount) {
        require(W2R.allowance(msg.sender, address(this)) >= amount, "approval");
        _;
    }

    event ContractActivated(
        address indexed _owner,
        uint _date,
        address indexed _contractAddress
    );

    event ProposalCancelled(
        address indexed renter,
        uint date,
        address indexed lender
    );

    event W2Rdeposited(
        address indexed _owner,
        uint _amount,
        uint _date,
        address indexed _contractAddress
    );

    event W2Rwithdrawed(
        address indexed _owner,
        uint _amount,
        uint _date,
        address indexed _contractAddress
    );

    event ContractDestroyed(
        address indexed _owner,
        uint _date,
        address indexed _contractAddress
    );

    event GPSupdated(
        address indexed _owner,
        uint _date,
        string _latitude,
        string _longitude,
        address indexed _contractAddress
    );

    event RewardClaimed(
        address indexed _owner,
        uint _date,
        uint _amount,
        address indexed _contractAddress
    );

    uint public totalRentals;
    // safe date to authorize destruction
    uint public safeDate;
    // for historical purpose
    mapping(address => uint) rewards;
    uint totalRewards;
    address public owner;
    bool public isDeactivated;
    IERC20 public W2R;
    uint public rewardAmount = 10; // reward amount in W2R per days of rental
    uint public proposalDuration = 2 days; // duration of the proposal
    uint public minimalRental = 1 days; // minimal rental duration
    bool isDestroyed;

    struct GPS {
        string latitude;
        string longitude;
    }

    mapping(address => GPS) public gpsData;

    /**
     * @notice Constructs a new Utilities contract instance
     * @param _ownerOfContract The address of the contract owner
     * @param _W2Rtoken The address of the W2R token contract
     */

    constructor(
        address _ownerOfContract,
        address _W2Rtoken,
        address _vaultW2R
    ) {
        require(
            _ownerOfContract != address(0) &&
                _W2Rtoken != address(0) &&
                _vaultW2R != address(0)
        );
        owner = _ownerOfContract;
        W2R = IERC20(_W2Rtoken);
        vaultW2R = I3VaultW2R(_vaultW2R);
        isDeactivated = true;
    }

    I3VaultW2R vaultW2R;

    /**
     * @notice Sets the GPS location of the contract owner
     * @param _latitude The latitude of the owner's location
     * @param _longitude The longitude of the owner's location
     */

    function setGPS(
        string calldata _latitude,
        string calldata _longitude
    ) public onlyOwner {
        require(!isDestroyed, "destroyed");
        require(
            bytes(_latitude).length > 0 && bytes(_longitude).length > 0,
            "no GPS"
        );
        GPS storage gps = gpsData[address(this)];
        gps.latitude = _latitude;
        gps.longitude = _longitude;

        emit GPSupdated(
            msg.sender,
            block.timestamp,
            _latitude,
            _longitude,
            address(this)
        );
    }

    /**
     * @notice Activates the contract and sets the GPS location of the contract owner
     * @param _latitude The latitude of the owner's location
     * @param _longitude The longitude of the owner's location
     */

    function activate(
        string calldata _latitude,
        string calldata _longitude
    ) external onlyOwner {
        require(isDeactivated && !isDestroyed, "unavailable");
        require(
            bytes(_latitude).length > 0 && bytes(_longitude).length > 0,
            "no GPS"
        );
        setGPS(_latitude, _longitude);
        isDeactivated = false;
        emit ContractActivated(msg.sender, block.timestamp, address(this));
    }

    /**
     * @notice Deposits W2R tokens to the contract
     * @param _amount The amount of W2R tokens to deposit
     */

    function depositW2R(
        uint _amount
    ) external isActivated checkAllowance(_amount) {
        require(_amount > 0, "bad");
        require(W2R.balanceOf(msg.sender) >= _amount, "Insufficient");
        W2R.safeTransferFrom(msg.sender, address(this), _amount);
        emit W2Rdeposited(msg.sender, _amount, block.timestamp, address(this));
    }

    /**
     * @notice Returns the total rewards accumulated by the contract
     * @return The total rewards
     */

    function getTotalRewards()
        external
        view
        isActivated
        onlyOwner
        returns (uint)
    {
        return totalRewards;
    }

    /**
     * @notice Claim the accumulated rewards for the contract owner.
     * @dev This function can only be called by the contract owner and when the staking contract is activated.
     * The total rewards are set to zero after claiming, and the rewards are distributed through the vault.
     */

    function claimRewards() external isActivated onlyOwner {
        require(totalRewards > 0, "nothing");
        uint amount = totalRewards;
        totalRewards = 0;
        vaultW2R.distributeW2R(msg.sender, amount);
        emit RewardClaimed(msg.sender, block.timestamp, amount, address(this));
    }
}
