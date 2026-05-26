import type { StateCreator } from 'zustand';
import type { ScopeChip } from '../../types/domain';
import type { WidgetStore } from '../widgetStore';

export interface ScopeSlice {
  chips: ScopeChip[];
  addChip: (chip: ScopeChip) => void;
  resetChips: () => void;
}

export const createScopeSlice: StateCreator<
  WidgetStore,
  [],
  [],
  ScopeSlice
> = (set) => ({
  chips: [],
  addChip: (chip) => set((state) => ({ chips: [...state.chips, chip] })),
  resetChips: () => set({ chips: [] }),
});
