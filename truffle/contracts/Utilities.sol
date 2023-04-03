// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Utilities {
    using SafeERC20 for IERC20;

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    modifier isActivated() {
        require(!isDeactivated, "Contract deactivated");
        _;
    }

    modifier checkAllowance(uint amount) {
        require(
            W2R.allowance(msg.sender, address(this)) >= amount,
            "Need approval"
        );
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

    uint public totalRentals;

    mapping(address => uint) rewards;
    uint totalRewards;
    address public owner;
    bool public isDeactivated;
    IERC20 public W2R;
    uint public rewardAmount = 10; // pourcentage à récompenser pour chaque location
    uint public proposalDuration = 2 days; // Durée de la proposition de location
    uint public minimalRental = 1 days; // Durée minimale de location
    bool isDestroyed;

    struct GPS {
        string latitude;
        string longitude;
    }

    mapping(address => GPS) public gpsData;

    constructor(address _ownerOfContract, address _W2Rtoken) {
        require(_ownerOfContract != address(0));
        require(_W2Rtoken != address(0));
        owner = _ownerOfContract;
        W2R = IERC20(_W2Rtoken);
        isDeactivated = true;
    }

    function setGPS(
        string calldata _latitude,
        string calldata _longitude
    ) public onlyOwner {
        require(!isDestroyed, "Destroyed");
        require(
            bytes(_latitude).length > 0 && bytes(_longitude).length > 0,
            "GPS empty"
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

    function activate(
        string calldata _latitude,
        string calldata _longitude
    ) external onlyOwner {
        require(isDeactivated && !isDestroyed, "Activated or destroyed");
        require(
            bytes(_latitude).length > 0 && bytes(_longitude).length > 0,
            "GPS cannot be empty"
        );
        setGPS(_latitude, _longitude);
        isDeactivated = false;
        emit ContractActivated(msg.sender, block.timestamp, address(this));
    }

    // fonction pour déposer des W2R
    function depositW2R(
        uint _amount
    ) external isActivated checkAllowance(_amount) {
        require(_amount > 0, "Bad amount");
        require(W2R.balanceOf(msg.sender) >= _amount, "Insufficient W2R");
        W2R.safeTransferFrom(msg.sender, address(this), _amount);
        emit W2Rdeposited(msg.sender, _amount, block.timestamp, address(this));
    }

    function getTotalRewards()
        external
        view
        isActivated
        onlyOwner
        returns (uint)
    {
        return totalRewards;
    }
}
