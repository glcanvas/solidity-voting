pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract Voting is Ownable {
    using SafeMath for uint256;

    uint256 private constant VOTING_DURATION_SEC = 3 * 24 * 60 * 60;
    uint256 private constant VOTING_FEE = 0.01 ether;

    /*
     * Structure to hold information about election round;
     */
    struct Election {
        uint256 startTime;
        string name;
        bool exists; // check contains predicate
        bool rewardDistributed;
        mapping(address => uint64) candidatesCount; // 2^64 more than enough
        address[] candidates;
        mapping(address => bool) votedElectorates;
        address[] electorates;
    }

    event VoteForEvent(string electionName, address electorate, address candidate);
    event DistributeReward(uint winnersCount, uint256 winnerReward, uint256 taxes);
    event Received(address, uint);

    mapping(string => Election) private electionsMap;
    string[] private electionsList;

    uint256 private unallocatedTaxMoney;

    constructor() {
        unallocatedTaxMoney = 0;
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    modifier electionExists(string memory electionName) {
        require(electionsMap[electionName].exists, "Election not found");
        _;
    }

    modifier electionStillGoing(string memory electionName) {
        require(
            timeInElectionRange(electionsMap[electionName].startTime),
            "Election is over"
        );
        _;
    }

    modifier electionFinished(string memory electionName) {
        require(
            !timeInElectionRange(electionsMap[electionName].startTime),
            "Election is active"
        );
        _;
    }

    function timeInElectionRange(uint256 startTime) private view returns (bool) {
        return
        startTime <= block.timestamp &&
        block.timestamp <= (startTime + VOTING_DURATION_SEC);
    }

    function createElection(string memory electionName) public onlyOwner {
        require(!electionsMap[electionName].exists, "Election already exists");
        Election storage newElection = electionsMap[electionName];
        newElection.exists = true;
        newElection.rewardDistributed = false;
        newElection.name = electionName;
        newElection.startTime = block.timestamp;
        electionsList.push(electionName);
    }

    function voteForCandidate(string memory electionName, address candidate)
    public
    payable
    electionExists(electionName)
    electionStillGoing(electionName)
    {
        Election storage currentElection = electionsMap[electionName];

        require(
            currentElection.votedElectorates[msg.sender] == false,
            "Elector already voted"
        );
        require(msg.value == VOTING_FEE, "Wrong ethers amount, must be 0.01");
        address payable contractAddress = payable(address(this));
        contractAddress.transfer(VOTING_FEE);

        currentElection.electorates.push(msg.sender);
        currentElection.votedElectorates[msg.sender] = true;

        if (currentElection.candidatesCount[candidate] == 0) {
            currentElection.candidates.push(candidate);
        }
        currentElection.candidatesCount[candidate] += 1;
        emit VoteForEvent(electionName, msg.sender, candidate);
    }


    function distributeReward(uint winner, uint256 amount) public pure returns (uint256, uint256) {
        require(winner > 0, "At least one winner must be exist");
        require(amount > 0, "Winners must receive non empty amount of ethers");

        uint256 taxes = amount / 10;
        // takes worth's 10% only

        // because fractional math is computer's bottleneck
        // we can't just write amount * 0.9 -- we'll lose some ethers
        // we need to use sub command
        uint256 reward = amount - taxes;

        uint256 perAddressReward = reward / winner;
        taxes += reward - perAddressReward * winner;
        // final taxes
        // if we'll use amount % 10 and amount % 90 / winner -- some worth might be stuck in the contract
        // so we carefully handle all places where we may lose ethers
        // and because amount is in ether, we won't work with small values
        return (perAddressReward, taxes);
    }


    function finishElection(string memory electionName)
    public
    payable
    electionExists(electionName)
    electionFinished(electionName)
    {
        Election storage election = electionsMap[electionName];
        require(!election.rewardDistributed, "Reward already distributed");
        election.rewardDistributed = true;
        if (election.electorates.length == 0) {
            emit DistributeReward(0, 0, 0);
            return;
        }
        address[] memory winners;
        uint64 maxVoteCount;
        (winners, maxVoteCount) = getFavorites(electionName);
        uint256 worth = election.electorates.length * VOTING_FEE;

        uint256 perAddressReward;
        uint256 taxes;
        (perAddressReward, taxes) = distributeReward(winners.length, worth);
        for (uint i = 0; i < winners.length; i++) {
            address winner = winners[i];
            payable(winner).transfer(perAddressReward);
        }
        unallocatedTaxMoney = unallocatedTaxMoney.add(taxes);
        emit DistributeReward(winners.length, perAddressReward, taxes);
    }

    function getTaxes() public payable onlyOwner {
        payable(owner()).transfer(unallocatedTaxMoney);
        unallocatedTaxMoney = 0;
    }

    function getunallocatedTaxMoney() public view returns(uint256){
        return unallocatedTaxMoney;
    }

    /*
    * Returns maximum count of votes and candidates count who have this count
    */
    function getLargestVotesFor(string memory electionName) private view electionExists(electionName) returns (uint64, uint64) {
        uint64 maxCount = 0;
        uint64 maxFavoritesCount = 0;
        mapping(address => uint64) storage candidatesCount = electionsMap[electionName].candidatesCount;
        address[] storage candidates = electionsMap[electionName].candidates;

        for (uint i = 0; i < candidates.length; i++) {
            address candidate = candidates[i];
            if (candidatesCount[candidate] == maxCount) {
                maxFavoritesCount += 1;
            }
            if (candidatesCount[candidate] > maxCount) {
                maxCount = candidatesCount[candidate];
                maxFavoritesCount = 1;
            }

        }
        return (maxFavoritesCount, maxCount);
    }

    /*
    * Returns addresses with maximum votes
    */
    function getFavorites(string memory electionName) public view electionExists(electionName) returns (address[] memory, uint64) {
        uint64 maxFavoritesCount;
        uint64 maxCount;
        (maxFavoritesCount, maxCount) = getLargestVotesFor(electionName);
        address [] memory favoriteCandidates = new address[](maxFavoritesCount);

        mapping(address => uint64) storage candidatesCount = electionsMap[electionName].candidatesCount;
        address[] storage candidates = electionsMap[electionName].candidates;

        uint64 idx = 0;
        for (uint i = 0; i < candidates.length; i++) {// todo not uint!!!
            address candidate = candidates[i];
            if (candidatesCount[candidate] == maxCount) {
                favoriteCandidates[idx] = candidate;
                idx += 1;
            }

        }
        return (favoriteCandidates, maxCount);
    }

    /*
    * name, start time, is active, rewardDistributed, electorate, candidates, candidates count
    */
    function getElectionInfo(string memory electionName) public view electionExists(electionName)
    returns (string memory, uint256, bool, bool, address[] memory, address[] memory, uint64[] memory)
    {
        Election storage election = electionsMap[electionName];
        uint64[] memory candidatesCount = new uint64[](election.candidates.length);
        for (uint i = 0; i < candidatesCount.length; i++) {// todo nit uint!
            candidatesCount[i] = election.candidatesCount[election.candidates[i]];
        }
        return (electionName,
        election.startTime,
        timeInElectionRange(election.startTime),
        election.rewardDistributed,
        election.electorates,
        election.candidates,
        candidatesCount
        );
    }

    function transferOwnership(address newOwner)
    public
    virtual
    override
    onlyOwner
    {
        revert("Changing the owner is forbidden");
    }

    function getElections() public view returns (string[] memory) {
        return electionsList;
    }


}
