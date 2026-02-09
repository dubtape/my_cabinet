import { create } from 'zustand'
import { Role } from '../types'

const FALLBACK_ROLES: Role[] = [
  {
    id: 'prime',
    name: 'PRIME',
    title: '总理',
    version: 1,
    stance: 'Pragmatic, data-driven, decisive',
    personality: 'Calm, authoritative, diplomatic',
    expertise: ['Strategy', 'Decision Making', 'Diplomacy'],
    modelConfig: { provider: 'glm', model: 'glm-4', temperature: 0.7, maxTokens: 2000 },
    evolutionHistory: [],
  },
  {
    id: 'brain',
    name: 'BRAIN',
    title: '主脑',
    version: 1,
    stance: 'Analytical, objective, synthesis-focused',
    personality: 'Calm, insightful, comprehensive',
    expertise: ['Analysis', 'Synthesis'],
    modelConfig: { provider: 'glm', model: 'glm-4', temperature: 0.7, maxTokens: 2000 },
    evolutionHistory: [],
  },
  {
    id: 'critic',
    name: 'CRITIC',
    title: '批评者',
    version: 1,
    stance: 'Skeptical, risk-aware, thorough',
    personality: 'Critical, careful, detail-oriented',
    expertise: ['Risk Assessment', 'Validation'],
    modelConfig: { provider: 'glm', model: 'glm-4', temperature: 0.7, maxTokens: 2000 },
    evolutionHistory: [],
  },
  {
    id: 'finance',
    name: 'FINANCE',
    title: '财政部长',
    version: 1,
    stance: 'Prudent, ROI-focused, realistic',
    personality: 'Analytical, numbers-driven, cautious',
    expertise: ['Budget Analysis', 'ROI'],
    modelConfig: { provider: 'glm', model: 'glm-4', temperature: 0.7, maxTokens: 2000 },
    evolutionHistory: [],
  },
  {
    id: 'works',
    name: 'WORKS',
    title: '实务部长',
    version: 1,
    stance: 'Practical, execution-focused, detail-oriented',
    personality: 'Pragmatic, organized, action-oriented',
    expertise: ['Implementation Planning', 'Operations'],
    modelConfig: { provider: 'glm', model: 'glm-4', temperature: 0.7, maxTokens: 2000 },
    evolutionHistory: [],
  },
]

interface RolesState {
  roles: Role[]
  selectedRoles: string[]
  isLoading: boolean
  error: string | null

  fetchRoles: () => Promise<void>
  toggleRoleSelection: (roleId: string) => void
  setSelectedRoles: (roleIds: string[]) => void
  setRoles: (roles: Role[]) => void
  updateRole: (roleId: string, updates: Partial<Role>) => void
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
      set({
        error: (error as Error).message,
        roles: FALLBACK_ROLES,
        isLoading: false,
      })
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

  setRoles: (roles) => {
    set({ roles })
  },

  updateRole: (roleId, updates) => {
    set((state) => ({
      roles: state.roles.map((role) =>
        role.id === roleId ? { ...role, ...updates } : role
      ),
    }))
  },
}))
