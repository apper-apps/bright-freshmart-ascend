import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "react-toastify";
import ApperIcon from "@/components/ApperIcon";
import Error from "@/components/ui/Error";
import Loading from "@/components/ui/Loading";
import Orders from "@/components/pages/Orders";
import OrderStatusBadge from "@/components/molecules/OrderStatusBadge";
import { orderService } from "@/services/api/orderService";

const OrderTracking = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPaymentProofModal, setShowPaymentProofModal] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  // Auto-refresh every 30 seconds for new order updates
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const autoRefreshInterval = setInterval(async () => {
      try {
        await loadOrder(true); // Silent refresh
        setLastRefreshTime(new Date());
      } catch (err) {
        console.warn('Auto-refresh failed:', err);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(autoRefreshInterval);
  }, [autoRefreshEnabled, orderId]);

const loadOrder = async (silentRefresh = false) => {
    try {
      if (!silentRefresh) {
        setLoading(true);
        setError(null);
      }
      const data = await orderService.getById(parseInt(orderId));
      setOrder(data);
    } catch (err) {
      if (!silentRefresh) {
        setError(err.message);
      }
    } finally {
      if (!silentRefresh) {
        setLoading(false);
      }
    }
  };

  const handlePaymentProofClick = useCallback(() => {
    if (order?.paymentProof?.dataUrl) {
      setShowPaymentProofModal(true);
    }
  }, [order?.paymentProof?.dataUrl]);

  const toggleAutoRefresh = useCallback(() => {
    setAutoRefreshEnabled(prev => !prev);
    toast.success(
      autoRefreshEnabled ? 'Auto-refresh disabled' : 'Auto-refresh enabled',
      { position: 'top-right', autoClose: 2000 }
    );
  }, [autoRefreshEnabled]);

  const getStatusSteps = () => {
    const steps = [
      { key: 'pending', label: 'Order Placed', icon: 'ShoppingCart' },
      { key: 'confirmed', label: 'Confirmed', icon: 'CheckCircle' },
      { key: 'packed', label: 'Packed', icon: 'Package' },
      { key: 'shipped', label: 'Shipped', icon: 'Truck' },
      { key: 'delivered', label: 'Delivered', icon: 'Home' }
    ];

    const currentIndex = steps.findIndex(step => step.key === order?.status?.toLowerCase());
    
    return steps.map((step, index) => ({
      ...step,
      completed: index <= currentIndex,
      active: index === currentIndex
    }));
  };

if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 bg-gray-200 rounded shimmer"></div>
            <div className="w-24 h-6 bg-gray-200 rounded shimmer"></div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-20 h-6 bg-gray-200 rounded shimmer"></div>
            <div className="w-16 h-6 bg-gray-200 rounded-full shimmer"></div>
          </div>
        </div>

        {/* Order Header Skeleton */}
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="w-32 h-8 bg-gray-200 rounded shimmer mb-2"></div>
              <div className="w-48 h-5 bg-gray-200 rounded shimmer"></div>
            </div>
            <div className="text-right">
              <div className="w-24 h-8 bg-gray-200 rounded shimmer mb-2"></div>
              <div className="w-16 h-5 bg-gray-200 rounded shimmer"></div>
            </div>
          </div>
        </div>

        {/* Order Status Timeline Skeleton */}
        <div className="card p-6 mb-6">
          <div className="w-32 h-6 bg-gray-200 rounded shimmer mb-6"></div>
          <div className="space-y-6">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="flex items-center">
                <div className="w-10 h-10 bg-gray-200 rounded-full shimmer"></div>
                <div className="ml-4 flex-1">
                  <div className="w-24 h-5 bg-gray-200 rounded shimmer mb-1"></div>
                  {item === 2 && <div className="w-20 h-4 bg-gray-200 rounded shimmer"></div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Content Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Order Items Skeleton */}
          <div className="card p-6">
            <div className="w-24 h-6 bg-gray-200 rounded shimmer mb-4"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="w-32 h-5 bg-gray-200 rounded shimmer mb-1"></div>
                    <div className="w-24 h-4 bg-gray-200 rounded shimmer"></div>
                  </div>
                  <div className="w-16 h-5 bg-gray-200 rounded shimmer"></div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-200 pt-4 mt-4 space-y-2">
              <div className="flex justify-between">
                <div className="w-16 h-5 bg-gray-200 rounded shimmer"></div>
                <div className="w-20 h-5 bg-gray-200 rounded shimmer"></div>
              </div>
              <div className="flex justify-between">
                <div className="w-24 h-5 bg-gray-200 rounded shimmer"></div>
                <div className="w-16 h-5 bg-gray-200 rounded shimmer"></div>
              </div>
              <div className="flex justify-between items-center border-t border-gray-200 pt-2">
                <div className="w-12 h-6 bg-gray-200 rounded shimmer"></div>
                <div className="w-24 h-6 bg-gray-200 rounded shimmer"></div>
              </div>
            </div>
          </div>

          {/* Delivery & Payment Information Skeleton */}
          <div className="space-y-6">
            {/* Delivery Info Skeleton */}
            <div className="card p-6">
              <div className="w-36 h-6 bg-gray-200 rounded shimmer mb-4"></div>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="flex items-center space-x-3">
                    <div className="w-4 h-4 bg-gray-200 rounded shimmer"></div>
                    <div className="w-32 h-5 bg-gray-200 rounded shimmer"></div>
                  </div>
                ))}
                <div className="flex items-start space-x-3">
                  <div className="w-4 h-4 bg-gray-200 rounded shimmer mt-1"></div>
                  <div className="flex-1">
                    <div className="w-full h-5 bg-gray-200 rounded shimmer mb-1"></div>
                    <div className="w-24 h-4 bg-gray-200 rounded shimmer"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Info Skeleton */}
            <div className="card p-6">
              <div className="w-32 h-6 bg-gray-200 rounded shimmer mb-4"></div>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 bg-gray-200 rounded shimmer"></div>
                  <div className="w-20 h-5 bg-gray-200 rounded shimmer"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 bg-gray-200 rounded shimmer"></div>
                  <div className="w-28 h-5 bg-gray-200 rounded shimmer"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Error message={error} onRetry={loadOrder} type="not-found" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Error message="Order not found" onRetry={() => navigate('/orders')} type="not-found" />
      </div>
    );
  }

  const statusSteps = getStatusSteps();

