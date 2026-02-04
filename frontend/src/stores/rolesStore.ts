import { create } from 'zustand'
import type { Role } from '@/types'

interface RolesStore {
  roles: Role[]
  selectedRole: Role | null
  setRoles: (roles: Role[]) => void
  setSelectedRole: (role: Role | null) => void
  updateRole: (id: string, updates: Partial<Role>) => void
}

export const useRolesStore = create<RolesStore>((set) => ({
  roles: [],
  selectedRole: null,
  setRoles: (roles) => set({ roles }),
  setSelectedRole: (role) => set({ selectedRole: role }),
  updateRole: (id, updates) =>
    set((state) => ({
      roles: state.roles.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      selectedRole:
        state.selectedRole?.id === id ? { ...state.selectedRole, ...updates } : state.selectedRole,
    })),
}))
