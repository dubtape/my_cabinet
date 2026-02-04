import { create } from 'zustand'
import type { Meeting } from '@/types'

interface MeetingsStore {
  meetings: Meeting[]
  selectedMeeting: Meeting | null
  setMeetings: (meetings: Meeting[]) => void
  setSelectedMeeting: (meeting: Meeting | null) => void
  addMeeting: (meeting: Meeting) => void
  updateMeeting: (id: string, updates: Partial<Meeting>) => void
  appendMessage: (id: string, message: Meeting["messages"][number]) => void
}

export const useMeetingsStore = create<MeetingsStore>((set) => ({
  meetings: [],
  selectedMeeting: null,
  setMeetings: (meetings) => set({ meetings }),
  setSelectedMeeting: (meeting) => set({ selectedMeeting: meeting }),
  addMeeting: (meeting) => set((state) => ({ meetings: [...state.meetings, meeting] })),
  updateMeeting: (id, updates) =>
    set((state) => ({
      meetings: state.meetings.map((m) => (m.id === id ? { ...m, ...updates } : m)),
      selectedMeeting:
        state.selectedMeeting?.id === id
          ? { ...state.selectedMeeting, ...updates }
          : state.selectedMeeting,
    })),
  appendMessage: (id, message) =>
    set((state) => ({
      meetings: state.meetings.map((m) =>
        m.id === id ? { ...m, messages: [...m.messages, message] } : m
      ),
      selectedMeeting:
        state.selectedMeeting?.id === id
          ? { ...state.selectedMeeting, messages: [...state.selectedMeeting.messages, message] }
          : state.selectedMeeting,
    })),
}))
