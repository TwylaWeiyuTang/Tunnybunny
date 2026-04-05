import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  apiCreateGroup,
  apiGetGroupsForUser,
  apiGetGroup,
  type ApiGroup,
} from '@/services/api';

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
  syncGroupToBackend: (group: Group) => Promise<void>;
  fetchGroupsFromBackend: (address: string) => Promise<void>;
  fetchGroupDetail: (id: string) => Promise<void>;
}

function apiGroupToLocal(g: ApiGroup): Group {
  return {
    id: g.id,
    name: g.name,
    creator: g.creator,
    members: g.members?.map((m) => ({
      address: m.address,
      displayName: m.display_name || undefined,
    })) || [],
    createdAt: g.created_at * 1000, // unix seconds -> ms
  };
}

export const useGroupStore = create<GroupStore>()(
  persist(
    (set, get) => ({
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

      // Push a locally-created group to the backend
      syncGroupToBackend: async (group) => {
        try {
          await apiCreateGroup({
            id: group.id,
            name: group.name,
            creator: group.creator,
            members: group.members.map((m) => ({
              address: m.address,
              displayName: m.displayName,
            })),
          } as any);
        } catch (err) {
          console.warn('Failed to sync group to backend:', err);
        }
      },

      // Fetch all groups this user belongs to from the backend
      // and merge with local groups (backend is source of truth for shared data)
      fetchGroupsFromBackend: async (address) => {
        try {
          const remoteGroups = await apiGetGroupsForUser(address);
          const localGroups = get().groups;
          const localIds = new Set(localGroups.map((g) => g.id));

          // For each remote group, fetch full detail (with members)
          const newGroups: Group[] = [];
          for (const rg of remoteGroups) {
            if (!localIds.has(rg.id)) {
              try {
                const detail = await apiGetGroup(rg.id);
                newGroups.push(apiGroupToLocal(detail));
              } catch {
                newGroups.push(apiGroupToLocal(rg));
              }
            }
          }

          if (newGroups.length > 0) {
            set((state) => ({
              groups: [...state.groups, ...newGroups],
            }));
          }
        } catch (err) {
          console.warn('Failed to fetch groups from backend:', err);
        }
      },

      // Fetch a single group's detail (members) from backend
      fetchGroupDetail: async (id) => {
        try {
          const detail = await apiGetGroup(id);
          const group = apiGroupToLocal(detail);
          set((state) => ({
            groups: state.groups.map((g) => (g.id === id ? { ...g, ...group } : g)),
          }));
        } catch (err) {
          console.warn('Failed to fetch group detail:', err);
        }
      },
    }),
    {
      name: 'tunnybunny-groups',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
