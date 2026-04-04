import { create } from 'zustand';

export interface GroupMember {
  address: string;
  displayName?: string;
}

export interface Group {
  id: string;
  name: string;
  creator: string;
  members: GroupMember[];
  createdAt: number;
}

interface GroupStore {
  groups: Group[];
  addGroup: (group: Group) => void;
  removeGroup: (id: string) => void;
  getGroup: (id: string) => Group | undefined;
  addMember: (groupId: string, member: GroupMember) => void;
}

export const useGroupStore = create<GroupStore>((set, get) => ({
  groups: [],

  addGroup: (group) =>
    set((state) => ({ groups: [group, ...state.groups] })),

  removeGroup: (id) =>
    set((state) => ({ groups: state.groups.filter((g) => g.id !== id) })),

  getGroup: (id) => get().groups.find((g) => g.id === id),

  addMember: (groupId, member) =>
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId ? { ...g, members: [...g.members, member] } : g
      ),
    })),
}));
