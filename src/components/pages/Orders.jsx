import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "react-toastify";
import ClipboardService from "@/services/ClipboardService";
import orderService from "@/services/api/orderService";
import ApperIcon from "@/components/ApperIcon";
import OrderStatusBadge from "@/components/molecules/OrderStatusBadge";
import Loading from "@/components/ui/Loading";
import Error from "@/components/ui/Error";
import Empty from "@/components/ui/Empty";
import Badge from "@/components/atoms/Badge";
import Button from "@/components/atoms/Button";
import { formatCurrency } from "@/utils/currency";
// Order status color mapping for better visual tracking
const getStatusColors = (status, verificationStatus) => {
  if (status === 'pending' || verificationStatus === 'pending') {
    return {
      card: 'border-red-200 bg-red-50',
      header: 'bg-red-100',
      text: 'text-red-900',
      indicator: 'bg-red-500 animate-pulse'
    };
  } else if (status === 'confirmed' || verificationStatus === 'verified') {
    return {
      card: 'border-green-200 bg-green-50',
      header: 'bg-green-100', 
      text: 'text-green-900',
      indicator: 'bg-green-500'
    };
  } else if (status === 'shipped') {
    return {
      card: 'border-blue-200 bg-blue-50',
      header: 'bg-blue-100',
      text: 'text-blue-900', 
      indicator: 'bg-blue-500'
    };
  } else if (status === 'delivered') {
    return {
      card: 'border-emerald-200 bg-emerald-50',
      header: 'bg-emerald-100',
      text: 'text-emerald-900',
      indicator: 'bg-emerald-500'
    };
  }
  return {
    card: 'border-gray-200 bg-white',
    header: 'bg-gray-50',
    text: 'text-gray-900',
    indicator: 'bg-gray-400'
  };
};

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize clipboard service
  const clipboardService = new ClipboardService();

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await orderService.getAll();
      // Sort by most recent first
      const sortedOrders = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(sortedOrders);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
};

  const copyTxnId = async (transactionId) => {
    if (!transactionId) {
      toast.error('No transaction ID available to copy');
      return;
    }

    try {
      const success = await clipboardService.copyTransactionId(transactionId);
      if (!success) {
        // Additional fallback - show transaction ID in alert if clipboard fails
        const shouldShowAlert = window.confirm(
          'Clipboard copy failed. Would you like to see the transaction ID to copy manually?'
        );
        if (shouldShowAlert) {
          alert(`Transaction ID: ${transactionId}`);
        }
      }
    } catch (error) {
      console.error('Error copying transaction ID:', error);
      toast.error('Failed to copy transaction ID');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Loading type="orders" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Error message={error} onRetry={loadOrders} />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Empty 
          type="orders" 
          onAction={() => window.location.href = '/category/All'}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
<div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
        <Link 
          to="/category/All"
          className="flex items-center space-x-2 text-primary hover:text-primary-dark transition-colors"
        >
          <ApperIcon name="Plus" size={20} />
          <span>Shop More</span>
        </Link>
      </div>
      {/* Mobile-first responsive order cards */}
      <div className="space-y-4 sm:space-y-6">
        {orders.map((order) => (
<div key={order.id} className={`card p-4 sm:p-6 hover:shadow-premium transition-all duration-300 mobile-order-card ${getStatusColors(order.status, order.verificationStatus).card}`}>
            {/* Mobile-optimized header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4">
              <div className="flex items-start space-x-3 sm:space-x-4 mb-3 sm:mb-0">
                <div className="bg-gradient-to-r from-primary to-accent p-2 sm:p-3 rounded-lg flex-shrink-0">
                  <ApperIcon name="Package" size={20} className="text-white sm:w-6 sm:h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                    Order #{order.id}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600">
                    {format(new Date(order.createdAt), 'MMM dd, yyyy • hh:mm a')}
                  </p>
                  {order.transactionId && (
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-gray-500 font-mono">
                        TXN: {order.transactionId}
                      </span>
                      <button
                        onClick={() => copyTxnId(order.transactionId)}
                        className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors duration-200 group touch-manipulation min-h-[48px] min-w-[48px] justify-center"
                        title="Copy transaction ID"
                      >
                        <ApperIcon 
                          name="Copy" 
                          size={12} 
                          className="group-hover:scale-110 transition-transform duration-200" 
                        />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Mobile-responsive status and total */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
                <div className="flex items-center space-x-2">
                  <OrderStatusBadge status={order.status} />
                  {/* Approval Status Badge */}
                  {order.approvalStatus && (
                    <div className="flex items-center space-x-1">
                      {order.approvalStatus === 'approved' && (
                        <Badge variant="success" className="text-xs">
                          <ApperIcon name="CheckCircle" size={12} className="mr-1" />
                          Approved
</Badge>
                      )}
                      {order.approvalStatus === 'pending' && (
                        <Badge variant="warning" className="text-xs animate-pulse">
                          <ApperIcon name="Clock" size={12} className="mr-1" />
                          Pending Approval
                        </Badge>
                      )}
                      {order.approvalStatus === 'rejected' && (
                        <Badge variant="danger" className="text-xs">
                          <ApperIcon name="XCircle" size={12} className="mr-1" />
                          Rejected
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
{(order.paymentMethod === 'jazzcash' || order.paymentMethod === 'easypaisa' || order.paymentMethod === 'bank') && (
                  <div className="flex items-center space-x-1">
                    {order.verificationStatus === 'verified' && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full flex items-center">
                        <ApperIcon name="CheckCircle" size={12} className="mr-1" />
                        Payment Verified
                      </span>
                    )}
                    {order.verificationStatus === 'rejected' && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full flex items-center">
                        <ApperIcon name="XCircle" size={12} className="mr-1" />
                        Payment Rejected
                      </span>
                    )}
                    {order.verificationStatus === 'pending' && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full flex items-center">
                        <ApperIcon name="Clock" size={12} className="mr-1" />
                        Pending Verification
                      </span>
                    )}
                  </div>
                )}
                <div className="text-right sm:text-left sm:mt-2">
<p className="text-lg sm:text-xl font-bold gradient-text">
                    {(() => {
                      try {
                        // Enhanced null safety and calculation logic
                        if (!order || typeof order !== 'object') {
                          return formatCurrency(0);
                        }

                        // Calculate subtotal if order total is missing or zero
                        if (!order.total || order.total === 0) {
                          const itemsSubtotal = Array.isArray(order.items) 
                            ? order.items.reduce((sum, item) => {
                                if (!item || typeof item !== 'object') return sum;
                                const price = parseFloat(item.price) || 0;
                                const quantity = parseInt(item.quantity) || 0;
                                return sum + (price * quantity);
                              }, 0) 
                            : 0;
                          
                          const deliveryCharge = parseFloat(order.deliveryCharge) || 0;
                          return formatCurrency(itemsSubtotal + deliveryCharge);
                        }
                        
                        return formatCurrency(parseFloat(order.total) || 0);
                      } catch (error) {
                        console.error('Error calculating order total:', error);
                        return formatCurrency(0);
                      }
                    })()}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600">
                    {Array.isArray(order?.items) ? order.items.length : 0} items
                  </p>
                </div>
              </div>
            </div>
            {/* Mini Status Timeline for Mobile */}
            <div className="block sm:hidden mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Order Progress</span>
                <span className="text-xs text-gray-500">Swipe to view</span>
              </div>
              <div className="horizontal-timeline-container overflow-x-auto">
                <div className="horizontal-timeline-track flex space-x-4 pb-2">
                  {['pending', 'confirmed', 'packed', 'shipped', 'delivered'].map((status, index) => {
                    const statusIcons = {
                      pending: 'ShoppingCart',
                      confirmed: 'CheckCircle',
                      packed: 'Package',
                      shipped: 'Truck',
                      delivered: 'Home'
                    };
                    const statusLabels = {
                      pending: 'Placed',
                      confirmed: 'Confirmed',
                      packed: 'Packed',
                      shipped: 'Shipped',
                      delivered: 'Delivered'
                    };
                    const currentIndex = ['pending', 'confirmed', 'packed', 'shipped', 'delivered'].findIndex(s => s === order.status?.toLowerCase());
                    const isCompleted = index <= currentIndex;
                    const isActive = index === currentIndex;
                    
                    return (
                      <div key={status} className="flex flex-col items-center min-w-[80px]">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
                          isCompleted ? 'bg-gradient-to-r from-primary to-accent text-white' : 'bg-gray-200 text-gray-400'
                        }`}>
                          <ApperIcon name={statusIcons[status]} size={16} />
                        </div>
<span className={`text-xs font-medium ${isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>
                          {statusLabels[status]}
                        </span>
                        {isActive && (
                          <div className="w-2 h-2 bg-primary rounded-full mt-1 animate-pulse"></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Order Details Section */}
            <div>
{/* Enhanced Collapsible Payment Proof Display */}
              {order.paymentProof && (order.paymentMethod === 'jazzcash' || order.paymentMethod === 'easypaisa' || order.paymentMethod === 'bank') && (
                <div className="payment-proof-section mb-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg shadow-sm">
                    <button
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-blue-100 transition-colors duration-200 touch-manipulation focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset rounded-t-lg"
                      onClick={(e) => {
                        const section = e.currentTarget.parentElement;
                        const content = section.querySelector('.payment-proof-content');
                        const icon = e.currentTarget.querySelector('.collapse-icon');
                        
                        if (content.style.maxHeight) {
                          content.style.maxHeight = null;
                          content.classList.remove('expanded');
                          icon.style.transform = 'rotate(0deg)';
                        } else {
                          content.style.maxHeight = content.scrollHeight + 'px';
                          content.classList.add('expanded');
                          icon.style.transform = 'rotate(180deg)';
                        }
                      }}
                      aria-expanded="false"
                      aria-controls="payment-proof-content"
                    >
                      <div className="flex items-center space-x-2">
                        <ApperIcon name="FileImage" size={16} className="text-blue-600" />
                        <h4 className="text-sm font-medium text-blue-900">Payment Proof</h4>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          {order.paymentMethod.toUpperCase()}
                        </span>
                      </div>
                      <ApperIcon 
                        name="ChevronDown" 
                        size={16} 
                        className="text-blue-600 collapse-icon transition-transform duration-200" 
                      />
                    </button>
                    
                    <div 
                      id="payment-proof-content"
                      className="payment-proof-content max-h-0 overflow-hidden transition-all duration-300 ease-in-out"
                    >
                      <div className="px-4 pb-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Payment Details */}
                          <div className="space-y-3">
                            <div className="bg-white rounded-lg p-3 border border-blue-100">
                              <h5 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
                                <ApperIcon name="Info" size={14} className="mr-1" />
                                Payment Details
                              </h5>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-blue-700">File Name:</span>
                                  <span className="font-medium text-blue-900 truncate ml-2 max-w-[150px]" title={order.paymentProof.fileName || 'payment_proof.jpg'}>
                                    {order.paymentProof.fileName || 'payment_proof.jpg'}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-blue-700">Upload Date:</span>
                                  <span className="font-medium text-blue-900">
                                    {format(new Date(order.paymentProof.uploadedAt || order.createdAt), 'MMM dd, yyyy')}
                                  </span>
                                </div>
                                {order.paymentProof.fileSize && (
                                  <div className="flex justify-between">
                                    <span className="text-blue-700">File Size:</span>
                                    <span className="font-medium text-blue-900">
                                      {(order.paymentProof.fileSize / 1024 / 1024).toFixed(2)} MB
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between">
                                  <span className="text-blue-700">Status:</span>
                                  <span className={`font-medium px-2 py-1 rounded-full text-xs ${
                                    order.verificationStatus === 'verified' 
                                      ? 'bg-green-100 text-green-800' 
                                      : order.verificationStatus === 'rejected'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {order.verificationStatus === 'verified' ? 'Verified' : 
                                     order.verificationStatus === 'rejected' ? 'Rejected' : 'Pending'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Enhanced Payment Proof Image Display */}
                          <div className="bg-white rounded-lg p-3 border border-blue-100">
                            <h5 className="text-sm font-medium text-blue-900 mb-3 flex items-center">
                              <ApperIcon name="Image" size={14} className="mr-1" />
                              Payment Proof Image
                            </h5>
                            <div className="relative group image-preview-container">
                              <img
                                src={(() => {
                                  // Enhanced validation and return payment proof image URL
                                  const proofData = order.paymentProof?.dataUrl;
                                  if (proofData && typeof proofData === 'string') {
                                    // Check if it's a valid base64 data URL
                                    if (proofData.startsWith('data:image/') && proofData.includes('base64,')) {
                                      return proofData;
                                    }
                                    // Handle other URL formats (http, https, relative paths)
                                    if (proofData.startsWith('http') || proofData.startsWith('/') || proofData.startsWith('./')) {
                                      return proofData;
                                    }
                                  }
                                  // Enhanced placeholder with better visual feedback
                                  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDIwMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiBmaWxsPSIjRUZGNkZGIiBzdHJva2U9IiNCRkRCRkUiIHN0cm9rZS13aWR0aD0iMiIgcng9IjgiLz4KPHBhdGggZD0iTTgwIDQ1TDEyMCA3NUw4MCA0NVoiIHN0cm9rZT0iIzM5ODBGNiIgc3Ryb2tlLXdpZHRoPSIzIiBmaWxsPSJub25lIi8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjM1IiByPSI4IiBmaWxsPSIjMzk4MEY2Ii8+Cjx0ZXh0IHg9IjEwMCIgeT0iNzAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzM5ODBGNiIgZm9udC13ZWlnaHQ9ImJvbGQiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlBheW1lbnQgUHJvb2Y8L3RleHQ+Cjx0ZXh0IHg9IjEwMCIgeT0iODgiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMCIgZmlsbD0iIzY0NzQ4QiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Q2xpY2sgdG8gRW5sYXJnZTwvdGV4dD4KPHRleHQgeD0iMTAwIiB5PSIxMDAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI4IiBmaWxsPSIjOTQ5M0E2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5UYXAgdG8gdmlldyBmdWxsIHNpemU8L3RleHQ+Cjwvc3ZnPgo=';
                                })()}
                                alt="Payment proof thumbnail"
                                className="w-full h-32 sm:h-40 object-cover rounded-lg border-2 border-blue-200 cursor-pointer transition-all duration-300 group-hover:scale-[1.02] group-hover:border-blue-400 group-hover:shadow-xl touch-manipulation"
                                loading="lazy"
                                onError={(e) => {
                                  // Enhanced error fallback with progressive fallback strategy
                                  const currentSrc = e.target.src;
                                  if (!currentSrc.includes('data:image/svg+xml')) {
                                    // First fallback - try a different error image
                                    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDIwMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiBmaWxsPSIjRkVGMkYyIiBzdHJva2U9IiNGRUNBQ0EiIHN0cm9rZS13aWR0aD0iMiIgcng9IjgiLz4KPHBhdGggZD0iTTcwIDUwSDEzME03MCA2MEgxMzBNNzAgNzBIMTEwIiBzdHJva2U9IiNFRjQ0NDQiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIvPgo8Y2lyY2xlIGN4PSIxMDAiIGN5PSIzNSIgcj0iMTAiIHN0cm9rZT0iI0VGNDQ0NCIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+CjxwYXRoIGQ9Ik05MCAyNUwxMTAgNDVNMTEwIDI1TDkwIDQ1IiBzdHJva2U9IiNFRjQ0NDQiIHN0cm9rZS13aWR0aD0iMiIvPgo8dGV4dCB4PSIxMDAiIHk9Ijk1IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiNFRjQ0NDQiIGZvbnQtd2VpZ2h0PSJib2xkIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5JbWFnZSBOb3QgQXZhaWxhYmxlPC90ZXh0Pgo8dGV4dCB4PSIxMDAiIHk9IjEwOCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjgiIGZpbGw9IiM5QjlDQTAiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkNsaWNrIGZvciBtb3JlIGluZm88L3RleHQ+Cjwvc3ZnPgo=';
                                  }
                                  // Add error class for styling
                                  e.target.classList.add('image-error');
                                }}
                                onLoad={(e) => {
                                  // Add loaded class for styling
                                  e.target.classList.add('image-loaded');
                                }}
                                onClick={() => {
                                  // Enhanced modal display with comprehensive error handling
                                  const proofData = order.paymentProof?.dataUrl;
                                  let imageUrl = proofData;
                                  let hasValidImage = false;
                                  
                                  // Validate image URL before modal display
                                  if (imageUrl && typeof imageUrl === 'string') {
                                    if (imageUrl.startsWith('data:image/') && imageUrl.includes('base64,')) {
                                      hasValidImage = true;
                                    } else if (imageUrl.startsWith('http') || imageUrl.startsWith('/') || imageUrl.startsWith('./')) {
                                      hasValidImage = true;
                                    }
                                  }
                                  
                                  if (!hasValidImage) {
                                    imageUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjlGQUZCIiBzdHJva2U9IiNFNUU3RUIiIHN0cm9rZS13aWR0aD0iMiIgcng9IjEyIi8+CjxjaXJjbGUgY3g9IjIwMCIgY3k9IjEwMCIgcj0iNDAiIGZpbGw9IiNGM0Y0RjYiIHN0cm9rZT0iI0Q0RDREOCIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxwYXRoIGQ9Ik0xODAgODBMMjIwIDEyME0yMjAgODBMMTgwIDEyMCIgc3Ryb2tlPSIjOUI5Q0EwIiBzdHJva2Utd2lkdGg9IjMiLz4KPHR4dCB4PSIyMDAiIHk9IjE2MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE4IiBmaWxsPSIjMzc0MTUxIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXdlaWdodD0iNjAwIj5QYXltZW50IFByb29mPC90ZXh0Pgo8dGV4dCB4PSIyMDAiIHk9IjE4NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNjc3NDgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5JbWFnZSBub3QgYXZhaWxhYmxlPC90ZXh0Pgo8dGV4dCB4PSIyMDAiIHk9IjIwNSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOUI5Q0EwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5UcnkgcmVmcmVzaGluZyB0aGUgcGFnZSBvciBjb250YWN0IHN1cHBvcnQ8L3RleHQ+CjwvPgo=';
                                  }
                                  
                                  // Enhanced modal with improved accessibility and mobile support
                                  const modal = document.createElement('div');
                                  modal.className = 'fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-2 sm:p-4 animate-fade-in';
                                  modal.setAttribute('role', 'dialog');
                                  modal.setAttribute('aria-labelledby', 'modal-title');
                                  modal.setAttribute('aria-modal', 'true');
                                  
                                  modal.innerHTML = `
                                    <div class="relative max-w-6xl max-h-full bg-white rounded-lg shadow-2xl overflow-hidden w-full">
                                      <div class="flex items-center justify-between p-3 sm:p-4 border-b bg-gradient-to-r from-blue-50 to-blue-100">
                                        <div class="flex items-center space-x-2 sm:space-x-3">
                                          <div class="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2">
                                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                              <circle cx="8.5" cy="8.5" r="1.5"/>
                                              <polyline points="21,15 16,10 5,21"/>
                                            </svg>
                                          </div>
                                          <div>
                                            <h3 id="modal-title" class="text-base sm:text-lg font-semibold text-gray-900">Payment Proof</h3>
                                            <p class="text-xs sm:text-sm text-gray-600">Order #${order.id}</p>
                                          </div>
                                        </div>
                                        <button 
                                          class="close-modal bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full p-2 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center touch-manipulation focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          aria-label="Close modal"
                                        >
                                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                          </svg>
                                        </button>
                                      </div>
                                      <div class="p-3 sm:p-6 max-h-[70vh] sm:max-h-[80vh] overflow-auto">
                                        <div class="flex flex-col items-center space-y-4">
                                          <div class="relative max-w-full">
                                            <img 
                                              src="${imageUrl}" 
                                              alt="Payment proof full size" 
                                              class="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg bg-gray-50" 
                                              style="min-height: 200px;"
                                              onload="this.classList.add('loaded'); this.style.opacity='1';"
                                              onerror="this.style.opacity='0.7'; this.classList.add('error');"
                                              style="opacity: 0; transition: opacity 0.3s ease;"
                                            />
                                            ${!hasValidImage ? `
                                              <div class="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg">
                                                <div class="text-center p-4">
                                                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1" class="mx-auto mb-2">
                                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                                    <circle cx="8.5" cy="8.5" r="1.5"/>
                                                    <polyline points="21,15 16,10 5,21"/>
                                                  </svg>
                                                  <p class="text-sm text-gray-500">Image not available</p>
                                                </div>
                                              </div>
                                            ` : ''}
                                          </div>
                                        </div>
                                      </div>
                                      <div class="p-3 sm:p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-t">
                                        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                                          <div class="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-600">
                                            <span class="flex items-center bg-white px-2 py-1 rounded-full">
                                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mr-1">
                                                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                                                <line x1="8" y1="21" x2="16" y2="21"/>
                                                <line x1="12" y1="17" x2="12" y2="21"/>
                                              </svg>
                                              ${order.paymentMethod.toUpperCase()}
                                            </span>
                                            <span class="flex items-center bg-white px-2 py-1 rounded-full">
                                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mr-1">
                                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                                <line x1="16" y1="2" x2="16" y2="6"/>
                                                <line x1="8" y1="2" x2="8" y2="6"/>
                                                <line x1="3" y1="10" x2="21" y2="10"/>
                                              </svg>
                                              ${format(new Date(order.paymentProof?.uploadedAt || order.createdAt), 'MMM dd, yyyy')}
                                            </span>
                                          </div>
                                          <button 
                                            class="download-btn bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                                            onclick="
                                              try {
                                                const link = document.createElement('a');
                                                link.href = '${imageUrl}';
                                                link.download = '${order.paymentProof?.fileName || `payment_proof_order_${order.id}.jpg`}';
                                                document.body.appendChild(link);
                                                link.click();
                                                document.body.removeChild(link);
                                              } catch(e) {
                                                console.warn('Download failed:', e);
                                              }
                                            "
                                          >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="inline mr-1">
                                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                              <polyline points="7,10 12,15 17,10"/>
                                              <line x1="12" y1="15" x2="12" y2="3"/>
                                            </svg>
                                            Download
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  `;
                                  
                                  // Enhanced modal interaction handling
                                  modal.onclick = (e) => {
                                    if (e.target === modal || 
                                        e.target.classList.contains('close-modal') || 
                                        e.target.closest('.close-modal')) {
                                      modal.style.opacity = '0';
                                      modal.style.transform = 'scale(0.95)';
                                      setTimeout(() => {
                                        if (document.body.contains(modal)) {
                                          document.body.removeChild(modal);
                                        }
                                      }, 200);
                                    }
                                  };
                                  
                                  // Keyboard accessibility
                                  modal.addEventListener('keydown', (e) => {
                                    if (e.key === 'Escape') {
                                      modal.querySelector('.close-modal').click();
                                    }
                                  });
                                  
                                  document.body.appendChild(modal);
                                  
                                  // Focus management for accessibility
                                  setTimeout(() => {
                                    modal.querySelector('.close-modal').focus();
                                  }, 100);
                                }}
                              />
                              
                              {/* Enhanced Hover Overlay */}
                              <div className="image-preview-overlay absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center rounded-lg transition-all duration-300">
                                <div className="flex flex-col items-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                  <ApperIcon name="Eye" size={20} className="mb-1" />
                                  <span className="text-xs font-medium">Click to enlarge</span>
                                </div>
                              </div>
                              
                              {/* Status Badge Overlay */}
                              <div className="absolute top-2 right-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  order.verificationStatus === 'verified' 
                                    ? 'bg-green-500 text-white' 
                                    : order.verificationStatus === 'rejected'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-yellow-500 text-white'
                                }`}>
                                  {order.verificationStatus === 'verified' ? '✓' : 
                                   order.verificationStatus === 'rejected' ? '✗' : '⏳'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Additional Actions */}
                        <div className="mt-4 pt-3 border-t border-blue-100">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                            <div className="text-xs text-blue-700">
                              <span className="flex items-center">
                                <ApperIcon name="Shield" size={12} className="mr-1" />
                                Payment proof securely stored and encrypted
                              </span>
                            </div>
                            {order.verificationStatus !== 'verified' && (
                              <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                <span className="flex items-center">
                                  <ApperIcon name="Clock" size={12} className="mr-1" />
                                  Verification in progress
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Order Items Preview */}
              <div className="mt-4 pt-4 border-t border-gray-200">
<h4 className="text-sm font-medium text-gray-900 mb-3">
                  Items ({Array.isArray(order?.items) ? order.items.length : 0})
                </h4>
                <div className="space-y-2">
                  {Array.isArray(order?.items) && order.items.length > 0 ? (
                    <>
                      {order.items.slice(0, 3).map((item, index) => {
                        if (!item || typeof item !== 'object') return null;
                        return (
                          <div key={item.id || index} className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600">
                              {parseInt(item.quantity) || 0}x
                            </span>
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {item.name || 'Unknown Item'}
                            </span>
                          </div>
                        );
                      }).filter(Boolean)}
                      {order.items.length > 3 && (
                        <div className="text-sm text-gray-600">
                          +{order.items.length - 3} more items
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-gray-500 italic">
                      No items found
                    </div>
                  )}
                </div>
              </div>
              {/* Mobile-responsive order actions with swipe actions */}
<div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <ApperIcon name="MapPin" size={14} />
                  <span>{order?.deliveryAddress?.city || 'Not specified'}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <ApperIcon name="CreditCard" size={14} />
                  <span className="capitalize">
                    {order?.paymentMethod ? order.paymentMethod.replace('_', ' ') : 'Not specified'}
                  </span>
                </div>
              </div>
              
              {/* Mobile Swipe Actions */}
              <div className="block sm:hidden">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">Quick Actions</span>
                  <span className="text-xs text-gray-400">⟵ Swipe</span>
                </div>
                <div className="swipe-actions-container overflow-x-auto">
                  <div className="swipe-actions-track flex space-x-2 pb-2">
                    <Link 
                      to={`/orders/${order.id}`}
                      className="flex items-center space-x-1 text-primary hover:text-primary-dark transition-colors text-sm bg-primary/5 px-4 py-2 rounded-lg min-w-[120px] justify-center touch-manipulation"
                    >
                      <ApperIcon name="Eye" size={14} />
                      <span>View Details</span>
                    </Link>
                    
                    <button className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 transition-colors text-sm bg-blue-50 px-4 py-2 rounded-lg min-w-[120px] justify-center touch-manipulation">
                      <ApperIcon name="MessageCircle" size={14} />
                      <span>Chat Support</span>
                    </button>
                    
                    {order.status === 'delivered' && (
                      <button className="flex items-center space-x-1 text-green-600 hover:text-green-700 transition-colors text-sm bg-green-50 px-4 py-2 rounded-lg min-w-[120px] justify-center touch-manipulation">
                        <ApperIcon name="RotateCcw" size={14} />
                        <span>Reorder</span>
                      </button>
                    )}
                    
                    <button className="flex items-center space-x-1 text-orange-600 hover:text-orange-700 transition-colors text-sm bg-orange-50 px-4 py-2 rounded-lg min-w-[120px] justify-center touch-manipulation">
                      <ApperIcon name="Share" size={14} />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Desktop Actions */}
              <div className="hidden sm:flex flex-wrap gap-2 sm:gap-3">
                <Link 
                  to={`/orders/${order.id}`}
                  className="flex items-center space-x-1 sm:space-x-2 text-primary hover:text-primary-dark transition-colors text-sm bg-primary/5 px-3 py-1.5 rounded-lg"
>
                  <ApperIcon name="Eye" size={14} />
                  <span>View Details</span>
                </Link>
                <button className="flex items-center space-x-1 sm:space-x-2 text-blue-600 hover:text-blue-700 transition-colors text-sm bg-blue-50 px-3 py-1.5 rounded-lg">
                  <ApperIcon name="MessageCircle" size={14} />
                  <span>Chat Support</span>
                </button>
                {order.status === 'delivered' && (
                  <button className="flex items-center space-x-1 sm:space-x-2 text-green-600 hover:text-green-700 transition-colors text-sm bg-green-50 px-3 py-1.5 rounded-lg">
                    <ApperIcon name="RotateCcw" size={14} />
                    <span>Reorder</span>
                  </button>
                )}
              </div>
              
              {/* Wallet Transaction Section */}
              {order.walletTransaction && (
                <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <ApperIcon name="Wallet" size={16} className="text-purple-600" />
                    <h4 className="text-sm font-medium text-purple-900">Wallet Transaction</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-purple-700">Transaction ID:</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-purple-900">{order.walletTransaction.transactionId}</span>
                        <button
                          onClick={() => copyTxnId(order.walletTransaction.transactionId)}
                          className="flex items-center text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-1.5 py-0.5 rounded transition-colors duration-200 group"
                          title="Copy wallet transaction ID"
                        >
                          <ApperIcon 
                            name="Copy" 
                            size={10} 
                            className="group-hover:scale-110 transition-transform duration-200" 
                          />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-700">Type:</span>
                      <span className="font-medium text-purple-900 capitalize">
                        {order.walletTransaction.type.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-700">Amount:</span>
                      <span className="font-semibold text-purple-900">
                        {formatCurrency(order.walletTransaction.amount)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Orders;