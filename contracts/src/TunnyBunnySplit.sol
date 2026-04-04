// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TunnyBunnySplit - On-chain bill splitting for groups
/// @notice Stores groups, expenses, and balances. Settlement happens via USDC transfers.
contract TunnyBunnySplit {
    struct Group {
        address creator;
        bool active;
        uint256 memberCount;
    }

    struct Expense {
        uint256 amount; // USDC amount in 6 decimals
        address paidBy;
        string description;
        uint256 splitCount;
        uint256 timestamp;
    }

    // Group ID => Group
    mapping(bytes32 => Group) public groups;
    // Group ID => member index => address
    mapping(bytes32 => mapping(uint256 => address)) public groupMembers;
    // Group ID => address => isMember
    mapping(bytes32 => mapping(address => bool)) public isMember;
    // Group ID => expense index => Expense
    mapping(bytes32 => mapping(uint256 => Expense)) public expenses;
    // Group ID => expense count
    mapping(bytes32 => uint256) public expenseCount;
    // Group ID => address => net balance (positive = owed, negative = owes)
    // Stored as two mappings since Solidity doesn't have signed ints in mappings easily
    mapping(bytes32 => mapping(address => uint256)) public credited;
    mapping(bytes32 => mapping(address => uint256)) public debited;

    event GroupCreated(bytes32 indexed groupId, address creator, uint256 memberCount);
    event ExpenseAdded(bytes32 indexed groupId, uint256 indexed expenseId, uint256 amount, address paidBy);
    event DebtSettled(bytes32 indexed groupId, address from, address to, uint256 amount);

    /// @notice Create a new split group
    /// @param members Array of member addresses
    /// @return groupId The unique group identifier
    function createGroup(address[] calldata members) external returns (bytes32 groupId) {
        groupId = keccak256(abi.encodePacked(msg.sender, block.timestamp, members.length));

        Group storage group = groups[groupId];
        require(!group.active, "Group already exists");

        group.creator = msg.sender;
        group.active = true;
        group.memberCount = members.length;

        for (uint256 i = 0; i < members.length; i++) {
            groupMembers[groupId][i] = members[i];
            isMember[groupId][members[i]] = true;
        }

        emit GroupCreated(groupId, msg.sender, members.length);
    }

    /// @notice Add an expense to a group
    /// @param groupId The group to add the expense to
    /// @param amount Amount in USDC (6 decimals)
    /// @param description Description of the expense
    /// @param splitAmong Addresses to split among
    function addExpense(
        bytes32 groupId,
        uint256 amount,
        string calldata description,
        address[] calldata splitAmong
    ) external {
        require(groups[groupId].active, "Group not found");
        require(isMember[groupId][msg.sender], "Not a member");
        require(splitAmong.length > 0, "Must split among at least one");

        uint256 expenseId = expenseCount[groupId];
        expenses[groupId][expenseId] = Expense({
            amount: amount,
            paidBy: msg.sender,
            description: description,
            splitCount: splitAmong.length,
            timestamp: block.timestamp
        });
        expenseCount[groupId]++;

        // Credit the payer
        credited[groupId][msg.sender] += amount;

        // Debit each person in the split
        uint256 perPerson = amount / splitAmong.length;
        for (uint256 i = 0; i < splitAmong.length; i++) {
            require(isMember[groupId][splitAmong[i]], "Split member not in group");
            debited[groupId][splitAmong[i]] += perPerson;
        }

        emit ExpenseAdded(groupId, expenseId, amount, msg.sender);
    }

    /// @notice Settle a debt within a group
    /// @param groupId The group
    /// @param creditor Address being paid
    /// @param amount Amount being settled (USDC 6 decimals)
    function settleDebt(bytes32 groupId, address creditor, uint256 amount) external {
        require(groups[groupId].active, "Group not found");
        require(isMember[groupId][msg.sender], "Not a member");
        require(isMember[groupId][creditor], "Creditor not in group");

        // Reduce debtor's debt and creditor's credit
        debited[groupId][msg.sender] -= amount;
        credited[groupId][creditor] -= amount;

        emit DebtSettled(groupId, msg.sender, creditor, amount);
    }

    /// @notice Get net balance for a member (credited - debited)
    /// @return balance Positive means owed money, negative means owes money
    function getBalance(bytes32 groupId, address member) external view returns (int256) {
        return int256(credited[groupId][member]) - int256(debited[groupId][member]);
    }

    /// @notice Get group member by index
    function getMember(bytes32 groupId, uint256 index) external view returns (address) {
        return groupMembers[groupId][index];
    }
}
