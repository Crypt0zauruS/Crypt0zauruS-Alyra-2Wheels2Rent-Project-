// SPDX-License-Identifier: CC-BY-4.0
pragma solidity ^0.8.17;

//import "@openzeppelin/contracts/interfaces/IERC721.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./Utilities.sol";

/**
 * @dev Interface of the WhitelistRenters contract.
 */

interface IlenderWhitelist {
    struct Lender {
        bool isWhitelisted;
        address bikeShareContract;
        uint NFTId;
    }

    function whitelistedAddresses(
        address
    ) external view returns (Lender memory);
}

/**
 * @dev Interface of the BikeShare contract.
 */

interface IBikeShare {
    // to call the function setProposal of the BikeShare contract
    function setProposal(
        address _owner,
        uint _dateMin,
        uint _dateMax,
        uint _rentalTime,
        uint _rate,
        uint depositAmount,
        uint date,
        string calldata _latitude,
        string calldata _longitude
    ) external;

    function returnedBike(address _bikeRentOwner) external;

    function maximumRental() external view returns (uint);

    function rate() external view returns (uint);

    function depositAmount() external view returns (uint);

    function cancelledRenting(address _bikeRentOwner) external;

    function getProposalsLength() external view returns (uint);
}

/**
 * @title BikeRent
 * @author Crypt0zaurus https://www.linkedin.com/in/maxence-a-a82081260
 * @dev The contract interacts with BikeShare contracts, LenderWhitelist, and VaultW2R contracts.
 * It uses the Utilities contract as a base and implements SafeERC20 to handle token transfers.
 */

