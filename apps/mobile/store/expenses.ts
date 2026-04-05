import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  apiAddExpense,
  apiGetExpenses,
  apiGetBalances,
  type ApiExpense,
} from '@/services/api';

export interface Expense {
  id: string;
  groupId: string;
  amount: number; // in USD cents
  description: string;
  paidBy: string;
  splitAmong: string[];
  splitType: 'equal' | 'custom' | 'roulette';
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
  removeExpense: (id: string) => void;
  getExpensesForGroup: (groupId: string) => Expense[];
  getDebtsForGroup: (groupId: string) => Debt[];
  syncExpenseToBackend: (expense: Expense) => Promise<void>;
  fetchExpensesFromBackend: (groupId: string) => Promise<void>;
  fetchDebtsFromBackend: (groupId: string) => Promise<Debt[]>;
}

export const useExpenseStore = create<ExpenseStore>()(
  persist(
    (set, get) => ({
      expenses: [],

      addExpense: (expense) => {
        if (get().expenses.some((e) => e.id === expense.id)) return;
        set((state) => ({ expenses: [expense, ...state.expenses] }));
      },

      removeExpense: (id) =>
        set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) })),

      getExpensesForGroup: (groupId) =>
        get().expenses.filter((e) => e.groupId === groupId),

      getDebtsForGroup: (groupId) => {
        const expenses = get().expenses.filter((e) => e.groupId === groupId);
        const netBalances: Record<string, number> = {};

        for (const expense of expenses) {
          netBalances[expense.paidBy] = (netBalances[expense.paidBy] || 0) + expense.amount;

          if ((expense.splitType === 'custom' || expense.splitType === 'roulette') && expense.shares) {
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

      // Push a locally-created expense to the backend
      syncExpenseToBackend: async (expense) => {
        try {
          await apiAddExpense(expense.groupId, {
            amount: expense.amount,
            description: expense.description,
            paidBy: expense.paidBy,
            splitAmong: expense.splitAmong,
            splitType: expense.splitType,
            shares: expense.shares,
          });
        } catch (err) {
          console.warn('Failed to sync expense to backend:', err);
        }
      },

      // Fetch expenses from backend and merge with local
      fetchExpensesFromBackend: async (groupId) => {
        try {
          const remote = await apiGetExpenses(groupId);
          const localIds = new Set(
            get().expenses.filter((e) => e.groupId === groupId).map((e) => e.id)
          );

          const newExpenses: Expense[] = remote
            .filter((r: ApiExpense) => !localIds.has(r.id))
            .map((r: ApiExpense) => ({
              id: r.id,
              groupId: r.group_id,
              amount: r.amount,
              description: r.description,
              paidBy: r.paid_by,
              splitAmong: [], // backend doesn't return this in list, but balances endpoint handles it
              splitType: r.split_type as Expense['splitType'],
              createdAt: r.created_at * 1000,
            }));

          if (newExpenses.length > 0) {
            set((state) => ({
              expenses: [...newExpenses, ...state.expenses],
            }));
          }
        } catch (err) {
          console.warn('Failed to fetch expenses from backend:', err);
        }
      },

      // Fetch computed debts directly from backend (server-side calculation)
      fetchDebtsFromBackend: async (groupId) => {
        try {
          const { debts } = await apiGetBalances(groupId);
          return debts;
        } catch (err) {
          console.warn('Failed to fetch debts from backend:', err);
          return [];
        }
      },
    }),
    {
      name: 'tunnybunny-expenses',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
