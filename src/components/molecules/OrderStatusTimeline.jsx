import React from 'react';
import ApperIcon from '@/components/ApperIcon';
import { format } from 'date-fns';

function OrderStatusTimeline({ order }) {
  const getStatusHistory = () => {
    if (!order.statusHistory || order.statusHistory.length === 0) {
      return [{
        status: order.status,
        timestamp: order.createdAt,
        previousStatus: null
      }];
    }
    
    return order.statusHistory.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  };

  const getStatusConfig = (status) => {
    const configs = {
      pending: { 
        label: 'Order Placed', 
        icon: 'Clock', 
        color: 'text-red-600', 
        bgColor: 'bg-red-100',
        borderColor: 'border-red-300'
      },
      confirmed: { 
        label: 'Confirmed', 
        icon: 'CheckCircle', 
        color: 'text-green-600', 
        bgColor: 'bg-green-100',
        borderColor: 'border-green-300'
      },
      packed: { 
        label: 'Packed', 
        icon: 'Package', 
        color: 'text-blue-600', 
        bgColor: 'bg-blue-100',
        borderColor: 'border-blue-300'
      },
      shipped: { 
        label: 'Shipped', 
        icon: 'Truck', 
        color: 'text-purple-600', 
        bgColor: 'bg-purple-100',
        borderColor: 'border-purple-300'
      },
      delivered: { 
        label: 'Delivered', 
        icon: 'CheckCircle2', 
        color: 'text-emerald-600', 
        bgColor: 'bg-emerald-100',
        borderColor: 'border-emerald-300'
      },
      cancelled: { 
        label: 'Cancelled', 
        icon: 'X', 
        color: 'text-gray-600', 
        bgColor: 'bg-gray-100',
        borderColor: 'border-gray-300'
      }
    };
    
    return configs[status] || configs.pending;
  };

  const statusHistory = getStatusHistory();
  const currentStatusIndex = statusHistory.findIndex(s => s.status === order.status);

  return (
    <div className="bg-white rounded-lg p-4 border">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <ApperIcon name="History" size={20} className="mr-2 text-blue-600" />
        Order Status Timeline
      </h3>
      
      <div className="space-y-4">
        {statusHistory.map((statusItem, index) => {
          const config = getStatusConfig(statusItem.status);
          const isActive = index <= currentStatusIndex;
          const isCurrent = index === currentStatusIndex;
          
          return (
            <div key={index} className="flex items-start space-x-3">
              {/* Timeline connector */}
              <div className="flex flex-col items-center">
                <div 
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    isActive 
                      ? `${config.bgColor} ${config.borderColor} ${config.color}` 
                      : 'bg-gray-100 border-gray-300 text-gray-400'
                  } ${isCurrent ? 'ring-2 ring-blue-300 ring-offset-2' : ''}`}
                >
                  <ApperIcon name={config.icon} size={16} />
                </div>
                {index < statusHistory.length - 1 && (
                  <div 
                    className={`w-0.5 h-8 mt-2 transition-colors duration-300 ${
                      isActive ? 'bg-blue-300' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
              
              {/* Status info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className={`font-medium ${isActive ? 'text-gray-800' : 'text-gray-500'}`}>
                    {config.label}
                  </h4>
                  {isCurrent && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      Current
                    </span>
                  )}
                </div>
                
                <div className="mt-1 space-y-1">
                  <p className={`text-sm ${isActive ? 'text-gray-600' : 'text-gray-400'}`}>
                    {format(new Date(statusItem.timestamp), 'MMM dd, yyyy • hh:mm a')}
                  </p>
                  
                  {statusItem.previousStatus && (
                    <p className="text-xs text-gray-500">
                      Changed from: {getStatusConfig(statusItem.previousStatus).label}
                    </p>
                  )}
                  
                  {statusItem.notes && (
                    <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                      {statusItem.notes}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default OrderStatusTimeline;