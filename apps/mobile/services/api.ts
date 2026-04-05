const BACKEND_URL = __DEV__
  ? 'http://192.168.1.87:3001'
  : 'https://tunnybunny-api.railway.app';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

// ── Groups ──

export interface ApiGroup {
  id: string;
  name: string;
  creator: string;
  created_at: number;
  members?: Array<{ address: string; display_name: string | null }>;
}

export async function apiCreateGroup(data: {
  name: string;
  creator: string;
  members: Array<{ address: string; displayName?: string }>;
}): Promise<ApiGroup> {
  return request('/api/groups', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiCreateGroupWithId(data: {
  id: string;
  name: string;
  creator: string;
  members: Array<{ address: string; displayName?: string }>;
}): Promise<ApiGroup> {
  return request('/api/groups', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiGetGroupsForUser(address: string): Promise<ApiGroup[]> {
  return request(`/api/groups?address=${encodeURIComponent(address)}`);
}

export async function apiGetGroup(id: string): Promise<ApiGroup> {
  return request(`/api/groups/${id}`);
}

// ── Expenses ──

export interface ApiExpense {
  id: string;
  group_id: string;
  amount: number;
  description: string;
  paid_by: string;
  split_type: string;
  created_at: number;
}

export async function apiAddExpense(
  groupId: string,
  data: {
    amount: number;
    description: string;
    paidBy: string;
    splitAmong: string[];
    splitType: string;
    shares?: Record<string, number>;
  },
): Promise<ApiExpense> {
  return request(`/api/groups/${groupId}/expenses`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiGetExpenses(groupId: string): Promise<ApiExpense[]> {
  return request(`/api/groups/${groupId}/expenses`);
}

// ── Balances ──

export interface ApiBalances {
  netBalances: Record<string, number>;
  debts: Array<{ from: string; to: string; amount: number }>;
}

export async function apiGetBalances(groupId: string): Promise<ApiBalances> {
  return request(`/api/groups/${groupId}/balances`);
}
