// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/interfaces/IERC721.sol";
import "./Utilities.sol";

interface I4VaultW2R {
    function distributeW2R(address receiver, uint256 amount) external;
}

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

    // // to call the function returnBike of the BikeShare contract
    function returnedBike(address _bikeRentOwner) external;

    // to retrieve the maximum rental duration set in the BikeShare contract
    function maximumRental() external view returns (uint);

    // to retrieve the rate of W2R tokens per day set in the BikeShare contract
    function rate() external view returns (uint);

    // to retrieve the rate of W2R tokens per day set in the BikeShare contract for the deposit
    function depositAmount() external view returns (uint);

    function cancelledRenting(address _bikeRentOwner) external;

    function getProposalsLength() external view returns (uint);
}

contract BikeRent is Utilities {
    using SafeERC20 for IERC20;
    IBikeShare bikeShare;
    address whitelistRenter;
    address lenderNFT;
    address whitelistLender;
    bool public isRenting;

    event ProposalMade(
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
        address indexed lenter,
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
        address indexed lenter,
        uint date,
        address indexed renter,
        string latitude,
        string longitude
    );

    struct Rental {
        uint date; // date de la location
        uint rentalTime; // durée de la location
        uint rentalPrice; // prix de la location
        uint depositAmount; // montant du dépôt
        uint rewardExpected; // montant de la récompense attendue
        bool isReturned; // booléen pour savoir si le vélo a été rendu
        bool isRefunded; // booléen pour savoir si la location a été remboursée
        bool seemsReturned; // booléen pour savoir si le vélo est déclaré comme rendu
        bool cantCancel; // booléen pour savoir si la location ne peut pas être annulée
    }

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
    uint private constant DAY_SECONDS = 24 hours;
    uint private constant DAILY_CALL_LIMIT = 2;

    // import VaultW2R interface
    I4VaultW2R private vaultW2R;

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
    ) Utilities(_renter, _W2Rtoken) {
        require(_lenderNFT != address(0));
        require(_whitelistRenter != address(0));
        require(msg.sender == _whitelistRenter, "Only whitelist can deploy");
        require(_vaultW2R != address(0));
        require(_whitelistLender != address(0));
        lenderNFT = _lenderNFT;
        whitelistRenter = _whitelistRenter;
        vaultW2R = I4VaultW2R(_vaultW2R);
        whitelistLender = _whitelistLender;
    }

    // modifier to check if a bikeShare owner has really a Nft and if the bikeShare contract is whitelisted
    modifier checkLenderNFT(address _bikeShareOwner) {
        require(IERC721(lenderNFT).balanceOf(_bikeShareOwner) > 0, "No NFT");
        LenderWhitelist = IlenderWhitelist(whitelistLender);
        require(
            LenderWhitelist.whitelistedAddresses(_bikeShareOwner).isWhitelisted,
            "Not whitelisted"
        );
        // check if msg.sender corresponding to bikeshare contract in struct of whitelisted _bikeShareOwner
        require(
            LenderWhitelist
                .whitelistedAddresses(_bikeShareOwner)
                .bikeShareContract == msg.sender,
            "Not whitelisted"
        );
        _;
    }

    modifier renting() {
        require(isRenting, "Not rented");
        require(currentLender != address(0), "No lender");
        require(
            bytes(gpsData[address(this)].latitude).length > 0 &&
                bytes(gpsData[address(this)].longitude).length > 0,
            "GPS not set"
        );
        _;
    }

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

    function getRentalsByAdresses(address renter) external view returns (uint) {
        return rentals[renter].length;
    }

    function deleteOldProposals() private returns (bool) {
        uint i = 0;
        while (i < proposalsMade.length) {
            if (block.timestamp - proposalsMade[i].date > proposalDuration) {
                for (uint j = i; j < proposalsMade.length - 1; j++) {
                    address _bikeShareContract = proposalsMade[j].lender;
                    uint date = proposalsMade[j].date;
                    proposalsMade[j] = proposalsMade[j + 1];
                    proposalsMade.pop();
                    emit ProposalCancelled(
                        address(this),
                        date,
                        _bikeShareContract
                    );
                }
            } else {
                i++;
            }
        }
        return true;
    }

    // fonction pour que le locataire puisse proposer une location
    function makeProposal(
        address _bikeShareContract, // adresse du contrat BikeShare
        uint _dateMin, // date de la location souhaitée, heure de RDV minimum
        uint _dateMax, // date de la location souhaitée, heure de RDV maximum
        uint _rentalTime // durée de la location
    ) public isActivated onlyOwner rateLimited(userProposalCalls) {
        require(deleteOldProposals(), "No old proposals");
        for (uint i = 0; i < proposalsMade.length; i++) {
            if (proposalsMade[i].lender == _bikeShareContract) {
                revert("Proposal already made");
            }
        }
        require(
            _rentalTime > 0 && _dateMin > 0 && _dateMax > 0,
            "Time too short"
        );
        require(_dateMin > block.timestamp + 10000, "Date too soon");
        require(_rentalTime >= minimalRental, "Time too short");
        require(_bikeShareContract != address(0));
        require(_dateMax - _dateMin >= 3 hours, "Too short");
        require(_dateMax - _dateMin <= 12 hours, "Too long");
        require(proposalsMade.length < 3, "Only 3 proposals");
        require(
            bytes(gpsData[address(this)].latitude).length > 0 &&
                bytes(gpsData[address(this)].longitude).length > 0,
            "GPS not set"
        );
        bikeShare = IBikeShare(_bikeShareContract);
        require(bikeShare.getProposalsLength() < 5, "Only 5 proposals");
        require(_rentalTime <= bikeShare.maximumRental(), "Time too long");
        uint _rate = bikeShare.rate();
        uint _depositAmount = bikeShare.depositAmount();
        require(_rentalTime % 1 days == 0, "Not multiple of 1 day");
        require(
            W2R.balanceOf(address(this)) >=
                _depositAmount + _rate * (_rentalTime / 1 days),
            "Not enough W2R"
        );
        // call the setProposal function of the BikeShare contract
        bikeShare.setProposal(
            owner,
            _dateMin, // date de la location souhaitée, heure de RDV minimum
            _dateMax, // date de la location souhaitée, heure de RDV maximum
            _rentalTime, // durée de la location souhaitée
            _rate, // taux de location au moment de la proposition
            _depositAmount, // taux du dépôt de garantie au moment de la proposition
            block.timestamp, // date de la proposition
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

    function getProposalsLength() external view returns (uint) {
        return proposalsMade.length;
    }

    function getRentalsLength(address lender) external view returns (uint) {
        return rentals[lender].length;
    }

    // fonction activée par le loueur lorsqu'il accepte une proposition de location
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
        require(isRenting == false, "Already renting");
        require(currentLender == address(0), "Not renting");
        require(msg.sender != address(0));
        require(
            bytes(gpsData[address(this)].latitude).length > 0 &&
                bytes(gpsData[address(this)].longitude).length > 0,
            "GPS not set"
        );
        uint _amountRequired = _rentalPrice + _depositAmount;
        require(
            W2R.balanceOf(address(this)) >= _amountRequired,
            "Insufficient W2R"
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
                    "Proposal expired"
                );
                require(proposal.isAccepted == false, "Already accepted");
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
                        false
                    )
                );
                currentLender = msg.sender;
                totalRentals++;
                W2R.safeTransfer(msg.sender, _amountRequired);
                emit RentalStarted(
                    msg.sender,
                    proposal.date,
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
        require(proposalFound, "No proposal found");
        // delete proposal from the renter as it has been accepted
        while (i < proposalsMade.length) {
            if (proposalsMade[i].lender == currentLender) {
                require(proposalsMade[i].isAccepted == false, "accepted");
                cancelUselessProposals(i);
                break;
            } else {
                i++;
            }
        }
        //delete proposal which date is before the rental date
        for (uint j = 0; j < proposalsMade.length; j++) {
            if (j != i && proposalsMade[j].date < (dateMax + rentalTime)) {
                cancelUselessProposals(j);
            }
        }
    }

    function cancelUselessProposals(uint index) private returns (bool) {
        address lender = proposalsMade[index].lender;
        uint256 date = proposalsMade[index].date;
        proposalsMade[index] = proposalsMade[proposalsMade.length - 1];
        proposalsMade.pop();
        emit ProposalCancelled(address(this), date, lender);
        return true;
    }

    // function to cancel proposal made
    function cancelProposal(
        address _bikeShareContract
    ) public isActivated onlyOwner {
        require(_bikeShareContract != address(0));
        require(proposalsMade.length > 0, "No proposals");
        uint i = 0;
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

    // fonction pour confirmer la prise du vélo appelée par le BikeShare
    function confirmBikeInHands(
        address _bikeShareOwner
    ) external isActivated checkLenderNFT(_bikeShareOwner) renting {
        require(msg.sender == currentLender, "Only lender");
        Rental storage rental = rentals[currentLender][
            rentals[currentLender].length - 1
        ];
        require(rental.cantCancel == false, "Already taken");
        rental.cantCancel = true;
        emit BikeTaken(
            currentLender,
            block.timestamp,
            address(this),
            gpsData[address(this)].latitude,
            gpsData[address(this)].longitude
        );
    }

    // fonction pour confirmer le retour du vélo
    // it is strongly advised that people were physically present at the meeting point
    function returnBike() external isActivated renting onlyOwner {
        Rental storage rental = rentals[currentLender][
            rentals[currentLender].length - 1
        ];
        require(rental.cantCancel == true, "Not taken");
        require(rental.seemsReturned == false, "Already seems returned");
        require(rental.isReturned == false, "Already returned");
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

    // function called by Lender contract to definitely confirm the return of the bike
    function returnConfirmed(
        address _bikeShareOwner
    ) external isActivated checkLenderNFT(_bikeShareOwner) renting {
        require(msg.sender == currentLender, "Only current lender");
        Rental storage rental = rentals[msg.sender][
            rentals[msg.sender].length - 1
        ];
        require(rental.seemsReturned == true, "Seems Not returned");
        require(rental.isReturned == false, "Already returned");
        // set rental as returned
        rental.isReturned = true;
        uint reward = rental.rewardExpected;
        // transfer reward from vault to this contract
        vaultW2R.distributeW2R(address(this), reward);
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

    // function called by Lender contract to cancel the rental
    function cancelledLending(
        uint _refund,
        address _bikeShareOwner,
        bool _isCancelledByLender
    ) external isActivated checkLenderNFT(_bikeShareOwner) renting {
        handleRentalCancellation(
            _refund,
            _bikeShareOwner,
            _isCancelledByLender
        );
    }

    // function to cancel renting before renting began
    function cancelRenting() external isActivated onlyOwner renting {
        handleRentalCancellation(0, address(0), false);
    }

    // helper function to cancel renting
    function handleRentalCancellation(
        uint _refund,
        address _bikeShareOwner,
        bool _isCancelledByLender
    ) private {
        Rental storage rental = rentals[currentLender][
            rentals[currentLender].length - 1
        ];
        require(rental.cantCancel == false, "Cannot cancel");
        require(rental.isReturned == false, "Already returned");
        if (_refund == 0) {
            uint basis = rental.depositAmount + rental.rentalPrice;
            _refund = block.timestamp >= rental.date - 2 hours
                ? basis - (rental.rentalPrice * 1000) / 10000
                : basis;
        }
        if (_bikeShareOwner != address(0)) {
            require(msg.sender == currentLender, "Only current lender");
        } else {
            if (_isCancelledByLender == false) {
                bikeShare = IBikeShare(currentLender);
                bikeShare.cancelledRenting(owner);
            }
        }
        // set rental as returned
        rental.isReturned = true;
        isRenting = false;
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

    function withdrawFunds(uint _amount) external isActivated onlyOwner {
        require(_amount > 0, "Not 0");
        require(W2R.balanceOf(address(this)) >= _amount, "Insufficient W2R");
        W2R.safeTransfer(msg.sender, _amount);
        emit W2Rwithdrawed(msg.sender, _amount, block.timestamp, address(this));
    }

    // function called by whitelist contract to destroy the contract
    function destroy() external returns (bool) {
        require(msg.sender == whitelistRenter, "Only whitelistContract");
        // if is renting and rental duration is not over, revert
        if (isRenting && currentLender != address(0)) {
            Rental memory rental = rentals[currentLender][
                rentals[currentLender].length - 1
            ];
            require(
                block.timestamp > rental.date + rental.rentalTime,
                "Rental Not over"
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
