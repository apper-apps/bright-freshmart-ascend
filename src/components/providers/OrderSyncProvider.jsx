import React, { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import webSocketService from '@/services/api/websocketService';
import {
  setConnectionStatus,
  addOrderUpdate,
  setSyncInProgress,
  incrementRetryCount,
  resetRetryCount,
  updateLastSyncTime,
  setConnectionError,
  selectConnectionStatus,
  selectRetryCount
} from '@/store/orderSyncSlice';

const OrderSyncProvider = ({ children }) => {
  const dispatch = useDispatch();
  const connectionStatus = useSelector(selectConnectionStatus);
  const retryCount = useSelector(selectRetryCount);

  // Handle order sync messages from WebSocket
  const handleOrderSyncMessage = useCallback((message) => {
    try {
      const { type, data, orderId, timestamp } = message;
      
      switch (type) {
        case 'order_status_update':
          dispatch(addOrderUpdate({
            orderId,
            updateType: 'status',
            data: {
              status: data.status,
              verificationStatus: data.verificationStatus,
              previousStatus: data.previousStatus
            },
            timestamp
          }));
          
          // Show toast notification for status changes
          if (data.status !== data.previousStatus) {
            toast.success(`Order #${orderId} status updated to ${data.status}`, {
              position: "top-right",
              autoClose: 4000
            });
          }
          break;
          
        case 'order_payment_verified':
          dispatch(addOrderUpdate({
            orderId,
            updateType: 'payment',
            data: {
              verificationStatus: 'verified',
              paymentMethod: data.paymentMethod,
              transactionId: data.transactionId
            },
            timestamp
          }));
          
          toast.success(`Payment verified for Order #${orderId}`, {
            position: "top-right",
            autoClose: 5000
          });
          break;
          
        case 'order_delivery_update':
          dispatch(addOrderUpdate({
            orderId,
            updateType: 'delivery',
            data: {
              deliveryStatus: data.deliveryStatus,
              deliveryPersonId: data.deliveryPersonId,
              estimatedDelivery: data.estimatedDelivery,
              actualDelivery: data.actualDelivery,
              location: data.location
            },
            timestamp
          }));
          
          if (data.deliveryStatus === 'delivered') {
            toast.success(`Order #${orderId} has been delivered!`, {
              position: "top-right",
              autoClose: 6000
            });
          }
          break;
          
        case 'order_created':
          dispatch(addOrderUpdate({
            orderId,
            updateType: 'new_order',
            data: {
              ...data,
              isNew: true
            },
            timestamp
          }));
          
          toast.info(`New order #${orderId} received`, {
            position: "top-right",
            autoClose: 5000
          });
          break;
          
        default:
          console.log('Unknown order sync message type:', type);
      }
      
      dispatch(updateLastSyncTime());
      
    } catch (error) {
      console.error('Error processing order sync message:', error);
      toast.error('Error processing order update');
    }
  }, [dispatch]);

  // Initialize WebSocket connection for order sync
  useEffect(() => {
    const initializeOrderSync = async () => {
      try {
        dispatch(setConnectionStatus({ status: 'connecting' }));
        
        // Subscribe to order sync events
        webSocketService.subscribeToOrderUpdates(handleOrderSyncMessage);
        
        // Monitor connection status
        webSocketService.subscribe('connection_status', (status) => {
          dispatch(setConnectionStatus({ 
            status: status.connected ? 'connected' : 'disconnected',
            error: status.error 
          }));
          
          if (status.connected) {
            dispatch(resetRetryCount());
            toast.success('Real-time order sync connected', {
              position: "bottom-right",
              autoClose: 3000
            });
          } else if (status.error) {
            dispatch(setConnectionError(status.error));
            dispatch(incrementRetryCount());
            
            if (retryCount >= 3) {
              toast.error('Order sync connection failed. Updates may be delayed.', {
                position: "bottom-right",
                autoClose: 5000
              });
            }
          }
        });
        
        // Start connection
        await webSocketService.connect();
        
      } catch (error) {
        console.error('Failed to initialize order sync:', error);
        dispatch(setConnectionError(error.message));
        toast.error('Failed to connect to real-time order sync');
      }
    };

    initializeOrderSync();

    // Cleanup on unmount
    return () => {
      webSocketService.unsubscribeFromOrderUpdates();
      webSocketService.disconnect();
    };
  }, [dispatch, handleOrderSyncMessage, retryCount]);

  // Auto-reconnect logic
  useEffect(() => {
    if (connectionStatus === 'error' && retryCount < 5) {
      const timeout = Math.min(1000 * Math.pow(2, retryCount), 30000); // Exponential backoff
      
      const reconnectTimer = setTimeout(() => {
        dispatch(setConnectionStatus({ status: 'connecting' }));
        webSocketService.connect().catch(() => {
          dispatch(incrementRetryCount());
        });
      }, timeout);

      return () => clearTimeout(reconnectTimer);
    }
  }, [connectionStatus, retryCount, dispatch]);

  return <>{children}</>;
};

export default OrderSyncProvider;