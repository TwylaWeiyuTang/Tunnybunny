import { Router } from 'express';
import { randomUUID } from 'crypto';
import { getDb } from '../db/sqlite';

export const groupsRouter = Router();

// Create a group
groupsRouter.post('/', (req, res) => {
  const { id: clientId, name, creator, members } = req.body;
  const id = clientId || randomUUID();
  const db = getDb();

  const insertGroup = db.prepare(
    'INSERT INTO groups (id, name, creator) VALUES (?, ?, ?)'
  );
  const insertMember = db.prepare(
    'INSERT INTO group_members (group_id, address, display_name) VALUES (?, ?, ?)'
  );

  const transaction = db.transaction(() => {
    insertGroup.run(id, name, creator);
    // Add creator as member
    insertMember.run(id, creator, null);
    // Add other members
    for (const member of members || []) {
      insertMember.run(id, member.address, member.displayName || null);
    }
  });

  transaction();
  res.json({ id, name, creator });
});

// Get all groups for a user
groupsRouter.get('/', (req, res) => {
  const { address } = req.query;
  const db = getDb();

  const groups = db.prepare(`
    SELECT g.* FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    WHERE gm.address = ?
    ORDER BY g.created_at DESC
  `).all(address as string);

  res.json(groups);
});

// Get group detail with members
groupsRouter.get('/:id', (req, res) => {
  const db = getDb();
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const members = db.prepare(
    'SELECT address, display_name FROM group_members WHERE group_id = ?'
  ).all(req.params.id);

  res.json({ ...group, members });
});

// Add expense to group
groupsRouter.post('/:id/expenses', (req, res) => {
  const { amount, description, paidBy, splitAmong, splitType, shares } = req.body;
  const groupId = req.params.id;
  const id = randomUUID();
  const db = getDb();

  const insertExpense = db.prepare(
    'INSERT INTO expenses (id, group_id, amount, description, paid_by, split_type) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertSplit = db.prepare(
    'INSERT INTO expense_splits (expense_id, address, amount) VALUES (?, ?, ?)'
  );

  const transaction = db.transaction(() => {
    insertExpense.run(id, groupId, amount, description, paidBy, splitType || 'equal');

    if ((splitType === 'custom' || splitType === 'roulette') && shares) {
      for (const [address, shareAmount] of Object.entries(shares)) {
        insertSplit.run(id, address, shareAmount);
      }
    } else {
      // Equal split (default)
      const perPerson = Math.floor(amount / splitAmong.length);
      for (const address of splitAmong) {
        insertSplit.run(id, address, perPerson);
      }
    }
  });

  transaction();
  res.json({ id, groupId, amount, description });
});

// Get expenses for a group
groupsRouter.get('/:id/expenses', (req, res) => {
  const db = getDb();
  const expenses = db.prepare(
    'SELECT * FROM expenses WHERE group_id = ? ORDER BY created_at DESC'
  ).all(req.params.id);

  res.json(expenses);
});

// Get balances for a group (who owes whom)
groupsRouter.get('/:id/balances', (req, res) => {
  const db = getDb();
  const groupId = req.params.id;

  // Get all expenses with splits
  const expenses = db.prepare(
    'SELECT * FROM expenses WHERE group_id = ?'
  ).all(groupId) as Array<{ id: string; paid_by: string; amount: number }>;

  // Calculate net balances: positive = owed money, negative = owes money
  const netBalances: Record<string, number> = {};

  for (const expense of expenses) {
    const splits = db.prepare(
      'SELECT address, amount FROM expense_splits WHERE expense_id = ?'
    ).all(expense.id) as Array<{ address: string; amount: number }>;

    // Payer gets credited the full amount
    netBalances[expense.paid_by] = (netBalances[expense.paid_by] || 0) + expense.amount;

    // Each person in the split owes their share
    for (const split of splits) {
      netBalances[split.address] = (netBalances[split.address] || 0) - split.amount;
    }
  }

  // Factor in settlements
  const settlements = db.prepare(
    "SELECT * FROM settlements WHERE group_id = ? AND status = 'completed'"
  ).all(groupId) as Array<{ from_address: string; to_address: string; amount: number }>;

  for (const settlement of settlements) {
    netBalances[settlement.from_address] = (netBalances[settlement.from_address] || 0) + settlement.amount;
    netBalances[settlement.to_address] = (netBalances[settlement.to_address] || 0) - settlement.amount;
  }

  // Convert to debt list (who owes whom)
  const debts: Array<{ from: string; to: string; amount: number }> = [];
  const debtors = Object.entries(netBalances).filter(([, v]) => v < 0).map(([k, v]) => ({ address: k, amount: -v }));
  const creditors = Object.entries(netBalances).filter(([, v]) => v > 0).map(([k, v]) => ({ address: k, amount: v }));

  // Simplified debt simplification
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    if (amount > 0) {
      debts.push({ from: debtors[i].address, to: creditors[j].address, amount });
    }
    debtors[i].amount -= amount;
    creditors[j].amount -= amount;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }

  res.json({ netBalances, debts });
});
