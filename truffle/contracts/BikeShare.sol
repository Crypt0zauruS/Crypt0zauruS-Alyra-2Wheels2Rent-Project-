// SPDX-License-Identifier: CC-BY-4.0
pragma solidity ^0.8.17;
/////////////////////////////////// BikeShare contract ///////////////////////////////////

//import "@openzeppelin/contracts/interfaces/IERC721.sol";
import "../node_modules/@openzeppelin/contracts/interfaces/IERC721.sol";
import "./Utilities.sol";

/**
@title IrenterWhitelist Interface
@notice This is the interface of the renters whitelist contract that manages the renter whitelist.
*/

interface IrenterWhitelist {
    struct Renter {
        bool isWhitelisted;
        address bikeRentContract;
        uint NFTId;
    }

    function whitelistedAddresses(
        address
    ) external view returns (Renter memory);
}

/**
@title IBikeRent Interface
@notice This interface is used to communicate with the BikeRent contract.
*/

interface IBikeRent {
    function owner() external view returns (address);

    function rentBike(
        address _bikeShareContract,
        uint _rentalPrice,
        uint _depositAmount,
        uint _rentalTime,
        uint _rentalDate
    ) external;

    function cancelledLending(
        uint _refund,
        address _bikeShareOwner,
        bool _isCancelledByLender
    ) external;

    function returnConfirmed(
        address _bikeShareOwner,
        string calldata lenderTempToken
    ) external;

    function confirmBikeInHands(
        address _bikeShareOwner,
        string calldata lenderTempToken
    ) external;
}

/**
 * @title BikeShare Contract
 * @author Crypt0zaurus https://www.linkedin.com/in/maxence-a-a82081260
 * @notice This contract manages bike rentals and related operations.
 * @dev This contract inherits from Utilities and manages bike rentals.
 * @dev It uses SafeERC20 for ERC20 operations and contains multiple events for various
 */

