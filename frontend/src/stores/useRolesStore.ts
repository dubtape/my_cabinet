import { create } from 'zustand'
import { Role } from '../types'

interface RolesState {
  roles: Role[]
  selectedRoles: string[]
  isLoading: boolean
  error: string | null

  fetchRoles: () => Promise<void>
  toggleRoleSelection: (roleId: string) => void
  setSelectedRoles: (roleIds: string[]) => void
}

export const useRolesStore = create<RolesState>((set, get) => ({
  roles: [],
  selectedRoles: [],
  isLoading: false,
  error: null,

  fetchRoles: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch('/api/roles')
      if (!response.ok) throw new Error('Failed to fetch roles')
      const data = await response.json()
      set({ roles: data, isLoading: false })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  toggleRoleSelection: (roleId: string) => {
    const { selectedRoles } = get()
    if (selectedRoles.includes(roleId)) {
      set({ selectedRoles: selectedRoles.filter((id) => id !== roleId) })
    } else {
      set({ selectedRoles: [...selectedRoles, roleId] })
    }
  },

  setSelectedRoles: (roleIds: string[]) => {
    set({ selectedRoles: roleIds })
  },
}))
