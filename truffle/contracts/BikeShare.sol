// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
/////////////////////////////////// BikeShare contract ///////////////////////////////////

//import "@openzeppelin/contracts/interfaces/IERC721.sol";
import "../node_modules/@openzeppelin/contracts/interfaces/IERC721.sol";
import "./Utilities.sol";

interface I3VaultW2R {
    function distributeW2R(address receiver, uint256 amount) external;
}

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

interface IBikeRent {
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

    function returnConfirmed(address _bikeShareOwner) external;

    function confirmBikeInHands(address _bikeShareOwner) external;
}

contract BikeShare is Utilities {
    using SafeERC20 for IERC20;
    address whitelistLender;
    address renterNFT;
    address whitelistRenter;
    uint public rate; // Prix de location par jour
    uint public depositAmount; // Montant de la caution
    uint public maximumRental; // Durée maximale de location, PEUT ETRE RENSEIGNÉE
    bool public isRented; // Vélo loué ou non

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
        address indexed renter, // address du contrat locataire
        uint date, // date de la proposition
        address indexed lender, // address du contrat propriétaire
        uint rentalDateMin, // date de la location souhaitée
        uint rentalDateMax, // date de la location souhaitée
        uint rentalTime, // durée de la location souhaitée
        uint rate, // taux de location au moment de la proposition
        uint depositAmount, // taux de dépôt au moment de la proposition
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
        // time of the proposal
        uint date; // date de la proposition
        address _renter; // address of the renter
        uint _rentalDateMin; // date de la location, heure de RDV minimum
        uint _rentalDateMax; // date de la location, heure de RDV maximum
        uint _rentalTime; // durée de la location
        uint _rate; // prix de la location par jour
        uint _depositAmount; // montant de la caution
        bool _isAccepted; // proposition acceptée ou non
    }

    Proposal[] public proposals;

    struct Rental {
        uint date; // date de la location
        uint rentalTime; // durée de la location
        uint rentalPrice; // prix de la location
        uint depositAmount; // montant de la caution
        uint rewardExpected; // récompense
        uint amountAsked; // montant demandé
        bool isAccepted; // location acceptée ou non
        bool isRefunded; // montant remboursé ou non
        bool seemsReturned; // location déclarée rendue ou non
        bool cantCancel; // impossible de cancel la location
        bool isReturned; // location rendue ou non
    }

    // import VaultW2R interface
    I3VaultW2R private vaultW2R;

    IBikeRent bikeRent;

    // instantiate IrenterWhitelist interface
    IrenterWhitelist private RenterWhitelist;

    struct RentalGPS {
        string latitude;
        string longitude;
    }

    mapping(address => RentalGPS) public rentalGPSData;

    // mapping of rentals, address of the renter is the key
    mapping(address => Rental[]) public rentals;
    address public currentRenter;

    constructor(
        address _lender,
        address _W2Rtoken,
        address _renterNFT,
        address _whitelistLender,
        address _vaultW2R,
        address _whitelistRenter
    ) Utilities(_lender, _W2Rtoken) {
        require(_renterNFT != address(0));
        require(
            msg.sender == _whitelistLender,
            "Only the whitelist can deploy"
        );
        require(_vaultW2R != address(0));
        require(_whitelistRenter != address(0));
        renterNFT = _renterNFT;
        whitelistLender = _whitelistLender;
        vaultW2R = I3VaultW2R(_vaultW2R);
        whitelistRenter = _whitelistRenter;
        // default values
        maximumRental = 1 days;
        rate = 100000000000000000000; // 100 W2R
        depositAmount = 200000000000000000000; // 200 W2R
    }

    // modifier to check if a renter has the NFT
    modifier checkRenterNFT(address _bikeRentOwner) {
        require(IERC721(renterNFT).balanceOf(_bikeRentOwner) > 0, "No NFT");
        RenterWhitelist = IrenterWhitelist(whitelistRenter);
        require(
            RenterWhitelist.whitelistedAddresses(_bikeRentOwner).isWhitelisted,
            "Not whitelisted"
        );
        require(
            RenterWhitelist
                .whitelistedAddresses(_bikeRentOwner)
                .bikeRentContract == msg.sender,
            "Not whitelisted"
        );
        _;
    }

    modifier lending() {
        require(isRented, "Not rented");
        require(currentRenter != address(0), "No lender");
        require(
            bytes(rentalGPSData[currentRenter].latitude).length > 0 &&
                bytes(rentalGPSData[currentRenter].longitude).length > 0,
            "GPS not set"
        );
        _;
    }

    function setRate(uint _rate) external onlyOwner {
        require(_rate > 0);
        rate = _rate;
    }

    // fonction pour fixer le taux de la caution
    function setDepositAmount(
        uint _depositAmount
    ) external isActivated onlyOwner {
        require(_depositAmount > 0, "Must not 0");
        depositAmount = _depositAmount;
    }

    // fonction pour fixer la durée maximale de location
    function setMaximumRental(
        uint _maximumRental
    ) external isActivated onlyOwner {
        require(_maximumRental >= 1 days && _maximumRental <= 1 weeks);
        maximumRental = _maximumRental;
    }

    function getRentalsByAdresses(address renter) external view returns (uint) {
        return rentals[renter].length;
    }

    // fonction pour renseigner les détails de la location
    function setRentalStruct(
        uint _date, // date de la location
        address _renter, // address du contrat locataire
        uint _rentalTime, // durée de la location
        uint _rentalPrice, // prix de la location
        uint _depositAmount // montant de la caution
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
                false
            )
        );
    }

    // fonction pour proposer une location appelée par le contrat locataire
    function setProposal(
        address _bikeRentOwner,
        uint _dateMin, // date de la location souhaitée, heure de RDV minimum
        uint _dateMax, // date de la location souhaitée, heure de RDV maximum
        uint _rentalTime, // durée de la location proposée
        uint _rate, // taux de la location au moment de la proposition
        uint _depositAmount, // caution au moment de la proposition
        uint date,
        string calldata _latitude,
        string calldata _longitude
    ) external isActivated checkRenterNFT(_bikeRentOwner) {
        // require(deleteOldProposals());
        for (uint i = 0; i < proposals.length; i++) {
            if (proposals[i]._renter == msg.sender) {
                revert("Already proposed");
            }
        }
        require(proposals.length <= 5, "Too many");
        // check rentalTime is modulo 1 days
        require(
            _rentalTime % 1 days == 0 && _rentalTime >= 1 days,
            "Bad rental time"
        );
        require(
            _dateMin > block.timestamp + 2 hours &&
                _dateMax - _dateMin <= 12 hours,
            "Bad dates"
        );
        require(
            _rentalTime >= minimalRental && _rentalTime <= maximumRental,
            "Too short"
        );
        require(_rate > 0);
        require(depositAmount > 0);
        require(
            bytes(_latitude).length > 0 && bytes(_longitude).length > 0,
            "GPS not set"
        );

        Proposal memory proposal = Proposal(
            date, // date de réception de la proposition
            msg.sender, // address du contrat renter
            _dateMin, // date de la location souhaitée, heure de RDV minimum
            _dateMax, // date de la location souhaitée, heure de RDV maximum
            _rentalTime, // durée de la location souhaitée
            _rate, // taux de la location au moment de la proposition
            _depositAmount, // taux de la caution au moment de la proposition
            false // proposition acceptée ou non
        );
        proposals.push(proposal);
        emit ProposalReceived(
            msg.sender, // address du contrat locataire
            date, // date de la proposition
            address(this), // address du contrat propriétaire
            _dateMin, // date de la location souhaitée
            _dateMax, // date de la location souhaitée
            _rentalTime, // durée de la location souhaitée
            _rate, // taux de location au moment de la proposition
            _depositAmount, // taux de dépôt au moment de la proposition
            _latitude,
            _longitude
        );
    }

    function getProposalsLength() external view returns (uint) {
        return proposals.length;
    }

    function getRentalsLength(address renter) external view returns (uint) {
        return rentals[renter].length;
    }

    // order come from front-end when user open the proposal page
    function deleteOldProposals()
        external
        isActivated
        onlyOwner
        returns (bool)
    {
        uint i = 0;
        while (i < proposals.length) {
            if (block.timestamp - proposals[i].date > proposalDuration) {
                for (uint j = i; j < proposals.length - 1; j++) {
                    address renter = proposals[j]._renter;
                    uint date = proposals[j].date;
                    proposals[j] = proposals[j + 1];
                    proposals.pop();
                    emit ProposalCancelled(renter, date, address(this));
                }
            } else {
                i++;
            }
        }
        return true;
    }

    // inform bikeRent contract that the proposal has been accepted
    // GPS coordinates come from front-end
    function acceptProposal(
        address _bikeRent,
        uint _meetingHour,
        string calldata _latitude,
        string calldata _longitude
    ) external isActivated onlyOwner {
        require(!isRented, "Already rented");
        require(_meetingHour > 0);
        require(
            _bikeRent != address(0) &&
                _bikeRent != owner &&
                _bikeRent != address(this),
            "Invalid address"
        );
        require(proposals.length > 0, "No proposals");
        require(
            bytes(_latitude).length > 0 && bytes(_longitude).length > 0,
            "GPS not set"
        );
        bool proposalFound;
        uint i;
        uint dateMax;
        uint rentalTime;
        for (i = 0; i < proposals.length; i++) {
            if (proposals[i]._renter == _bikeRent) {
                Proposal memory proposalLoop = proposals[i];
                require(
                    _meetingHour >= proposalLoop._rentalDateMin && // date de RDV minimum
                        _meetingHour <= proposalLoop._rentalDateMax,
                    "invalid hour" // date de RDV maximum
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
                    "Not enough W2R"
                );
                uint meetingHour = _meetingHour;
                setRentalStruct(
                    meetingHour, // date et heure de la location
                    proposalLoop._renter, // address du contrat locataire
                    rentalTime, // durée de la location
                    rentalPrice, // prix de la location
                    proposalLoop._depositAmount // montant de la caution
                );
                bikeRent.rentBike(
                    owner, // address du propriétaire
                    rentalPrice, // prix de la location
                    proposalLoop._depositAmount, // montant de la caution
                    rentalTime, // durée de la location
                    meetingHour // date de la location
                );
                // set bike as rented if no revert
                proposalLoop._isAccepted = true;
                isRented = true;
                currentRenter = proposalLoop._renter;
                rentalGPSData[currentRenter] = RentalGPS(_latitude, _longitude);
                totalRentals++;
                emit BikeRented(
                    proposalLoop._renter, // address du contrat locataire
                    rentalTime, // durée de la location
                    _meetingHour, // date de la location
                    proposalLoop._rate, // taux de la location
                    proposalLoop._depositAmount, // montant de la caution
                    rentalPrice // prix de la location
                );
                proposalFound = true;
                break;
            }
        }
        require(proposalFound, "not found");
        // delete proposal from the renter as it has been accepted
        while (i < proposals.length) {
            if (proposals[i]._renter == currentRenter) {
                cancelUselessProposals(i);
                break;
            } else {
                i++;
            }
        }
        //delete proposal which date is before the rental date
        for (uint j = 0; j < proposals.length; j++) {
            if (j != i && proposals[j].date < (dateMax + rentalTime)) {
                cancelUselessProposals(j);
            }
        }
    }

    function cancelUselessProposals(uint index) private returns (bool) {
        address renter = proposals[index]._renter;
        uint256 date = proposals[index].date;
        proposals[index] = proposals[proposals.length - 1];
        proposals.pop();
        emit ProposalCancelled(renter, date, address(this));
        return true;
    }

    function cancelProposal(address _bikerent) public isActivated onlyOwner {
        require(
            _bikerent != address(0) &&
                _bikerent != owner &&
                _bikerent != address(this),
            "Invalid address"
        );
        require(proposals.length > 0, "No proposals");
        uint i = 0;
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

    // function to activate when the Renter has physically taken the bike
    function confirmBikeTaken() external isActivated onlyOwner lending {
        Rental storage rental = rentals[currentRenter][
            rentals[currentRenter].length - 1
        ];
        // DEACTIVATED FOR TESTING AND DEMO PURPOSES
        //require(rental.date <= block.timestamp, "Must be in the past");
        require(rental.cantCancel == false, "already taken");
        rental.cantCancel = true;
        bikeRent = IBikeRent(currentRenter);
        bikeRent.confirmBikeInHands(owner);
        emit BikeTaken(
            currentRenter,
            block.timestamp,
            address(this),
            rentalGPSData[currentRenter].latitude,
            rentalGPSData[currentRenter].longitude
        );
    }

    // function called by Renter contract to confirm that the bike has been returned
    // it is strongly advised that people were physically present at the meeting point
    function returnedBike(
        address _bikeRentOwner
    ) external isActivated checkRenterNFT(_bikeRentOwner) lending {
        require(msg.sender == currentRenter, "current renter");
        Rental storage rental = rentals[currentRenter][
            rentals[currentRenter].length - 1
        ];
        require(rental.seemsReturned == false, "seems returned");
        rental.seemsReturned = true;
        emit RentalSeemsReturned(msg.sender, block.timestamp, address(this));
    }

    // function to definitely confirm bike returned by renter and return deposit to renter
    function confirmBikeReturned() external isActivated onlyOwner lending {
        Rental storage rental = rentals[currentRenter][
            rentals[currentRenter].length - 1
        ];
        require(rental.seemsReturned == true, "Seems not returned");
        // check if rental is not already returned
        require(rental.isReturned == false, "Already returned");
        uint depositReturned = rental.depositAmount;
        require(
            W2R.balanceOf(address(this)) >= depositReturned,
            "Insufficient W2R"
        );
        bikeRent = IBikeRent(currentRenter);
        bikeRent.returnConfirmed(owner);
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
        vaultW2R.distributeW2R(address(this), reward);
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

    // function called by lender to cancel lending
    function cancelLending() external isActivated lending onlyOwner {
        handleRentingCancellation(false);
    }

    // function called by renter to cancel renting
    function cancelledRenting(
        address _bikeRentOwner
    ) external isActivated checkRenterNFT(_bikeRentOwner) lending {
        handleRentingCancellation(true);
    }

    // helper function to handle cancellation
    function handleRentingCancellation(bool isCalledByRenter) private {
        Rental storage rental = rentals[currentRenter][
            rentals[currentRenter].length - 1
        ];
        require(rental.cantCancel == false, "Cannot cancel");
        require(rental.isRefunded == false, "Already refunded");
        uint _refund;
        uint basis = rental.depositAmount + rental.rentalPrice;
        if (isCalledByRenter == true) {
            require(msg.sender == currentRenter, "Only renter");
        }
        _refund = isCalledByRenter &&
            msg.sender == currentRenter &&
            block.timestamp >= rental.date - 2 hours
            ? basis - (rental.rentalPrice * 1000) / 10000
            : basis;
        require(W2R.balanceOf(address(this)) >= _refund, "Insufficient W2R");
        if (isCalledByRenter == false) {
            bikeRent = IBikeRent(currentRenter);
            bikeRent.cancelledLending(_refund, owner, true);
        }
        // set rental struct to refunded
        rental.isRefunded = true;
        // set bike as not rented if no revert
        isRented = false;
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

    function withdrawFunds(uint _amount) external isActivated onlyOwner {
        require(_amount > 0, "Must be greater than 0");
        uint W2Rbalance = W2R.balanceOf(address(this));
        uint deposit;
        if (isRented && currentRenter != address(0)) {
            deposit = rentals[currentRenter][rentals[currentRenter].length - 1]
                .depositAmount;
        }
        require(W2Rbalance - deposit > _amount, "Not enough");
        //transfer W2R to owner
        W2R.safeTransfer(owner, _amount);
        emit W2Rwithdrawed(msg.sender, _amount, block.timestamp, address(this));
    }

    // Fonction pour détruire le contrat et renvoyer les fonds restants à l'owner
    function destroy() external returns (bool) {
        require(msg.sender == whitelistLender, "Only whitelistContract");
        // if bike is rented and rental duration is not over, revert
        if (isRented && currentRenter != address(0)) {
            Rental memory rental = rentals[currentRenter][
                rentals[currentRenter].length - 1
            ];
            require(
                block.timestamp > rental.date + rental.rentalTime,
                "Rental not over"
            );
        }
        isDeactivated = true;
        isDestroyed = true;
        if (W2R.balanceOf(address(this)) > 0) {
            // transfer all balance of W2R to owner
            W2R.safeTransfer(owner, W2R.balanceOf(address(this)));
        }
        emit ContractDestroyed(msg.sender, block.timestamp, address(this));
        return true;
    }
}
