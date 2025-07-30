import React from 'react';
import { useSelector } from 'react-redux';
import { selectConnectionStatus, selectIsConnected, selectLastSyncTime } from '@/store/orderSyncSlice';
import ApperIcon from '@/components/ApperIcon';
import { formatDistanceToNow } from 'date-fns';

const OrderSyncIndicator = ({ className = "" }) => {
  const connectionStatus = useSelector(selectConnectionStatus);
  const isConnected = useSelector(selectIsConnected);
  const lastSyncTime = useSelector(selectLastSyncTime);

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          icon: 'CheckCircle',
          label: 'Live',
          description: 'Real-time sync active'
        };
      case 'connecting':
        return {
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          icon: 'RotateCw',
          label: 'Connecting',
          description: 'Establishing connection'
        };
      case 'error':
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          icon: 'AlertCircle',
          label: 'Offline',
          description: 'Connection failed'
        };
      default:
        return {
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          icon: 'WifiOff',
          label: 'Disconnected',
          description: 'No connection'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`
      flex flex-col space-y-1 p-3 rounded-lg border
      ${config.bgColor} ${config.borderColor} ${className}
      transition-all duration-300
    `}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`
            flex items-center justify-center w-6 h-6 rounded-full
            ${config.bgColor} ${config.borderColor} border
          `}>
            <ApperIcon 
              name={config.icon} 
              size={14} 
              className={`
                ${config.color}
                ${connectionStatus === 'connecting' ? 'animate-spin' : ''}
              `}
            />
          </div>
          <span className={`font-medium text-sm ${config.color}`}>
            {config.label}
          </span>
        </div>
        
        {isConnected && (
          <div className={`
            w-2 h-2 rounded-full bg-green-500
            animate-pulse
          `} />
        )}
      </div>
      
      <div className="flex flex-col space-y-1">
        <span className="text-xs text-gray-500">
          {config.description}
        </span>
        
        {lastSyncTime && (
          <span className="text-xs text-gray-400">
            Last sync: {formatDistanceToNow(new Date(lastSyncTime), { addSuffix: true })}
          </span>
        )}
      </div>
    </div>
  );
};

export default OrderSyncIndicator;