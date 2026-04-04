// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { VRFConsumerBaseV2Plus } from
    "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import { VRFV2PlusClient } from
    "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

import { IERC20 } from "./BillSplitter.sol";

/// @title BillSplitterRoulette - Split bills with Chainlink VRF randomness
/// @notice Creates random share assignments so one person might pay $0 and another the full bill.
///         Uses the "break a stick" algorithm: generate N-1 random cut points in [0, total],
///         sort them, and the gaps become each person's share.
contract BillSplitterRoulette is VRFConsumerBaseV2Plus {
    struct Session {
        address merchant;
        uint256 totalAmount;
        uint256 collected;
        bool settled;
        bool sharesAssigned;
        address[] participants;
    }

    IERC20 public immutable usdc;
    uint256 public immutable subscriptionId;
    bytes32 public immutable keyHash;

    uint256 public nextSessionId;

    mapping(uint256 => Session) public sessions;
    mapping(uint256 => mapping(address => uint256)) public shares;
    mapping(uint256 => mapping(address => uint256)) public deposits;
    // VRF requestId => sessionId
    mapping(uint256 => uint256) public vrfRequests;

    event SessionCreated(uint256 indexed id, address merchant, uint256 totalAmount);
    event SharesAssigned(uint256 indexed id);
    event ShareRevealed(uint256 indexed id, address indexed participant, uint256 amount);
    event Deposited(uint256 indexed id, address indexed payer, uint256 amount);
    event Settled(uint256 indexed id, address merchant, uint256 totalAmount);

    constructor(
        address _usdc,
        address _vrfCoordinator,
        uint256 _subscriptionId,
        bytes32 _keyHash
    ) VRFConsumerBaseV2Plus(_vrfCoordinator) {
        usdc = IERC20(_usdc);
        subscriptionId = _subscriptionId;
        keyHash = _keyHash;
    }

    /// @notice Create a roulette split session and request VRF randomness
    function createSession(
        address merchant,
        uint256 totalAmount,
        address[] calldata participants
    ) external returns (uint256 id) {
        require(merchant != address(0), "invalid merchant");
        require(totalAmount > 0, "invalid amount");
        require(participants.length >= 2, "need 2+ participants");

        id = nextSessionId++;
        Session storage s = sessions[id];
        s.merchant = merchant;
        s.totalAmount = totalAmount;
        s.participants = participants;

        emit SessionCreated(id, merchant, totalAmount);

        // Request 1 random word from Chainlink VRF
        uint256 requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: 1,
                callbackGasLimit: 500_000,
                numWords: 1,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({ nativePayment: false })
                )
            })
        );
        vrfRequests[requestId] = id;
    }

    /// @notice Chainlink VRF callback — assigns random shares
    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords)
        internal
        override
    {
        uint256 sessionId = vrfRequests[requestId];
        Session storage s = sessions[sessionId];
        require(!s.sharesAssigned, "already assigned");

        uint256 n = s.participants.length;
        uint256 total = s.totalAmount;
        uint256 seed = randomWords[0];

        // "Break a stick" — generate N-1 cut points, sort, compute gaps
        uint256[] memory cuts = new uint256[](n + 1);
        cuts[0] = 0;
        cuts[n] = total;

        for (uint256 i = 1; i < n; i++) {
            // Derive a pseudo-random cut from the VRF seed
            cuts[i] = uint256(keccak256(abi.encodePacked(seed, i))) % (total + 1);
        }

        // Simple insertion sort (N is small, typically 2-8 people)
        for (uint256 i = 1; i <= n; i++) {
            uint256 val = cuts[i];
            uint256 j = i;
            while (j > 0 && cuts[j - 1] > val) {
                cuts[j] = cuts[j - 1];
                j--;
            }
            cuts[j] = val;
        }

        // Assign shares as gaps between sorted cut points
        for (uint256 i = 0; i < n; i++) {
            uint256 share = cuts[i + 1] - cuts[i];
            shares[sessionId][s.participants[i]] = share;
            emit ShareRevealed(sessionId, s.participants[i], share);
        }

        s.sharesAssigned = true;
        emit SharesAssigned(sessionId);
    }

    /// @notice Deposit your assigned share
    function deposit(uint256 sessionId) external {
        Session storage s = sessions[sessionId];
        require(s.sharesAssigned, "shares not assigned yet");
        require(!s.settled, "already settled");

        uint256 myShare = shares[sessionId][msg.sender];
        require(myShare > 0, "no share or already deposited");
        require(deposits[sessionId][msg.sender] == 0, "already deposited");

        if (myShare > 0) {
            usdc.transferFrom(msg.sender, address(this), myShare);
        }
        deposits[sessionId][msg.sender] = myShare;
        s.collected += myShare;

        emit Deposited(sessionId, msg.sender, myShare);

        if (s.collected >= s.totalAmount) {
            s.settled = true;
            usdc.transfer(s.merchant, s.collected);
            emit Settled(sessionId, s.merchant, s.collected);
        }
    }

    /// @notice View a participant's assigned share (0 until VRF callback)
    function getShare(uint256 sessionId, address participant) external view returns (uint256) {
        return shares[sessionId][participant];
    }

    /// @notice Check if shares have been assigned for a session
    function areSharesAssigned(uint256 sessionId) external view returns (bool) {
        return sessions[sessionId].sharesAssigned;
    }

    /// @notice Get participant list for a session
    function getParticipants(uint256 sessionId) external view returns (address[] memory) {
        return sessions[sessionId].participants;
    }
}