contract BikeShare is Utilities {
    using SafeERC20 for IERC20;
    address whitelistLender;
    address renterNFT;
    address whitelistRenter;
    uint public rate;
    uint public depositAmount;
    uint public maximumRental;
    bool public isRented;

    event BikeRented(
        address indexed renter,
        uint rentalTime,
        uint rentalDate,
        uint rate,
        uint deposit,
        uint rentalPrice
    );

    event BikeReturned(
        uint rentalDate,
        address indexed renter,
        uint depositReturned,
        uint returnDate,
        address indexed lender,
        string latitude,
        string longitude
    );

    event RentingCancelled(
        address indexed renter,
        uint date,
        uint depositReturned,
        uint returnDate,
        address indexed lender
    );

    event ProposalReceived(
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

    event BikeTaken(
        address indexed renter,
        uint date,
        address indexed lender,
        string latitude,
        string longitude
    );

    event RentalSeemsReturned(
        address indexed renter,
        uint date,
        address indexed lender
    );

    struct Proposal {
        uint date;
        address _renter;
        uint _rentalDateMin;
        uint _rentalDateMax;
        uint _rentalTime;
        uint _rate;
        uint _depositAmount;
        bool _isAccepted;
    }

    Proposal[] public proposals;

    struct Rental {
        uint date;
        uint rentalTime;
        uint rentalPrice;
        uint depositAmount;
        uint rewardExpected;
        uint amountAsked;
        bool isAccepted;
        bool isRefunded;
        bool seemsReturned;
        bool cantCancel;
        bool isReturned;
        string rentalToken;
    }

    IBikeRent bikeRent;

    IrenterWhitelist private RenterWhitelist;

    struct RentalGPS {
        string latitude;
        string longitude;
    }

    mapping(address => RentalGPS) public rentalGPSData;

    // mapping of rentals, address of the renter is the key
    mapping(address => Rental[]) public rentals;
    address public currentRenter;

    /**
    @dev Contract constructor that sets initial values.
    @param _lender The address of the lender.
    @param _W2Rtoken The address of the W2R token.
    @param _renterNFT The address of the renter NFT.
    @param _whitelistLender The address of the whitelist lenders contract
    @param _vaultW2R The address of the W2R token vault.
    @param _whitelistRenter The address of the whitelist renters contract
    */

    constructor(
        address _lender,
        address _W2Rtoken,
        address _renterNFT,
        address _whitelistLender,
        address _vaultW2R,
        address _whitelistRenter
    ) Utilities(_lender, _W2Rtoken, _vaultW2R) {
        require(
            _renterNFT != address(0) &&
                _whitelistLender != address(0) &&
                _whitelistRenter != address(0),
            "bad address"
        );
        require(msg.sender == _whitelistLender, "wl");
        renterNFT = _renterNFT;
        whitelistLender = _whitelistLender;
        whitelistRenter = _whitelistRenter;
        // default values
        maximumRental = 1 days;
        rate = 100000000000000000000; // 100 W2R
        depositAmount = 200000000000000000000; // 200 W2R
    }

    /**
    @dev Modifier to check if a renter has the NFT.
    @param _bikeRentOwner The address of the renter contract owner.
    */

    modifier checkRenterNFT(address _bikeRentOwner) {
        require(IERC721(renterNFT).balanceOf(_bikeRentOwner) > 0, "No NFT");
        RenterWhitelist = IrenterWhitelist(whitelistRenter);
        require(
            RenterWhitelist.whitelistedAddresses(_bikeRentOwner).isWhitelisted,
            "wl"
        );
        require(
            RenterWhitelist
                .whitelistedAddresses(_bikeRentOwner)
                .bikeRentContract == msg.sender,
            "wl"
        );
        _;
    }

    /**
    @dev Modifier for checking if the bike is currently rented.
    */

    modifier lending() {
        require(isRented && currentRenter != address(0), "bad lending");
        require(
            bytes(rentalGPSData[currentRenter].latitude).length > 0 &&
                bytes(rentalGPSData[currentRenter].longitude).length > 0,
            "no GPS"
        );
        _;
    }

    /**
    @notice Allows the owner to set the rental rate.
    @dev Can only be called by the owner.
    @param _rate The new rental rate in W2R tokens per day of rental
    */

    function setRate(uint _rate) external onlyOwner {
        require(_rate > 0);
        rate = _rate;
    }

    /**
    @notice Allows the owner to set the deposit amount.
    @dev Can only be called by the owner.
    @param _depositAmount The new deposit amount.
    */

    function setDepositAmount(
        uint _depositAmount
    ) external isActivated onlyOwner {
        require(_depositAmount > 0, "Must not 0");
        depositAmount = _depositAmount;
    }

    /**
    @notice Allows the owner to set the maximum rental duration in days
    @dev Can only be called by the owner.
    @param _maximumRental The new maximum rental duration.
    */

    function setMaximumRental(
        uint _maximumRental
    ) external isActivated onlyOwner {
        require(_maximumRental >= 1 days && _maximumRental <= 1 weeks);
        maximumRental = _maximumRental;
    }

    /**
    @notice Returns the number of rentals for a given renter address.
    @param renter The address of the renter.
    @return The number of rentals.
    */

    function getRentalsByAdresses(address renter) external view returns (uint) {
        return rentals[renter].length;
    }

    /**
    @dev Private helper function to set rental details.
    @param _date The date of the rental.
    @param _renter The address of the renter contract.
    @param _rentalTime The duration of the rental.
    @param _rentalPrice The price of the rental.
    @param _depositAmount The deposit amount for the rental.
    */
    function setRentalStruct(
        uint _date,
        address _renter,
        uint _rentalTime,
        uint _rentalPrice,
        uint _depositAmount
    ) private isActivated {
        require((_rentalPrice * rewardAmount * 100) >= 10000);
        uint reward = (_rentalPrice * rewardAmount * 100) / 10000;
        uint _amountAsked = _rentalPrice + _depositAmount;
        rentals[_renter].push(
            Rental(
                _date,
                _rentalTime,
                _rentalPrice,
                _depositAmount,
                reward,
                _amountAsked,
                true,
                false,
                false,
                false,
                false,
                ""
            )
        );
    }

    /**
    @notice Allows a renter to submit a rental proposal.
    @dev Can only be called by a whitelisted renter with an NFT.
    @dev function called by the BikeRent contract.
    @param _bikeRentOwner The address of the renter contract owner.
    @param _dateMin The minimum desired rental meeting time.
    @param _dateMax The maximum desired rental meeting time.
    @param _rentalTime The desired rental duration.
    @param _rate The proposed rental rate.
    @param _depositAmount The proposed deposit amount.
    @param date The date of the proposal.
    @param _latitude The latitude for the rental location.
    @param _longitude The longitude for the rental location.
    */
    function setProposal(
        address _bikeRentOwner,
        uint _dateMin,
        uint _dateMax,
        uint _rentalTime,
        uint _rate,
        uint _depositAmount,
        uint date,
        string calldata _latitude,
        string calldata _longitude
    ) external isActivated checkRenterNFT(_bikeRentOwner) {
        // require(deleteOldProposals());
        for (uint i; i < proposals.length; i++) {
            if (proposals[i]._renter == msg.sender) {
                revert("already done");
            }
        }
        require(proposals.length <= 5, "Too many");
        require(
            _rentalTime % 1 days == 0 &&
                _rentalTime >= minimalRental &&
                _rentalTime <= maximumRental,
            "bad time"
        );
        require(
            _dateMin > block.timestamp + 2 hours &&
                _dateMax - _dateMin <= 12 hours,
            "bad dates"
        );
        require(_rate > 0 && depositAmount > 0, "bad value");
        require(
            bytes(_latitude).length > 0 && bytes(_longitude).length > 0,
            "no GPS"
        );

        Proposal memory proposal = Proposal(
            date,
            msg.sender,
            _dateMin,
            _dateMax,
            _rentalTime,
            _rate,
            _depositAmount,
            false
        );
        proposals.push(proposal);
        emit ProposalReceived(
            msg.sender,
            date,
            address(this),
            _dateMin,
            _dateMax,
            _rentalTime,
            _rate,
            _depositAmount,
            _latitude,
            _longitude
        );
    }

    /**
     * @notice Returns the length of the proposals array.
     * @return The length of the proposals array.
     */

    function getProposalsLength() external view returns (uint) {
        return proposals.length;
    }

    /**
     * @notice Returns the length of the rentals array for a specific renter.
     * @param renter The address of the renter.
     * @return The length of the rentals array for the specified renter.
     */

    function getRentalsLength(address renter) external view returns (uint) {
        return rentals[renter].length;
    }

    /**
     * @notice Deletes old proposals that are no longer valid.
     * @return A boolean value indicating the success of the operation.
     */
    function deleteOldProposals()
        external
        isActivated
        onlyOwner
        returns (bool)
    {
        uint i;
        while (i < proposals.length) {
            if (block.timestamp - proposals[i].date > proposalDuration) {
                cancelUselessProposals(i);
            } else {
                i++;
            }
        }
        return true;
    }

    /**
     * @notice Accepts a proposal and initiates the bike rental process.
     * @dev Call the rentBike function of the BikeRent contract to initiate the rental process and delete others proposals.
     * in the same time of the rental
     * @param _bikeRent The address of the BikeRent contract.
     * @param _meetingHour The meeting hour for the rental.
     * @param _latitude The latitude of the meeting point.
     * @param _longitude The longitude of the meeting point.
     */
    function acceptProposal(
        address _bikeRent,
        uint _meetingHour,
        string calldata _latitude,
        string calldata _longitude
    ) external isActivated onlyOwner {
        require(
            !isRented && _meetingHour > 0 && proposals.length > 0,
            "bad values"
        );
        require(
            _bikeRent != address(0) &&
                _bikeRent != owner &&
                _bikeRent != address(this),
            "bad address"
        );
        require(
            bytes(_latitude).length > 0 && bytes(_longitude).length > 0,
            "no GPS"
        );
        bool proposalFound;
        uint i;
        uint dateMax;
        uint rentalTime;
        for (i = 0; i < proposals.length; i++) {
            if (proposals[i]._renter == _bikeRent) {
                Proposal memory proposalLoop = proposals[i];
                require(
                    _meetingHour >= proposalLoop._rentalDateMin &&
                        _meetingHour <= proposalLoop._rentalDateMax,
                    "bad hour"
                );
                uint rentalPrice = (proposalLoop._rentalTime / 86400) *
                    proposalLoop._rate;
                dateMax = proposalLoop._rentalDateMax;
                rentalTime = proposalLoop._rentalTime;
                bikeRent = IBikeRent(proposalLoop._renter);
                // check W2R balance of renter contract
                require(
                    W2R.balanceOf(proposalLoop._renter) >=
                        rentalPrice + proposalLoop._depositAmount,
                    "Not enough"
                );
                uint meetingHour = _meetingHour;
                bikeRent.rentBike(
                    owner,
                    rentalPrice,
                    proposalLoop._depositAmount,
                    rentalTime,
                    meetingHour
                );
                setRentalStruct(
                    meetingHour,
                    proposalLoop._renter,
                    rentalTime,
                    rentalPrice,
                    proposalLoop._depositAmount
                );
                proposalLoop._isAccepted = true;
                isRented = true;
                safeDate = meetingHour + rentalTime + 2 days;
                currentRenter = proposalLoop._renter;
                rentalGPSData[currentRenter] = RentalGPS(_latitude, _longitude);
                totalRentals++;
                emit BikeRented(
                    proposalLoop._renter,
                    rentalTime,
                    meetingHour,
                    proposalLoop._rate,
                    proposalLoop._depositAmount,
                    rentalPrice
                );
                proposalFound = true;
                break;
            }
        }
        require(proposalFound, "not found");
        // delete proposal from the renter as it has been accepted
        cancelUselessProposals(i);
        //delete proposal which date is before the rental date
        for (uint j; j < proposals.length; j++) {
            if (j != i && proposals[j].date < (dateMax + rentalTime)) {
                cancelUselessProposals(j);
            }
        }
    }

    /**
     * @notice Cancels a proposal with a specific index.
     * @dev helper function
     * @param index The index of the proposal to cancel.
     * @return A boolean value indicating the success of the operation.
     */
    function cancelUselessProposals(uint index) private returns (bool) {
        address renter = proposals[index]._renter;
        uint256 date = proposals[index].date;
        proposals[index] = proposals[proposals.length - 1];
        proposals.pop();
        emit ProposalCancelled(renter, date, address(this));
        return true;
    }

    /**
     * @notice Cancels a proposal with a specific bike rent contract address.
     * @param _bikerent The address of the BikeRent contract.
     */

    function cancelProposal(address _bikerent) public isActivated onlyOwner {
        require(
            _bikerent != address(0) &&
                _bikerent != owner &&
                _bikerent != address(this),
            "bad address"
        );
        require(proposals.length > 0, "nothing");
        uint i;
        while (i < proposals.length) {
            if (proposals[i]._renter == _bikerent) {
                require(proposals[i]._isAccepted == false, "accepted");
                cancelUselessProposals(i);
                break;
            } else {
                i++;
            }
        }
    }

    /**
     * @dev Call the confirmBikeInHands function of the BikeRent contract.
     * @notice Confirms the bike has been taken by the renter.
     */
    function confirmBikeTaken(
        string calldata _rentalToken
    ) external isActivated onlyOwner lending {
        Rental storage rental = rentals[currentRenter][
            rentals[currentRenter].length - 1
        ];
        // DEACTIVATED FOR TESTING AND DEMO PURPOSES
        //require(rental.date <= block.timestamp, "Must be in the past");
        require(!rental.cantCancel, "taken");
        require(bytes(_rentalToken).length == 30, "invalid");
        bikeRent = IBikeRent(currentRenter);
        bikeRent.confirmBikeInHands(owner, _rentalToken);
        rental.cantCancel = true;
        emit BikeTaken(
            currentRenter,
            block.timestamp,
            address(this),
            rentalGPSData[currentRenter].latitude,
            rentalGPSData[currentRenter].longitude
        );
    }

    /**
     * @notice Declares the bike has been returned by the renter. People have to be physically present at the meeting point
     * @dev Called by the BikeRent contract.
     * @param _bikeRentOwner The address of the bike rent owner.
     */
    function returnedBike(
        address _bikeRentOwner
    ) external isActivated checkRenterNFT(_bikeRentOwner) lending {
        require(msg.sender == currentRenter, "current renter");
        Rental storage rental = rentals[currentRenter][
            rentals[currentRenter].length - 1
        ];
        require(!rental.seemsReturned, "seems returned");
        rental.seemsReturned = true;
        emit RentalSeemsReturned(msg.sender, block.timestamp, address(this));
    }

    /**
     * @notice Confirms definitaly the bike has been returned and the deposit is returned to the renter.
     * @dev Call the returnConfirmed function of the BikeRent contract.
     */
    function confirmBikeReturned(
        string calldata _rentalToken
    ) external isActivated onlyOwner lending {
        require(bytes(_rentalToken).length == 30, "invalid");
        Rental storage rental = rentals[currentRenter][
            rentals[currentRenter].length - 1
        ];
        require(rental.seemsReturned && !rental.isReturned, "bad state");
        uint depositReturned = rental.depositAmount;
        require(
            W2R.balanceOf(address(this)) >= depositReturned,
            "Insufficient"
        );
        bikeRent = IBikeRent(currentRenter);
        bikeRent.returnConfirmed(owner, _rentalToken);
        // set rental as returned
        rental.isReturned = true;
        uint reward = rental.rewardExpected;
        rewards[currentRenter] += reward;
        // update totalRewards
        totalRewards += reward;
        isRented = false;
        address current = currentRenter;
        currentRenter = address(0);
        W2R.safeTransfer(current, depositReturned);
        emit BikeReturned(
            rental.date,
            current,
            depositReturned,
            block.timestamp,
            address(this),
            rentalGPSData[currentRenter].latitude,
            rentalGPSData[currentRenter].longitude
        );
    }

    /**
     * @notice Cancels the lending process initiated by the lender.
     */
    function cancelLending() external isActivated lending onlyOwner {
        handleRentingCancellation(false);
    }

    /**
     * @notice Cancels the renting process initiated by the renter.
     * @param _bikeRentOwner The address of the bike rent owner.
     */
    function cancelledRenting(
        address _bikeRentOwner
    ) external isActivated checkRenterNFT(_bikeRentOwner) lending {
        handleRentingCancellation(true);
    }

    /**
     * @notice Handles the cancellation of a renting process.
     * @dev helper function, call the cancelledLending function of the BikeRent contract if called by this contract
     */
    function handleRentingCancellation(bool isCalledByRenter) private {
        Rental storage rental = rentals[currentRenter][
            rentals[currentRenter].length - 1
        ];
        require(!rental.cantCancel && !rental.isRefunded, "bad state");
        uint _refund;
        uint basis = rental.depositAmount + rental.rentalPrice;
        if (isCalledByRenter) {
            require(msg.sender == currentRenter, "renter");
        }
        _refund = isCalledByRenter &&
            msg.sender == currentRenter &&
            block.timestamp >= rental.date - 2 hours
            ? basis - (rental.rentalPrice * 1000) / 10000
            : basis;
        require(W2R.balanceOf(address(this)) >= _refund, "Insufficient");
        if (!isCalledByRenter) {
            bikeRent = IBikeRent(currentRenter);
            bikeRent.cancelledLending(_refund, owner, true);
        }
        // set rental struct to refunded
        rental.isRefunded = true;
        // set bike as not rented if no revert
        isRented = false;
        safeDate = block.timestamp;
        address current = currentRenter;
        currentRenter = address(0);
        W2R.safeTransfer(current, _refund);
        emit RentingCancelled(
            current,
            rental.date,
            _refund,
            block.timestamp,
            address(this)
        );
    }

    /**
     * @notice Allows the owner to withdraw funds from the contract.
     * @dev Prevent withdrawing the deposit amount of the current renter.
     * @param _amount The amount to be withdrawn.
     */

    function withdrawFunds(uint _amount) external isActivated onlyOwner {
        require(_amount > 0, "Not 0");
        uint W2Rbalance = W2R.balanceOf(address(this));
        uint toKeep;
        if (isRented && currentRenter != address(0)) {
            Rental memory rental = rentals[currentRenter][
                rentals[currentRenter].length - 1
            ];
            toKeep = rental.cantCancel == true
                ? rental.depositAmount
                : rental.amountAsked;
        }
        require(W2Rbalance - toKeep > _amount, "Not enough");
        //transfer W2R to owner
        W2R.safeTransfer(owner, _amount);
        emit W2Rwithdrawed(msg.sender, _amount, block.timestamp, address(this));
    }

    /**
     * @notice Destroy the contract, W2R funds are transfered to the owner.
     * In case of a rental, destruction is only possible after the rental time + 2 days, in case of a delay.
     * After this delay, and if the bike has not been returned, lender can destroy the contract but deposit will be send to the vault,
     * waiting to know who failed (renter stole the bike, or lender went away to keep the deposit)
     * So, this functionnality prevents the use of the destruction function to steal the deposit.
     * @dev This function is called by the whitelist contract to destroy the contract
     * not really destroyed as the selfdestruct expected to be used is deprecated
     * @return true if the contract is successfully destroyed, false otherwise
     */
    function destroy() external returns (bool) {
        require(msg.sender == whitelistLender, "wl");
        require(block.timestamp >= safeDate, "delay");
        if (isRented && currentRenter != address(0)) {
            Rental memory rental = rentals[currentRenter][
                rentals[currentRenter].length - 1
            ];
            bikeRent = IBikeRent(currentRenter);
            vaultW2R.receiveDepositsWhenDestroyed(
                owner,
                currentRenter,
                bikeRent.owner(),
                block.timestamp,
                rental.depositAmount
            );
            W2R.safeTransfer(address(vaultW2R), rental.depositAmount);
        }
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
