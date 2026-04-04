import { create } from 'zustand';

export interface Expense {
  id: string;
  groupId: string;
  amount: number; // in USD cents
  description: string;
  paidBy: string;
  splitAmong: string[];
  splitType: 'equal' | 'custom';
  shares?: Record<string, number>;
  createdAt: number;
}

export interface Debt {
  from: string;
  to: string;
  amount: number; // in USD cents
}

interface ExpenseStore {
  expenses: Expense[];
  addExpense: (expense: Expense) => void;
  getExpensesForGroup: (groupId: string) => Expense[];
  getDebtsForGroup: (groupId: string) => Debt[];
}

export const useExpenseStore = create<ExpenseStore>((set, get) => ({
  expenses: [],

  addExpense: (expense) =>
    set((state) => ({ expenses: [expense, ...state.expenses] })),

  getExpensesForGroup: (groupId) =>
    get().expenses.filter((e) => e.groupId === groupId),

  getDebtsForGroup: (groupId) => {
    const expenses = get().expenses.filter((e) => e.groupId === groupId);
    const netBalances: Record<string, number> = {};

    for (const expense of expenses) {
      // Payer gets credited
      netBalances[expense.paidBy] = (netBalances[expense.paidBy] || 0) + expense.amount;

      // Split among members
      if (expense.splitType === 'custom' && expense.shares) {
        for (const [address, share] of Object.entries(expense.shares)) {
          netBalances[address] = (netBalances[address] || 0) - share;
        }
      } else {
        const perPerson = Math.floor(expense.amount / expense.splitAmong.length);
        for (const address of expense.splitAmong) {
          netBalances[address] = (netBalances[address] || 0) - perPerson;
        }
      }
    }

    // Convert to simplified debts
    const debtors = Object.entries(netBalances)
      .filter(([, v]) => v < 0)
      .map(([k, v]) => ({ address: k, amount: -v }))
      .sort((a, b) => b.amount - a.amount);

    const creditors = Object.entries(netBalances)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ address: k, amount: v }))
      .sort((a, b) => b.amount - a.amount);

    const debts: Debt[] = [];
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

    return debts;
  },
}));
