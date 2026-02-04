import { create } from 'zustand'
import { Meeting, Message } from '../types'

interface MeetingState {
  currentMeeting: Meeting | null
  messages: Message[]
  isConnected: boolean
  isRunning: boolean

  setCurrentMeeting: (meeting: Meeting | null) => void
  setMessages: (messages: Message[]) => void
  addMessage: (message: Message) => void
  setConnected: (connected: boolean) => void
  setRunning: (running: boolean) => void
}

export const useMeetingStore = create<MeetingState>((set) => ({
  currentMeeting: null,
  messages: [],
  isConnected: false,
  isRunning: false,

  setCurrentMeeting: (meeting) => set({ currentMeeting: meeting }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setConnected: (connected) => set({ isConnected: connected }),
  setRunning: (running) => set({ isRunning: running }),
}))