return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {/* Header */}
<div className="flex items-center justify-between mb-8">
        <button
            onClick={() => navigate("/orders")}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors">
            <ApperIcon name="ArrowLeft" size={20} />
            <span>Back to Orders</span>
        </button>
        <div className="flex items-center space-x-4">
            <button
                onClick={toggleAutoRefresh}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  autoRefreshEnabled 
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title={autoRefreshEnabled ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}>
                <ApperIcon name={autoRefreshEnabled ? "RotateCw" : "PauseCircle"} size={16} />
                <span className="hidden sm:inline">
                  {autoRefreshEnabled ? 'Auto-refresh' : 'Refresh paused'}
                </span>
            </button>
            <button
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors">
                <ApperIcon name="MessageCircle" size={16} />
                <span>Chat Support</span>
            </button>
            <OrderStatusBadge status={order.status} />
        </div>
    </div>
    {/* Order Header */}
    <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Order #{order.id}</h1>
                <p className="text-gray-600">Placed on {format(new Date(order.createdAt), "MMMM dd, yyyy • hh:mm a")}
                </p>
            </div>
            <div className="text-right">
                <p className="text-2xl font-bold gradient-text">Rs. {(order?.total || 0).toLocaleString()}
                </p>
                <p className="text-gray-600">{(order?.items || []).length}items</p>
            </div>
        </div>
    </div>
{/* Order Status Timeline */}
    <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Order Status</h2>
            <div className="block sm:hidden text-xs text-gray-500">⟵ Swipe to navigate</div>
        </div>
        
        {/* Mobile Horizontal Timeline */}
        <div className="block sm:hidden">
            <div className="horizontal-timeline-container overflow-x-auto">
                <div className="horizontal-timeline-track flex space-x-8 pb-4 min-w-max">
                    {statusSteps.map((step, index) => (
                        <div key={step.key} className="flex flex-col items-center relative min-w-[100px]">
                            <div
                                className={`
                                    w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all duration-300
                                    ${step.completed ? "bg-gradient-to-r from-primary to-accent text-white shadow-lg" : "bg-gray-200 text-gray-400"}
                                    ${step.active ? "ring-4 ring-primary/20 scale-110" : ""}
                                `}>
                                <ApperIcon name={step.icon} size={20} />
                            </div>
                            <p className={`text-sm font-medium text-center ${step.completed ? "text-gray-900" : "text-gray-400"}`}>
                                {step.label}
                            </p>
                            {step.active && (
                                <div className="mt-1 flex flex-col items-center">
                                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                                    <p className="text-xs text-primary mt-1">Current</p>
                                </div>
                            )}
                            
                            {/* Connecting line */}
                            {index < statusSteps.length - 1 && (
                                <div className={`
                                    absolute top-6 left-12 w-8 h-0.5 
                                    ${step.completed ? "bg-primary" : "bg-gray-200"}
                                `} />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
        
        {/* Desktop Vertical Timeline */}
        <div className="hidden sm:block relative">
            {statusSteps.map((step, index) => (
                <div key={step.key} className="flex items-center mb-6 last:mb-0">
                    <div
                        className={`
                            relative z-10 flex items-center justify-center w-10 h-10 rounded-full
                            ${step.completed ? "bg-gradient-to-r from-primary to-accent text-white" : "bg-gray-200 text-gray-400"}
                        `}>
                        <ApperIcon name={step.icon} size={20} />
                    </div>
                    <div className="ml-4 flex-1">
                        <p className={`font-medium ${step.completed ? "text-gray-900" : "text-gray-400"}`}>
                            {step.label}
                        </p>
                        {step.active && <p className="text-sm text-primary">Current status</p>}
                    </div>
                    {index < statusSteps.length - 1 && (
                        <div className={`
                            absolute left-5 top-10 w-0.5 h-6 -ml-px
                            ${step.completed ? "bg-primary" : "bg-gray-200"}
                        `} />
                    )}
                </div>
            ))}
        </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Items */}
        <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Items</h2>
            <div className="space-y-4">
                {(order?.items || []).map(
                    (item, index) => <div key={index} className="flex items-center justify-between">
                        <div className="flex-1">
                            <p className="font-medium text-gray-900">{item?.name || "Unknown Item"}</p>
                            <p className="text-sm text-gray-600">
                                {item?.quantity || 0}x Rs. {(item?.price || 0).toLocaleString()}
                            </p>
                        </div>
                        <p className="font-medium">Rs. {((item?.quantity || 0) * (item?.price || 0)).toLocaleString()}
                        </p>
                    </div>
                )}
            </div>
            <div className="border-t border-gray-200 pt-4 mt-4">
                <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">Rs. {((order?.total || 0) - (order?.deliveryCharge || 0)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Delivery Charge</span>
                    <span className="font-medium">Rs. {(order?.deliveryCharge || 0).toLocaleString()}</span>
                </div>
                <div
                    className="flex justify-between items-center border-t border-gray-200 pt-2">
                    <span className="text-lg font-semibold text-gray-900">Total</span>
                    <span className="text-lg font-bold gradient-text">Rs. {(order?.total || 0).toLocaleString()}
                    </span>
                </div>
            </div>
        </div>
        {/* Delivery Information */}
        <div className="space-y-6">
            <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Delivery Information</h2>
                <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                        <ApperIcon name="User" size={16} className="text-gray-500" />
                        <span className="text-gray-900">{order.deliveryAddress.name}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                        <ApperIcon name="Phone" size={16} className="text-gray-500" />
                        <span className="text-gray-900">{order.deliveryAddress.phone}</span>
                    </div>
                    {order.deliveryAddress.email && <div className="flex items-center space-x-3">
                        <ApperIcon name="Mail" size={16} className="text-gray-500" />
                        <span className="text-gray-900">{order.deliveryAddress.email}</span>
                    </div>}
                    <div className="flex items-start space-x-3">
                        <ApperIcon name="MapPin" size={16} className="text-gray-500 mt-1" />
                        <div>
                            <p className="text-gray-900">{order.deliveryAddress.address}</p>
                            <p className="text-gray-600">
                                {order.deliveryAddress.city}
                                {order.deliveryAddress.postalCode && `, ${order.deliveryAddress.postalCode}`}
                            </p>
                        </div>
                    </div>
                    {order.deliveryAddress.instructions && <div className="flex items-start space-x-3">
                        <ApperIcon name="MessageSquare" size={16} className="text-gray-500 mt-1" />
                        <p className="text-gray-900">{order.deliveryAddress.instructions}</p>
                    </div>}
                </div>
            </div>
{/* Payment Information */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h2>
                <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                        <ApperIcon name="CreditCard" size={16} className="text-gray-500" />
                        <span className="text-gray-900 capitalize">
                            {order.paymentMethod.replace("_", " ")}
                        </span>
                    </div>
                    <div className="flex items-center space-x-3">
                        <ApperIcon 
                          name={order.paymentStatus === "completed" ? "CheckCircle" : order.paymentStatus === "pending" ? "Clock" : "XCircle"} 
                          size={16} 
                          className={`${order.paymentStatus === "completed" ? "text-green-500" : order.paymentStatus === "pending" ? "text-orange-500" : "text-red-500"}`} 
                        />
                        <span
                            className={`capitalize font-medium ${order.paymentStatus === "completed" ? "text-green-600" : order.paymentStatus === "pending" ? "text-orange-600" : "text-red-600"}`}>
                            Payment {order.paymentStatus}
                        </span>
                    </div>
                    
                    {/* Payment Proof Thumbnail */}
                    {order.paymentProof && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-start space-x-4">
                                <div className="flex-shrink-0">
                                    {order.paymentProof.dataUrl ? (
                                        <button
                                            onClick={handlePaymentProofClick}
                                            className="group relative overflow-hidden rounded-lg border-2 border-blue-200 hover:border-blue-300 transition-colors">
                                            <img
                                                src={order.paymentProof.dataUrl}
                                                alt="Payment proof thumbnail"
                                                className="w-20 h-20 object-cover group-hover:scale-105 transition-transform duration-200"
                                            />
                                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 flex items-center justify-center transition-all duration-200">
                                                <ApperIcon name="ZoomIn" size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </button>
                                    ) : (
                                        <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                                            <ApperIcon name="FileText" size={24} className="text-gray-400" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <ApperIcon name="FileText" size={16} className="text-blue-600" />
                                        <span className="font-medium text-blue-900">Payment Proof</span>
                                        {order.verificationStatus === 'pending' && (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                                Pending Review
                                            </span>
                                        )}
                                        {order.verificationStatus === 'verified' && (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                <ApperIcon name="CheckCircle" size={12} className="mr-1" />
                                                Verified
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-600 mb-1">
                                        File: {order.paymentProof.fileName || 'payment_proof.jpg'}
                                    </p>
                                    {order.paymentProof.uploadedAt && (
                                        <p className="text-xs text-gray-500">
                                            Uploaded: {format(new Date(order.paymentProof.uploadedAt), "MMM dd, yyyy • hh:mm a")}
                                        </p>
                                    )}
                                    {order.paymentProof.dataUrl && (
                                        <button
                                            onClick={handlePaymentProofClick}
                                            className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1">
                                            <ApperIcon name="Eye" size={14} />
                                            <span>View Full Size</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Admin Rejection Message */}
                {(order.status === "payment_rejected" || order.paymentStatus === "verification_failed") && order.verificationNotes && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start space-x-3">
                            <ApperIcon
                                name="AlertCircle"
                                size={20}
                                className="text-red-500 mt-0.5 flex-shrink-0" />
                            <div>
                                <h4 className="font-medium text-red-800 mb-1">Payment Rejected</h4>
                                <p className="text-red-700 text-sm leading-relaxed">
                                    {order.verificationNotes}
                                </p>
                                {order.verifiedAt && (
                                    <p className="text-red-600 text-xs mt-2">
                                        Reviewed on {format(new Date(order.verifiedAt), "MMMM dd, yyyy • hh:mm a")}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Additional Payment Details */}
                <div className="mt-4 space-y-3">
                    {order.paymentResult && (
                        <div className="flex items-center space-x-3">
                            <ApperIcon name="Hash" size={16} className="text-gray-500" />
                            <span className="text-gray-900 font-mono text-sm">
                                {order.paymentResult.transactionId}
                            </span>
                        </div>
                    )}
                    {order.paymentResult?.gatewayResponse && (
                        <div className="flex items-center space-x-3">
                            <ApperIcon name="ExternalLink" size={16} className="text-gray-500" />
                            <span className="text-gray-900 text-sm">
                                Gateway Ref: {order.paymentResult.gatewayResponse.reference}
                            </span>
                        </div>
                    )}
                </div>
            </div>
</div>
    </div>

    {/* Payment Proof Modal */}
    {showPaymentProofModal && order?.paymentProof?.dataUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-75 animate-fade-in">
            <div className="relative max-w-4xl max-h-full bg-white rounded-xl overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Payment Proof</h3>
                        <p className="text-sm text-gray-600">Order #{order.id}</p>
                    </div>
                    <button
                        onClick={() => setShowPaymentProofModal(false)}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100">
                        <ApperIcon name="X" size={20} />
                    </button>
                </div>
                <div className="p-4">
                    <div className="max-h-96 overflow-auto">
                        <img
                            src={order.paymentProof.dataUrl}
                            alt="Payment proof"
                            className="w-full h-auto rounded-lg shadow-sm loaded"
                            style={{ maxHeight: '70vh', objectFit: 'contain' }}
                        />
                    </div>
                    <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                        <span>File: {order.paymentProof.fileName || 'payment_proof.jpg'}</span>
                        {order.paymentProof.uploadedAt && (
                            <span>
                                Uploaded: {format(new Date(order.paymentProof.uploadedAt), "MMM dd, yyyy • hh:mm a")}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )}

    {/* Auto-refresh Status Indicator */}
    {autoRefreshEnabled && (
        <div className="fixed bottom-4 right-4 z-40">
            <div className="bg-white shadow-lg rounded-lg px-3 py-2 border border-gray-200">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <ApperIcon name="RotateCw" size={14} className="animate-spin" />
                    <span>Auto-updating...</span>
                </div>
            </div>
        </div>
    )}
</div>
  );
};

export default OrderTracking;