contract BikeRent is Utilities {
    using SafeERC20 for IERC20;
    IBikeShare bikeShare;
    address whitelistRenter;
    address lenderNFT;
    address whitelistLender;
    bool public isRenting;

    event ProposalMade(
        address indexed renter,
        uint date,
        address indexed lender,
        uint rentalDateMin,
        uint rentalDateMax,
        uint rentalTime,
        uint rate,
        uint depositAmount,
        string latitude,
        string longitude
    );

    event RentalStarted(
        address indexed renter,
        uint date,
        uint rentalTime,
        uint rentalPrice,
        uint deposit,
        uint amountRequired,
        bool _propalCancellation,
        address indexed lender
    );

    event RentalCancelled(
        address indexed lender,
        uint date,
        uint refund,
        uint returnDate,
        address indexed renter
    );

    event RentalDeclaredAsReturned(
        address indexed lender,
        uint date,
        address indexed renter,
        string latitude,
        string longitude
    );
    event RentalReturned(
        uint rentalDate,
        address indexed lender,
        uint date,
        address indexed renter,
        string latitude,
        string longitude
    );

    event BikeTaken(
        address indexed lender,
        uint date,
        address indexed renter,
        string latitude,
        string longitude
    );

    struct Rental {
        uint date;
        uint rentalTime;
        uint rentalPrice;
        uint depositAmount;
        uint rewardExpected;
        bool isReturned;
        bool isRefunded;
        bool seemsReturned;
        bool cantCancel;
        string rentalToken;
    }

    struct RentalToken {
        uint time;
        string rentalToken;
    }

    RentalToken private rentalToken;

    struct ProposalsMade {
        uint date; // time of the proposal
        address lender; // address of the lender
        uint rentalDateMin; // date of the rental, minimum hour of RDV
        uint rentalDateMax; // date of the rental, maximum hour of RDV
        uint rentalTime; // rental time proposed
        uint rate; // rate of the rental
        uint depositAmount; // deposit amount
        bool isAccepted; // booléen pour savoir si la proposition a été acceptée
    }

    struct DailyCalls {
        uint256 lastResetTimestamp;
        uint256 dailyCallCount;
    }
    mapping(address => DailyCalls) private userProposalCalls;
    mapping(address => DailyCalls) private userRentalCalls;
    mapping(address => DailyCalls) private userTokenCalls;
    uint private constant DAY_SECONDS = 24 hours;
    uint private constant DAILY_CALL_LIMIT = 3;

    // instantiate IlenderWhitelist interface
    IlenderWhitelist private LenderWhitelist;

    ProposalsMade[] public proposalsMade;

    // mapping of the address of the lender to an array of Rental structs (one for each rental)
    // as a lender can have multiple rentals from a renter
    mapping(address => Rental[]) public rentals;

    address public currentLender;

    constructor(
        address _renter,
        address _W2Rtoken,
        address _lenderNFT,
        address _whitelistRenter,
        address _vaultW2R,
        address _whitelistLender
    ) Utilities(_renter, _W2Rtoken, _vaultW2R) {
        require(
            _lenderNFT != address(0) &&
                _whitelistRenter != address(0) &&
                _whitelistLender != address(0),
            "bad address"
        );
        require(msg.sender == _whitelistRenter, "Only wl");
        lenderNFT = _lenderNFT;
        whitelistRenter = _whitelistRenter;
        whitelistLender = _whitelistLender;
    }

    /**
     * @dev Modifier to check if the bikeShare owner has a valid NFT and if the bikeShare contract is whitelisted.
     * @param _bikeShareOwner The address of the bikeShare owner.
     */

    modifier checkLenderNFT(address _bikeShareOwner) {
        require(IERC721(lenderNFT).balanceOf(_bikeShareOwner) > 0, "No NFT");
        LenderWhitelist = IlenderWhitelist(whitelistLender);
        require(
            LenderWhitelist.whitelistedAddresses(_bikeShareOwner).isWhitelisted,
            "Not wl"
        );
        // check if msg.sender corresponding to bikeshare contract in struct of whitelisted _bikeShareOwner
        require(
            LenderWhitelist
                .whitelistedAddresses(_bikeShareOwner)
                .bikeShareContract == msg.sender,
            "Not wl"
        );
        _;
    }

    /**
     * @dev Modifier to check if the contract is in a renting state.
     */

    modifier renting() {
        require(isRenting && currentLender != address(0), "No lender");
        require(
            bytes(gpsData[address(this)].latitude).length > 0 &&
                bytes(gpsData[address(this)].longitude).length > 0,
            "no GPS"
        );
        _;
    }

    /**
     * @dev Modifier to limit the rate of user actions.
     * @param userAction The mapping of the user action to check.
     */

    modifier rateLimited(mapping(address => DailyCalls) storage userAction) {
        DailyCalls storage dailyCalls = userAction[msg.sender];
        if (block.timestamp - dailyCalls.lastResetTimestamp >= DAY_SECONDS) {
            dailyCalls.dailyCallCount = 0;
            dailyCalls.lastResetTimestamp = block.timestamp;
        }
        require(dailyCalls.dailyCallCount < DAILY_CALL_LIMIT, "Limit reached");
        dailyCalls.dailyCallCount++;
        _;
    }

    modifier validToken(string calldata lenderTempToken) {
        require(msg.sender == currentLender, "Only lender");
        require(
            bytes(rentalToken.rentalToken).length == 30 &&
                bytes(lenderTempToken).length == 30 &&
                keccak256(abi.encodePacked(lenderTempToken)) ==
                keccak256(abi.encodePacked(rentalToken.rentalToken)),
            "Invalid"
        );
        require(
            rentalToken.time > 0 &&
                block.timestamp - rentalToken.time <= 1 minutes,
            "expired"
        );
        _;
    }

    /**
     * @notice Retrieve the number of rentals for a given renter's address.
     * @param renter The address of the renter.
     */

    function getRentalsByAdresses(address renter) external view returns (uint) {
        return rentals[renter].length;
    }

    /**
     * @notice Retrieve expired proposals made from bikeShare contracts and delete them.
     * @dev Helper function to delete expired proposals.
     */

    function deleteOldProposals() private returns (bool) {
        uint i;
        while (i < proposalsMade.length) {
            if (block.timestamp - proposalsMade[i].date > proposalDuration) {
                cancelUselessProposals(i);
            } else {
                i++;
            }
        }
        return true;
    }

    /**
    @notice Allows renters to make rental proposals for bikes available on the platform.
    @dev The proposal must include all necessary details such as the desired meeting for rental dates range and rental duration.
    @dev Call the setProposal function of the bikeShare contract to set the proposal.
    @param _bikeShareContract The address of the bikeShare contract.
    @param _dateMin The minimum date of the meeting for rental.
    @param _dateMax The maximum date of the meeting for rental.
    @param _rentalTime The rental time proposed.
    */

    function makeProposal(
        address _bikeShareContract,
        uint _dateMin,
        uint _dateMax,
        uint _rentalTime
    ) public isActivated onlyOwner rateLimited(userProposalCalls) {
        require(
            _bikeShareContract != address(0) &&
                _bikeShareContract != owner &&
                _bikeShareContract != address(this),
            "Invalid address"
        );
        require(deleteOldProposals());
        for (uint i; i < proposalsMade.length; i++) {
            if (proposalsMade[i].lender == _bikeShareContract) {
                revert("already made");
            }
        }
        require(_rentalTime > 0 && _dateMin > 0 && _dateMax > 0, "bad values");
        require(_dateMin > block.timestamp + 10000, "too soon");
        require(
            _rentalTime % 1 days == 0 &&
                _rentalTime >= minimalRental &&
                _dateMax - _dateMin >= 3 hours &&
                _dateMax - _dateMin <= 12 hours,
            "bad time"
        );
        require(proposalsMade.length < 3, "Only 3");
        require(
            bytes(gpsData[address(this)].latitude).length > 0 &&
                bytes(gpsData[address(this)].longitude).length > 0,
            "no GPS"
        );
        bikeShare = IBikeShare(_bikeShareContract);
        require(bikeShare.getProposalsLength() < 5, "Only 5");
        require(_rentalTime <= bikeShare.maximumRental(), "too long");
        uint _rate = bikeShare.rate();
        uint _depositAmount = bikeShare.depositAmount();
        require(
            W2R.balanceOf(address(this)) >=
                _depositAmount + _rate * (_rentalTime / 1 days),
            "Not enough"
        );
        // call the setProposal function of the BikeShare contract
        bikeShare.setProposal(
            owner,
            _dateMin,
            _dateMax,
            _rentalTime,
            _rate,
            _depositAmount,
            block.timestamp,
            gpsData[address(this)].latitude,
            gpsData[address(this)].longitude
        );
        // push the proposal to the proposalsMade array
        proposalsMade.push(
            ProposalsMade(
                block.timestamp, // date of the proposal
                _bikeShareContract, // address of the BikeShare contract
                _dateMin, // date of the rental proposed, minimum hour
                _dateMax, // date of the rental proposed, maximum hour
                _rentalTime, // rental time proposed
                _rate, // rate at the time of the proposal
                _depositAmount, // depositAmount at the time of the proposal
                false // isAccepted
            )
        );
        emit ProposalMade(
            address(this), // address of the renter contract
            block.timestamp, // date of the proposal
            _bikeShareContract, // address of the BikeShare contract
            _dateMin, // date of the rental proposed, minimum hour
            _dateMax, // date of the rental proposed, maximum hour
            _rentalTime, // rental time proposed
            _rate, // rate at the time of the proposal
            _depositAmount,
            gpsData[address(this)].latitude,
            gpsData[address(this)].longitude
        );
    }

    /**
     * @notice Retrieve the number of proposals in proposalsMade array.
     */

    function getProposalsLength() external view returns (uint) {
        return proposalsMade.length;
    }

    /**
     * @notice Returns the length of rentals array for a specific lender
     * @param lender The address of the lender
     * @return Length of rentals array for the given lender
     */

    function getRentalsLength(address lender) external view returns (uint) {
        return rentals[lender].length;
    }

    function setRentalToken(
        string calldata _rentalToken
    ) external onlyOwner isActivated renting rateLimited(userTokenCalls) {
        rentalToken.time = block.timestamp;
        rentalToken.rentalToken = _rentalToken;
    }

    /**
     * @notice Rent a bike after accepting a proposal
     * @dev The lender's BikeShare must have accepted a proposal, and this function is remotely called
     * from the BikeShare contract.
     * @param _bikeShareOwner The address of the bike share owner
     * @param _rentalPrice The rental price of the bike
     * @param _depositAmount The deposit amount for the bike
     * @param _rentalTime The rental time for the bike
     * @param _rentalDate The date when the rental begins
     */

    function rentBike(
        address _bikeShareOwner,
        uint _rentalPrice,
        uint _depositAmount,
        uint _rentalTime,
        uint _rentalDate
    )
        external
        isActivated
        checkLenderNFT(_bikeShareOwner)
        rateLimited(userRentalCalls)
    {
        require(
            !isRenting &&
                currentLender == address(0) &&
                msg.sender != address(0),
            "bad renting"
        );
        require(
            bytes(gpsData[address(this)].latitude).length > 0 &&
                bytes(gpsData[address(this)].longitude).length > 0,
            "no GPS"
        );
        uint _amountRequired = _rentalPrice + _depositAmount;
        require(
            W2R.balanceOf(address(this)) >= _amountRequired,
            "Insufficient"
        );
        bool proposalFound;
        uint i;
        uint dateMax;
        uint rentalTime = _rentalTime;
        for (i = 0; i < proposalsMade.length; i++) {
            if (proposalsMade[i].lender == msg.sender) {
                ProposalsMade memory proposal = proposalsMade[i];
                require(
                    block.timestamp - proposal.date <= proposalDuration,
                    "expired"
                );
                require(!proposal.isAccepted, "accepted");
                require((_rentalPrice * rewardAmount * 100) >= 10000);
                uint rentalPrice = _rentalPrice;
                dateMax = proposal.rentalDateMax;
                uint reward = (rentalPrice * rewardAmount * 100) / 10000;
                proposal.isAccepted = true;
                isRenting = true;
                uint rentalDate = _rentalDate;
                uint depositAmount = _depositAmount;
                uint amountRequired = _amountRequired;
                rentals[msg.sender].push(
                    Rental(
                        rentalDate,
                        rentalTime,
                        rentalPrice,
                        depositAmount,
                        reward,
                        false,
                        false,
                        false,
                        false,
                        ""
                    )
                );
                currentLender = msg.sender;
                totalRentals++;
                safeDate = rentalDate + rentalTime + 2 days;
                W2R.safeTransfer(msg.sender, _amountRequired);
                emit RentalStarted(
                    msg.sender,
                    rentalDate,
                    proposal.rentalTime,
                    rentalPrice,
                    depositAmount,
                    amountRequired,
                    false,
                    currentLender
                );
                proposalFound = true;
                break;
            }
        }
        require(proposalFound, "No found");
        // delete proposal from the renter as it has been accepted
        cancelUselessProposals(i);
        //delete proposal which date is before the rental date
        for (uint j; j < proposalsMade.length; j++) {
            if (j != i && proposalsMade[j].date < (dateMax + rentalTime)) {
                cancelUselessProposals(j);
            }
        }
    }

    /**
     * @notice Cancel proposals that are no longer useful
     * @dev This is a helper function
     * @param index The index of the proposal in proposalsMade array
     * @return true if the proposal is successfully cancelled, false otherwise
     */

    function cancelUselessProposals(uint index) private returns (bool) {
        address lender = proposalsMade[index].lender;
        uint256 date = proposalsMade[index].date;
        proposalsMade[index] = proposalsMade[proposalsMade.length - 1];
        proposalsMade.pop();
        emit ProposalCancelled(address(this), date, lender);
        return true;
    }

    /**
     * @notice Cancel a proposal made by the owner
     * @param _bikeShareContract The address of the bike share contract
     */

    function cancelProposal(
        address _bikeShareContract
    ) public isActivated onlyOwner {
        require(
            _bikeShareContract != address(0) &&
                _bikeShareContract != owner &&
                _bikeShareContract != address(this),
            "Invalid"
        );
        require(proposalsMade.length > 0, "No found");
        uint i;
        while (i < proposalsMade.length) {
            if (proposalsMade[i].lender == _bikeShareContract) {
                require(proposalsMade[i].isAccepted == false, "accepted");
                cancelUselessProposals(i);
                break;
            } else {
                i++;
            }
        }
    }

    /**
     * @notice Confirm the bike is in renter's hands
     * @dev This function is called by the lender's BikeShare contract to confirm that the bike is taken
     * @param _bikeShareOwner The address of the bike share owner
     */

    function confirmBikeInHands(
        address _bikeShareOwner,
        string calldata lenderTempToken
    )
        external
        isActivated
        checkLenderNFT(_bikeShareOwner)
        renting
        validToken(lenderTempToken)
    {
        Rental storage rental = rentals[currentLender][
            rentals[currentLender].length - 1
        ];
        require(!rental.cantCancel, "taken");
        rental.cantCancel = true;
        rental.rentalToken = rentalToken.rentalToken;
        emit BikeTaken(
            currentLender,
            block.timestamp,
            address(this),
            gpsData[address(this)].latitude,
            gpsData[address(this)].longitude
        );
    }

    /**
     * @dev This function call the BikeShare contract to pretend that the bike is returned
     * @notice Declare the return of the rented bike, people have to be physically present at the meeting point
     */

    function returnBike() external isActivated renting onlyOwner {
        Rental storage rental = rentals[currentLender][
            rentals[currentLender].length - 1
        ];
        require(
            rental.cantCancel && !rental.seemsReturned && !rental.isReturned,
            "bad state"
        );
        require(
            rentalToken.time > 0 &&
                block.timestamp - rentalToken.time <= 1 minutes,
            "expired"
        );
        bikeShare = IBikeShare(currentLender);
        bikeShare.returnedBike(owner);
        rental.seemsReturned = true;
        emit RentalDeclaredAsReturned(
            currentLender,
            block.timestamp,
            address(this),
            gpsData[address(this)].latitude,
            gpsData[address(this)].longitude
        );
    }

    /**
     * @notice Confirm the return of the bike
     * @dev This function is called by the lender's BikeShare contract to confirm definitaly that the bike is returned
     * @param _bikeShareOwner The address of the bike share owner
     */

    function returnConfirmed(
        address _bikeShareOwner,
        string calldata lenderTempToken
    )
        external
        isActivated
        checkLenderNFT(_bikeShareOwner)
        renting
        validToken(lenderTempToken)
    {
        Rental storage rental = rentals[msg.sender][
            rentals[msg.sender].length - 1
        ];
        require(rental.seemsReturned && !rental.isReturned, "bad state");
        rental.isReturned = true;
        uint reward = rental.rewardExpected;
        // update rewards mapping
        rewards[msg.sender] += reward;
        // increase total rewards
        totalRewards += reward;
        isRenting = false;
        currentLender = address(0);
        emit RentalReturned(
            rental.date,
            msg.sender,
            block.timestamp,
            address(this),
            gpsData[address(this)].latitude,
            gpsData[address(this)].longitude
        );
    }

    /**
     * @notice Cancel a rental
     * @dev This function is called by the lender's BikeShare contract to cancel a rental
     * @param _refund The refund amount to be given
     * @param _bikeShareOwner The address of the bike share owner
     * @param _isCancelledByLender Indicates whether the rental is cancelled by the lender or not
     */

    function cancelledLending(
        uint _refund,
        address _bikeShareOwner,
        bool _isCancelledByLender
    ) external isActivated checkLenderNFT(_bikeShareOwner) renting {
        require(_refund > 0, "Invalid refund");
        handleRentalCancellation(
            _refund,
            _bikeShareOwner,
            _isCancelledByLender
        );
    }

    /**
     * @dev This function is called by this renter contract to cancel a rental
     * @notice Cancel renting before it begins
     */

    function cancelRenting() external isActivated onlyOwner renting {
        handleRentalCancellation(0, address(0), false);
    }

    /**
     * @notice Helper function to handle rental cancellation
     * @param _refund The refund amount to be given
     * @param _bikeShareOwner The address of the bike share owner
     * @param _isCancelledByLender Indicates whether the rental is cancelled by the lender or not
     */

    function handleRentalCancellation(
        uint _refund,
        address _bikeShareOwner,
        bool _isCancelledByLender
    ) private {
        Rental storage rental = rentals[currentLender][
            rentals[currentLender].length - 1
        ];
        require(!rental.cantCancel && !rental.isReturned, "bad state");
        if (_refund == 0) {
            uint basis = rental.depositAmount + rental.rentalPrice;
            _refund = block.timestamp >= rental.date - 2 hours
                ? basis - (rental.rentalPrice * 1000) / 10000
                : basis;
        }
        if (_bikeShareOwner != address(0)) {
            require(msg.sender == currentLender, "lender");
        } else {
            if (!_isCancelledByLender) {
                bikeShare = IBikeShare(currentLender);
                bikeShare.cancelledRenting(owner);
            }
        }
        // set rental as returned
        rental.isReturned = true;
        isRenting = false;
        safeDate = block.timestamp;
        address lender = currentLender;
        currentLender = address(0);
        emit RentalCancelled(
            lender,
            rental.date,
            _refund,
            block.timestamp,
            address(this)
        );
    }

    /**
     * @notice Withdraw funds from the contract
     * @param _amount The amount to be withdrawn
     */

    function withdrawFunds(uint _amount) external isActivated onlyOwner {
        require(_amount > 0, "Not 0");
        require(W2R.balanceOf(address(this)) >= _amount, "Insufficient");
        W2R.safeTransfer(msg.sender, _amount);
        emit W2Rwithdrawed(msg.sender, _amount, block.timestamp, address(this));
    }

    /**
     * @notice Destroy the contract, W2R funds are transfered to the owner.
     * @dev This function is called by the whitelist contract to destroy the contract
     * not really destroyed as the selfdestruct expected to be used will be deprecated soon
     * but usable anymore
     * @return true if the contract is successfully destroyed, false otherwise
     */

    function destroy() external returns (bool) {
        require(msg.sender == whitelistRenter, "wl");
        require(block.timestamp >= safeDate, "delay");
        isDeactivated = true;
        isDestroyed = true;
        if (W2R.balanceOf(address(this)) > 0) {
            // transfer all balance of W2R to owner
            W2R.safeTransfer(owner, W2R.balanceOf(address(this)));
        }
        if (totalRewards > 0) {
            uint amount = totalRewards;
            totalRewards = 0;
            vaultW2R.distributeW2R(owner, amount);
        }
        emit ContractDestroyed(msg.sender, block.timestamp, address(this));
        return true;
    }
}
