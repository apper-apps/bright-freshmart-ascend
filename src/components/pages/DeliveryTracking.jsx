import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import ApperIcon from '@/components/ApperIcon';
import Button from '@/components/atoms/Button';
import Input from '@/components/atoms/Input';
import Loading from '@/components/ui/Loading';
import Error from '@/components/ui/Error';
import Badge from '@/components/atoms/Badge';
import orderService from '@/services/api/orderService';
import { deliveryPersonnelService } from '@/services/api/deliveryPersonnelService';

const DeliveryTracking = () => {
  const [orders, setOrders] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedZone, setSelectedZone] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  const deliveryStatuses = [
    { value: 'all', label: 'All Statuses', color: 'gray' },
    { value: 'pending', label: 'Pending Assignment', color: 'orange' },
    { value: 'assigned', label: 'Assigned', color: 'blue' },
    { value: 'picked_up', label: 'Picked Up', color: 'purple' },
    { value: 'in_transit', label: 'In Transit', color: 'yellow' },
    { value: 'delivered', label: 'Delivered', color: 'green' },
    { value: 'failed', label: 'Failed Delivery', color: 'red' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [ordersData, personnelData] = await Promise.all([
        orderService.getAll(),
        deliveryPersonnelService.getAll()
      ]);
      
      setOrders(ordersData);
      setPersonnel(personnelData);
    } catch (err) {
      setError(err.message);
      toast.error('Failed to load delivery data');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignDelivery = async (orderId, deliveryPersonId) => {
    try {
      await orderService.assignDeliveryPersonnel(orderId, deliveryPersonId);
      await loadData();
      setAssignModalOpen(false);
      setSelectedOrder(null);
      toast.success('Delivery personnel assigned successfully');
    } catch (err) {
      toast.error('Failed to assign delivery personnel');
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await orderService.updateDeliveryStatus(orderId, newStatus);
      await loadData();
      toast.success('Delivery status updated successfully');
    } catch (err) {
      toast.error('Failed to update delivery status');
    }
  };

  const getStatusColor = (status) => {
    const statusObj = deliveryStatuses.find(s => s.value === status);
    return statusObj ? statusObj.color : 'gray';
  };

  const filteredOrders = orders.filter(order => {
    const matchesStatus = selectedStatus === 'all' || order.deliveryStatus === selectedStatus;
    const matchesZone = selectedZone === 'all' || order.deliveryZone === selectedZone;
    const matchesSearch = !searchQuery || 
      order.id.toString().includes(searchQuery) ||
      order.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerAddress?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesStatus && matchesZone && matchesSearch;
  });

  const availablePersonnel = personnel.filter(p => p.status === 'available' && p.isActive);
  const zones = [...new Set(orders.map(order => order.deliveryZone).filter(Boolean))];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Loading type="dashboard" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Error message={error} onRetry={loadData} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Delivery Tracking</h1>
        <p className="text-gray-600">Monitor and manage delivery operations</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {deliveryStatuses.filter(s => s.value !== 'all').map((status) => {
          const count = orders.filter(o => o.deliveryStatus === status.value).length;
          return (
            <div key={status.value} className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{status.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                </div>
                <Badge variant={status.color} className="text-xs">
                  {count}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="card p-6 mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search by order ID, customer name, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex gap-4">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            >
              {deliveryStatuses.map(status => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="all">All Zones</option>
              {zones.map(zone => (
                <option key={zone} value={zone}>
                  Zone {zone}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Delivery Personnel
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Zone
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.map((order) => {
                const deliveryPerson = personnel.find(p => p.Id === order.deliveryPersonId);
                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="bg-primary p-2 rounded-lg mr-3">
                          <ApperIcon name="Package" size={16} className="text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">#{order.id}</p>
                          <p className="text-sm text-gray-500">
                            {format(new Date(order.createdAt), 'MMM dd, yyyy')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {order.customerName || 'Guest Customer'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {order.customerAddress || 'No address provided'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={getStatusColor(order.deliveryStatus)}>
                        {deliveryStatuses.find(s => s.value === order.deliveryStatus)?.label || 'Pending'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {deliveryPerson ? (
                        <div className="flex items-center">
                          <div className="bg-green-100 p-2 rounded-lg mr-3">
                            <ApperIcon name="User" size={16} className="text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{deliveryPerson.name}</p>
                            <p className="text-sm text-gray-500">{deliveryPerson.phone}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">Not assigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.deliveryZone ? `Zone ${order.deliveryZone}` : 'Not set'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {!order.deliveryPersonId && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedOrder(order);
                              setAssignModalOpen(true);
                            }}
                          >
                            <ApperIcon name="UserPlus" size={16} className="mr-1" />
                            Assign
                          </Button>
                        )}
                        {order.deliveryStatus !== 'delivered' && order.deliveryStatus !== 'failed' && (
                          <div className="relative">
                            <select
                              value={order.deliveryStatus || 'pending'}
                              onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                              className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-primary focus:border-primary"
                            >
                              <option value="pending">Pending</option>
                              <option value="assigned">Assigned</option>
                              <option value="picked_up">Picked Up</option>
                              <option value="in_transit">In Transit</option>
                              <option value="delivered">Delivered</option>
                              <option value="failed">Failed</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <ApperIcon name="Package" size={48} className="text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No orders found</p>
            <p className="text-gray-500">Try adjusting your filters or search terms.</p>
          </div>
        )}
      </div>

      {/* Assignment Modal */}
      {assignModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Assign Delivery Personnel</h3>
              <button
                onClick={() => {
                  setAssignModalOpen(false);
                  setSelectedOrder(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <ApperIcon name="X" size={20} />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Order #{selectedOrder.id}
              </p>
              <p className="text-sm text-gray-600">
                {selectedOrder.customerAddress || 'No address provided'}
              </p>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {availablePersonnel.map((person) => (
                <div
                  key={person.Id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleAssignDelivery(selectedOrder.id, person.Id)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-green-100 p-2 rounded-lg">
                      <ApperIcon name="User" size={16} className="text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{person.name}</p>
                      <p className="text-sm text-gray-500">{person.phone}</p>
                      <p className="text-xs text-gray-400">Zone {person.zone}</p>
                    </div>
                  </div>
                  <Badge variant="green" className="text-xs">
                    Available
                  </Badge>
                </div>
              ))}
            </div>

            {availablePersonnel.length === 0 && (
              <div className="text-center py-8">
                <ApperIcon name="Users" size={48} className="text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No available personnel</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Personnel Status */}
      <div className="card p-6 mt-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Delivery Personnel Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {personnel.filter(p => p.isActive).map((person) => (
            <div key={person.Id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
              <div className={`p-3 rounded-lg ${
                person.status === 'available' ? 'bg-green-100' : 
                person.status === 'busy' ? 'bg-yellow-100' : 'bg-red-100'
              }`}>
                <ApperIcon 
                  name="User" 
                  size={20} 
                  className={
                    person.status === 'available' ? 'text-green-600' : 
                    person.status === 'busy' ? 'text-yellow-600' : 'text-red-600'
                  } 
                />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{person.name}</p>
                <p className="text-sm text-gray-500">{person.phone}</p>
                <p className="text-xs text-gray-400">Zone {person.zone}</p>
              </div>
              <Badge 
                variant={
                  person.status === 'available' ? 'green' : 
                  person.status === 'busy' ? 'yellow' : 'red'
                }
              >
                {person.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DeliveryTracking;