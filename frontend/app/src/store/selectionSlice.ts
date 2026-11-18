import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface SelectionState {
  ids: string[];
}

const initialState: SelectionState = { ids: [] };

export const selectionSlice = createSlice({
  name: 'selection',
  initialState,
  reducers: {
    toggled(state, action: PayloadAction<string>) {
      const at = state.ids.indexOf(action.payload);
      if (at === -1) state.ids.push(action.payload);
      else state.ids.splice(at, 1);
    },
    setAll(state, action: PayloadAction<string[]>) {
      state.ids = action.payload;
    },
    cleared(state) {
      state.ids = [];
    },
  },
});

export const { toggled, setAll, cleared } = selectionSlice.actions;
