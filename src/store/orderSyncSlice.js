import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isConnected: false,
  connectionStatus: 'disconnected', // disconnected, connecting, connected, error
  lastSyncTime: null,
  pendingUpdates: [],
  syncInProgress: false,
  orderUpdates: {}, // Track individual order updates
  connectionError: null,
  retryCount: 0,
  maxRetries: 5
};

const orderSyncSlice = createSlice({
  name: 'orderSync',
  initialState,
  reducers: {
    setConnectionStatus: (state, action) => {
      state.connectionStatus = action.payload.status;
      state.isConnected = action.payload.status === 'connected';
      state.connectionError = action.payload.error || null;
      
      if (action.payload.status === 'connected') {
        state.retryCount = 0;
        state.lastSyncTime = new Date().toISOString();
      }
    },
    
    setSyncInProgress: (state, action) => {
      state.syncInProgress = action.payload;
    },
    
    addOrderUpdate: (state, action) => {
      const { orderId, updateType, data, timestamp } = action.payload;
      
      state.orderUpdates[orderId] = {
        ...state.orderUpdates[orderId],
        [updateType]: {
          data,
          timestamp: timestamp || new Date().toISOString(),
          processed: false
        }
      };
      
      // Add to pending updates queue
      state.pendingUpdates.push({
        orderId,
        updateType,
        data,
        timestamp: timestamp || new Date().toISOString()
      });
    },
    
    markUpdateProcessed: (state, action) => {
      const { orderId, updateType } = action.payload;
      
      if (state.orderUpdates[orderId] && state.orderUpdates[orderId][updateType]) {
        state.orderUpdates[orderId][updateType].processed = true;
      }
      
      // Remove from pending updates
      state.pendingUpdates = state.pendingUpdates.filter(
        update => !(update.orderId === orderId && update.updateType === updateType)
      );
    },
    
    clearOrderUpdates: (state, action) => {
      const orderId = action.payload;
      if (orderId) {
        delete state.orderUpdates[orderId];
        state.pendingUpdates = state.pendingUpdates.filter(
          update => update.orderId !== orderId
        );
      } else {
        state.orderUpdates = {};
        state.pendingUpdates = [];
      }
    },
    
    incrementRetryCount: (state) => {
      state.retryCount += 1;
    },
    
    resetRetryCount: (state) => {
      state.retryCount = 0;
    },
    
    updateLastSyncTime: (state) => {
      state.lastSyncTime = new Date().toISOString();
    },
    
    setConnectionError: (state, action) => {
      state.connectionError = action.payload;
      state.connectionStatus = 'error';
      state.isConnected = false;
    },
    
    clearConnectionError: (state) => {
      state.connectionError = null;
    }
  }
});

export const {
  setConnectionStatus,
  setSyncInProgress,
  addOrderUpdate,
  markUpdateProcessed,
  clearOrderUpdates,
  incrementRetryCount,
  resetRetryCount,
  updateLastSyncTime,
  setConnectionError,
  clearConnectionError
} = orderSyncSlice.actions;

// Selectors
export const selectConnectionStatus = (state) => state.orderSync.connectionStatus;
export const selectIsConnected = (state) => state.orderSync.isConnected;
export const selectSyncInProgress = (state) => state.orderSync.syncInProgress;
export const selectPendingUpdates = (state) => state.orderSync.pendingUpdates;
export const selectOrderUpdates = (state) => state.orderSync.orderUpdates;
export const selectLastSyncTime = (state) => state.orderSync.lastSyncTime;
export const selectConnectionError = (state) => state.orderSync.connectionError;
export const selectRetryCount = (state) => state.orderSync.retryCount;

export default orderSyncSlice.reducer;