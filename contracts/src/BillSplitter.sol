// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title BillSplitter - Collect USDC shares from group members, forward to merchant
/// @notice Each session collects deposits and auto-forwards to the merchant once fully funded
contract BillSplitter {
    struct Session {
        address merchant;
        uint256 totalAmount;
        uint256 collected;
        bool settled;
    }

    IERC20 public immutable usdc;
    uint256 public nextSessionId;

    mapping(uint256 => Session) public sessions;
    mapping(uint256 => mapping(address => uint256)) public deposits;

    event SessionCreated(uint256 indexed id, address merchant, uint256 totalAmount);
    event Deposited(uint256 indexed id, address indexed payer, uint256 amount);
    event Settled(uint256 indexed id, address merchant, uint256 totalAmount);

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    function createSession(address merchant, uint256 totalAmount) external returns (uint256 id) {
        require(merchant != address(0), "invalid merchant");
        require(totalAmount > 0, "invalid amount");
        id = nextSessionId++;
        sessions[id] = Session(merchant, totalAmount, 0, false);
        emit SessionCreated(id, merchant, totalAmount);
    }

    function deposit(uint256 sessionId, uint256 amount) external {
        Session storage s = sessions[sessionId];
        require(!s.settled, "already settled");
        require(s.totalAmount > 0, "no session");
        require(amount > 0, "zero amount");

        usdc.transferFrom(msg.sender, address(this), amount);
        deposits[sessionId][msg.sender] += amount;
        s.collected += amount;

        emit Deposited(sessionId, msg.sender, amount);

        if (s.collected >= s.totalAmount) {
            s.settled = true;
            usdc.transfer(s.merchant, s.collected);
            emit Settled(sessionId, s.merchant, s.collected);
        }
    }
}
