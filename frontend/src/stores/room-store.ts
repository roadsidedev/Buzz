import { create } from "zustand"

interface RoomStore {
  activeRoomId: string | null
  isExpanded: boolean
  setRoom: (id: string) => void
  clearRoom: () => void
  setExpanded: (expanded: boolean) => void
}

export const useRoomStore = create<RoomStore>((set) => ({
  activeRoomId: null,
  isExpanded: false,
  setRoom: (id) => set({ activeRoomId: id, isExpanded: false }),
  clearRoom: () => set({ activeRoomId: null, isExpanded: false }),
  setExpanded: (expanded) => set({ isExpanded: expanded }),
}))
