import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { contactsApi } from '../api/contactsApi';
import { selectionSlice } from './selectionSlice';

// The store holds only server data (the API slice) and the row selection. Search, filters, sort
// and page live in the URL.
export const store = configureStore({
  reducer: {
    [contactsApi.reducerPath]: contactsApi.reducer,
    [selectionSlice.name]: selectionSlice.reducer,
  },
  middleware: (getDefault) => getDefault().concat(contactsApi.middleware),
});

// Refetch when the window regains focus or the network comes back.
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
