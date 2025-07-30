import ordersData from "../mockData/orders.json";
import { notificationService } from "@/services/api/notificationService";
import webSocketService from "@/services/api/websocketService";
import { paymentService } from "@/services/api/paymentService";
import { productService } from "@/services/api/productService";
class OrderService {
  constructor() {
    this.orders = [...ordersData];
  }

  async getAll() {
    await this.delay();
    return [...this.orders];
  }

async getById(id) {
    try {
      await this.delay();
      
      console.log('OrderService.getById: Called with ID:', id, 'Type:', typeof id);
      
      // Enhanced ID validation with comprehensive checks
      if (id === null || id === undefined) {
        const error = new Error('Order ID is required - cannot be null or undefined');
        console.error('OrderService.getById: Missing ID parameter');
        throw error;
      }
      
      // Ensure ID is an integer with detailed validation
      const numericId = parseInt(id);
      if (isNaN(numericId) || numericId <= 0) {
        const error = new Error(`Invalid order ID format - must be a positive integer. Received: "${id}" (${typeof id})`);
        console.error('OrderService.getById: Invalid ID format:', { id, numericId, type: typeof id });
        throw error;
      }
      
      console.log('OrderService.getById: Searching for order with numeric ID:', numericId);
      console.log('OrderService.getById: Available order IDs:', this.orders.map(o => o.id));
      
      const order = this.orders.find(o => o.id === numericId);
      if (!order) {
        const error = new Error(`Order with ID ${numericId} not found in database`);
        console.error('OrderService.getById: Order not found:', {
          searchId: numericId,
          availableIds: this.orders.map(o => o.id),
          totalOrders: this.orders.length
        });
        throw error;
      }
      
      console.log('OrderService.getById: Found order:', {
        id: order.id,
        hasItems: !!order.items,
        itemCount: order.items?.length || 0,
        status: order.status
      });
      
      // Comprehensive order data integrity validation before returning
      if (!order.items || !Array.isArray(order.items)) {
        console.warn(`OrderService.getById: Order ${numericId} has invalid items data, initializing empty array`);
        order.items = [];
      }
      
      // Validate essential order properties
if (!Object.prototype.hasOwnProperty.call(order, 'status')) {
        console.warn(`OrderService.getById: Order ${numericId} missing status, setting default`);
        order.status = 'pending';
      }
      
      if (!Object.prototype.hasOwnProperty.call(order, 'total') || order.total <= 0) {
        console.warn(`OrderService.getById: Order ${numericId} has invalid total, calculating from items`);
        order.total = order.items.reduce((sum, item) => 
          sum + ((item.price || 0) * (item.quantity || 0)), 0) + (order.deliveryCharge || 0);
      }
      
      // Ensure critical timestamps exist
      if (!order.createdAt) {
        console.warn(`OrderService.getById: Order ${numericId} missing createdAt, using current time`);
        order.createdAt = new Date().toISOString();
      }
      
      console.log('OrderService.getById: Returning validated order data for ID:', numericId);
      return { ...order };
      
    } catch (error) {
      console.error('OrderService.getById: Comprehensive error handling:', error);
      
      // Classify error type for better handling
      if (error.message.includes('not found')) {
        throw new Error(`Order #${id} not found. It may have been deleted or the ID is incorrect.`);
      } else if (error.message.includes('Invalid') || error.message.includes('required')) {
        throw error; // Re-throw validation errors as-is
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        throw new Error('Network error occurred while fetching order. Please check your connection and try again.');
      } else {
        throw new Error('Unable to fetch order details. Please try again later.');
      }
    }
  }

async create(orderData) {
    await this.delay();
    
    // Critical service validation to prevent "DR.createOrder is not a function" errors
    try {
      // Validate required services exist and have expected methods
      if (orderData.paymentMethod === 'wallet') {
        if (!paymentService || typeof paymentService.processWalletPayment !== 'function') {
          const error = new Error('Payment service is not available or missing processWalletPayment method');
          error.code = 'PAYMENT_SERVICE_UNAVAILABLE';
          error.details = { 
            serviceExists: !!paymentService,
            methodExists: !!(paymentService && paymentService.processWalletPayment),
            serviceType: typeof paymentService,
            methodType: paymentService ? typeof paymentService.processWalletPayment : 'undefined'
          };
          throw error;
        }
      }
      
      // Validate notification service for vendor alerts
      if (!notificationService || typeof notificationService.sendVendorOrderAlert !== 'function') {
        console.warn('Notification service unavailable, vendor alerts will be skipped');
      }
    } catch (validationError) {
      console.error('Service validation failed:', validationError);
      throw validationError;
    }
    
    // Enhanced payment data validation
    if (orderData.paymentMethod && orderData.paymentMethod !== 'cash') {
      if (!orderData.paymentResult && orderData.paymentMethod !== 'wallet') {
        const error = new Error('Payment result is required for non-cash payments');
        error.code = 'PAYMENT_RESULT_MISSING';
        throw error;
      }
      
      // Validate payment result structure for digital wallets
      if (['jazzcash', 'easypaisa'].includes(orderData.paymentMethod) && orderData.paymentResult) {
        if (!orderData.paymentResult.transactionId) {
          const error = new Error('Transaction ID is missing from payment result');
          error.code = 'TRANSACTION_ID_MISSING';
          throw error;
        }
      }
    }

    // Initialize vendor availability tracking
    const vendorAvailability = orderData.vendor_availability || {};
    
// Enhanced Order ID generation and validation
    let orderId;
    try {
      orderId = this.getNextId();
      
      // Comprehensive Order ID validation
      if (orderId === null || orderId === undefined) {
        console.error('OrderService.create: Order ID generation returned null/undefined');
        throw new Error('Order ID is required - generation failed');
      }
      
      if (typeof orderId !== 'number') {
        console.error('OrderService.create: Order ID must be a number, got:', typeof orderId, orderId);
        throw new Error('Order ID generation failed - invalid type');
      }
      
      if (orderId <= 0 || !Number.isInteger(orderId)) {
        console.error('OrderService.create: Order ID must be a positive integer, got:', orderId);
        throw new Error('Failed to generate valid order ID - please try again');
      }
      
      // Check for duplicate Order ID (edge case protection)
      const existingOrder = this.orders.find(order => order.id === orderId);
      if (existingOrder) {
        console.error('OrderService.create: Duplicate Order ID detected:', orderId);
        throw new Error('Order ID generation failed - duplicate detected');
      }
      
      console.log('OrderService.create: Successfully generated Order ID:', orderId);
      
    } catch (idError) {
      console.error('OrderService.create: Order ID generation error:', idError);
      throw new Error(`Order ID is required - ${idError.message}`);
    }
    const newOrder = {
      id: orderId,
      ...orderData,
      // Preserve user-provided transaction ID over payment result transaction ID
      transactionId: orderData.transactionId || orderData.paymentResult?.transactionId || null,
      paymentStatus: orderData.paymentStatus || (orderData.paymentMethod === 'cash' ? 'pending' : 'completed'),
      // Ensure both total and totalAmount fields are set for compatibility
      total: orderData.total || orderData.totalAmount || 0,
      totalAmount: orderData.totalAmount || orderData.total || 0,
      // Enhanced approval workflow integration
      approvalStatus: orderData.approvalStatus || 'pending',
      approvalRequestId: orderData.approvalRequestId || null,
      priceApprovalRequired: orderData.priceApprovalRequired || false,
      // Vendor availability tracking (JSONB structure)
      vendor_availability: vendorAvailability,
      // Real-time vendor visibility for Phase 1 implementation - new orders immediately visible
      vendor_visibility: orderData.vendor_visibility || 'immediate',
      // Initial status for vendor portal display - new orders require immediate attention
      status: orderData.status || 'awaiting_payment_verification',
      // Order reservation system for customer support
      reservationStatus: orderData.reservationStatus || null,
      reservationExpiry: orderData.reservationExpiry || null,
      reservationId: orderData.reservationId || null,
      supportContactUsed: orderData.supportContactUsed || null,
      alternativeUploadMethod: orderData.alternativeUploadUsed || null,
      customerSupportNotes: orderData.customerSupportNotes || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

// Enhanced final validation of created order object
    if (!newOrder.id || typeof newOrder.id !== 'number' || newOrder.id <= 0) {
      console.error('OrderService.create: Final order validation failed:', {
        id: newOrder.id,
        idType: typeof newOrder.id,
        orderData: { ...newOrder, items: `${newOrder.items?.length || 0} items` }
      });
      throw new Error('Order ID is required - final validation failed');
    }
    
    // Verify order structure integrity
    if (!newOrder.items || !Array.isArray(newOrder.items) || newOrder.items.length === 0) {
      console.error('OrderService.create: Order must have items:', newOrder.items);
      throw new Error('Order creation failed - no items provided');
    }
    
    console.log('OrderService.create: Order validation passed for ID:', newOrder.id);
// Handle wallet payments with comprehensive error handling
    if (orderData.paymentMethod === 'wallet') {
      try {
        // Double-check service availability before calling
        if (!paymentService?.processWalletPayment) {
          throw new Error('Wallet payment service method not available');
        }
        
        const walletTransaction = await paymentService.processWalletPayment(orderData.total, newOrder.id);
        
        // Validate wallet transaction response
        if (!walletTransaction) {
          throw new Error('Wallet payment returned null/undefined response');
        }
        
        newOrder.paymentResult = walletTransaction;
        newOrder.paymentStatus = 'completed';
      } catch (walletError) {
        // Enhanced wallet error handling with detailed context
        const error = new Error(`Wallet payment failed: ${walletError.message}`);
        error.code = walletError.code || 'WALLET_PAYMENT_FAILED';
        error.originalError = walletError;
        error.context = {
          orderId: newOrder.id,
          amount: orderData.total,
          paymentServiceAvailable: !!paymentService,
          methodAvailable: !!(paymentService?.processWalletPayment),
          timestamp: new Date().toISOString()
        };
        console.error('Wallet payment processing failed:', error);
        throw error;
      }
    }
    
    // Real-time order sync - broadcast to vendors immediately
    if (typeof window !== 'undefined' && window.webSocketService) {
      try {
        window.webSocketService.send({
          type: 'order_created_immediate',
          data: {
            orderId: newOrder.id,
            status: newOrder.status,
            vendor_visibility: newOrder.vendor_visibility,
            timestamp: newOrder.createdAt,
            items: newOrder.items,
            totalAmount: newOrder.totalAmount,
            customerInfo: {
              name: newOrder.deliveryAddress?.name,
              phone: newOrder.deliveryAddress?.phone
            }
          },
          timestamp: new Date().toISOString()
        });
      } catch (wsError) {
        console.warn('WebSocket order broadcast failed:', wsError);
      }
    }
    
    return { ...newOrder };
  }

  // Alias method for backward compatibility - fixes "DR.createOrder is not a function" error
  async createOrder(orderData) {
    return await this.create(orderData);
  }

  async update(id, orderData) {
    await this.delay();
    
    const orderIndex = this.orders.findIndex(o => o.id === parseInt(id));
    if (orderIndex === -1) {
      throw new Error('Order not found');
    }
    
    this.orders[orderIndex] = {
      ...this.orders[orderIndex],
      ...orderData,
      updatedAt: new Date().toISOString()
    };
    
    return { ...this.orders[orderIndex] };
  }

  // Update order status - CRITICAL METHOD IMPLEMENTATION
  async updateOrderStatus(orderId, newStatus, additionalData = {}) {
    try {
      const orderIndex = ordersData.findIndex(order => order.id === orderId);
      
      if (orderIndex === -1) {
        return { 
          success: false, 
          error: 'Order not found',
          message: `Order with ID ${orderId} does not exist`
        };
      }

      const validStatuses = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
      if (!validStatuses.includes(newStatus)) {
        return { 
          success: false, 
          error: 'Invalid status',
          message: `Status '${newStatus}' is not valid. Valid statuses: ${validStatuses.join(', ')}`
};
      }

      const order = ordersData[orderIndex];
      const previousStatus = order.status;
      const currentTimestamp = new Date().toISOString();

      // Create enhanced status history entry
      const statusHistoryEntry = {
        status: newStatus,
        timestamp: currentTimestamp,
        previousStatus,
        changeReason: additionalData.reason || 'Status updated',
        updatedBy: additionalData.updatedBy || 'system',
        notes: additionalData.notes || '',
        ...additionalData
      };

      // Update the order status
      ordersData[orderIndex] = {
        ...order,
        status: newStatus,
        updatedAt: currentTimestamp,
        statusHistory: [
          ...(order.statusHistory || []),
          statusHistoryEntry
        ]
      };

      // Handle status-specific logic
      if (newStatus === 'confirmed') {
        // Auto-assign delivery personnel if not already assigned
        if (!order.deliveryPersonnelId) {
          try {
            const assignmentResult = await this.autoAssignDeliveryPersonnel(ordersData[orderIndex]);
            if (assignmentResult.success) {
              ordersData[orderIndex].deliveryPersonnelId = assignmentResult.deliveryPersonnelId;
            }
          } catch (assignError) {
            console.warn('Could not auto-assign delivery personnel:', assignError);
          }
        }
      }

      return { 
        success: true, 
        data: ordersData[orderIndex],
        message: `Order status updated from '${previousStatus}' to '${newStatus}' successfully`
      };

    } catch (error) {
      console.error('Error updating order status:', error);
      return { 
        success: false, 
        error: 'Update failed',
        message: `Failed to update order status: ${error.message}`
      };
};
    }
  }

  async getVendorOrdersBasic(vendorId) {
    try {
      const orders = ordersData.filter(order => 
        order.items.some(item => item.vendorId === vendorId)
      );
      return { success: true, data: orders };
    } catch (error) {
      console.error('Error fetching vendor orders:', error);
      return { success: false, error: error.message };
    }
  }
  async delete(id) {
    await this.delay();
    const index = this.orders.findIndex(o => o.id === parseInt(id));
    if (index === -1) {
      throw new Error('Order not found');
    }
    this.orders.splice(index, 1);
    return true;
  }

getNextId() {
    try {
      // Enhanced Order ID generation with comprehensive validation
      if (!this.orders || !Array.isArray(this.orders)) {
        console.error('OrderService.getNextId: Orders array is invalid:', this.orders);
        throw new Error('Orders data unavailable for ID generation');
      }
      
      // Find maximum ID with proper validation
      let maxId = 0;
      for (const order of this.orders) {
        if (order && typeof order.id === 'number' && order.id > maxId) {
          maxId = order.id;
        }
      }
      
      const nextId = maxId + 1;
      
      // Validate generated ID
      if (!Number.isInteger(nextId) || nextId <= 0) {
        console.error('OrderService.getNextId: Invalid next ID calculated:', nextId, 'from maxId:', maxId);
        throw new Error('Failed to calculate next order ID');
      }
      
      console.log('OrderService.getNextId: Generated ID:', nextId, 'from', this.orders.length, 'orders');
      return nextId;
      
    } catch (error) {
      console.error('OrderService.getNextId: Error generating order ID:', error);
      // Fallback to timestamp-based ID in case of failure
      const fallbackId = Date.now() % 1000000; // Last 6 digits of timestamp
      console.warn('OrderService.getNextId: Using fallback ID:', fallbackId);
      return fallbackId;
    }
  }
  async assignDeliveryPersonnel(orderId, deliveryPersonId) {
    await this.delay();
    const order = await this.getById(orderId);
    const updatedOrder = {
      ...order,
      deliveryPersonId: deliveryPersonId,
      deliveryStatus: 'assigned'
    };
    return await this.update(orderId, updatedOrder);
  }
async updateDeliveryStatus(orderId, deliveryStatus, actualDelivery = null) {
    await this.delay();
    const order = await this.getById(orderId);
    
    // Map delivery status to order status for user-facing display synchronization
    const deliveryToOrderStatusMap = {
      'pending': 'pending',
      'assigned': 'confirmed', 
      'picked_up': 'packed',        // Critical mapping: picked_up -> packed
      'in_transit': 'shipped',
      'delivered': 'delivered',
      'failed': 'cancelled'
    };
    
    // Get corresponding order status for the delivery status
    const correspondingOrderStatus = deliveryToOrderStatusMap[deliveryStatus];
    
    const updatedOrder = {
      ...order,
      deliveryStatus: deliveryStatus,
      status: correspondingOrderStatus || order.status,
      updatedAt: new Date().toISOString()
    };
    
    if (actualDelivery) {
      updatedOrder.actualDelivery = actualDelivery;
    }
    
    return await this.update(orderId, updatedOrder);
  }

  async verifyOrderPayment(orderId, verificationData) {
    try {
      await this.delay();
      const order = await this.getById(orderId);
      
      if (order.paymentStatus !== 'pending_verification') {
        throw new Error('Order payment does not require verification');
      }
      
      if (!order.paymentResult || !order.paymentResult.transactionId) {
        throw new Error('Order missing payment transaction information');
      }
      
      try {
        const verificationResult = await paymentService.verifyPayment(
          order.paymentResult.transactionId, 
          verificationData
        );
        
        if (verificationResult.verified) {
          const updatedOrder = await this.updatePaymentStatus(orderId, 'completed', verificationResult.transaction);
          return updatedOrder;
        } else {
          throw new Error('Payment verification failed: ' + (verificationResult.reason || 'Unknown verification error'));
        }
      } catch (verificationError) {
        console.error('Payment verification error:', verificationError);
        
        if (verificationError.message.includes('network') || verificationError.message.includes('timeout')) {
          throw new Error('Network error during payment verification. Please try again.');
        } else if (verificationError.message.includes('invalid') || verificationError.message.includes('not found')) {
          throw new Error('Payment transaction could not be verified. Please contact support.');
        } else {
          throw new Error('Payment verification error: ' + verificationError.message);
        }
      }
    } catch (error) {
      console.error('Order payment verification failed:', error);
      
      if (error.message.includes('require verification') || error.message.includes('missing payment')) {
        throw error;
      }
throw new Error('Unable to verify payment. Please try again or contact support.');
    }
  }

  async getMonthlyRevenue() {
    await this.delay();
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    const monthlyOrders = this.orders.filter(order => {
      if (!order.createdAt) return false;
      const orderDate = new Date(order.createdAt);
      return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
    });
    
    return monthlyOrders.reduce((sum, order) => sum + (order?.total || order?.totalAmount || 0), 0);
  }
  async getRevenueByPaymentMethod() {
    await this.delay();
    const revenueByMethod = {};
    
this.orders.forEach(order => {
      const method = order?.paymentMethod || 'unknown';
      revenueByMethod[method] = (revenueByMethod[method] || 0) + (order?.total || order?.totalAmount || 0);
    });
    
    return revenueByMethod;
  }
// Enhanced Payment Verification Methods with Flow Tracking
async getPendingVerifications() {
    await this.delay();
    return this.orders
      .filter(order => {
        // Include orders with payment proof requiring verification
        const hasPaymentProof = order.paymentProof && (order.paymentProof.fileName || order.paymentProofFileName);
        const isPendingVerification = order.verificationStatus === 'pending' || 
                                    (!order.verificationStatus && hasPaymentProof &&
                                     (order.paymentMethod === 'jazzcash' || order.paymentMethod === 'easypaisa' || order.paymentMethod === 'bank'));
        return hasPaymentProof && isPendingVerification;
      })
      .map(order => ({
        Id: order?.id,
        orderId: order?.id,
        transactionId: order?.transactionId || `TXN${order?.id}${Date.now().toString().slice(-4)}`,
        customerName: order?.deliveryAddress?.name || 'Unknown',
        amount: order?.total || order?.totalAmount || 0,
        paymentMethod: order?.paymentMethod || 'unknown',
        paymentProof: order?.paymentProof?.dataUrl || `/api/uploads/${order?.paymentProof?.fileName || order?.paymentProofFileName || 'default.jpg'}`,
        paymentProofFileName: order?.paymentProof?.fileName || order?.paymentProofFileName || 'unknown',
        submittedAt: order?.paymentProof?.uploadedAt || order?.paymentProofSubmittedAt || order?.createdAt,
        verificationStatus: order?.verificationStatus || 'pending',
        // Enhanced Payment Flow Status Tracking
        flowStage: order?.paymentFlowStage || 'awaiting_verification',
        vendorProcessed: order?.vendorProcessed || false,
        adminConfirmed: order?.adminConfirmed || false,
        proofStatus: order?.proofStatus || 'pending',
        amountMatched: order?.amountMatched || false,
        vendorConfirmed: order?.vendorConfirmed || false,
        timestamp: order?.paymentTimestamp || order?.createdAt,
        uploadedAt: order?.paymentProof?.uploadedAt || order?.createdAt,
        // Enhanced approval workflow fields
        approvalStatus: order?.approvalStatus || 'pending',
        approvalRequestId: order?.approvalRequestId || null,
        priceApprovalRequired: order?.priceApprovalRequired || false,
        // Status display helpers
        statusLabel: this.getVerificationStatusLabel(order?.verificationStatus || 'pending'),
        statusColor: this.getVerificationStatusColor(order?.verificationStatus || 'pending'),
        canProcess: this.canProcessPaymentVerification(order)
      }));
  }

  getVerificationStatusLabel(status) {
    const statusMap = {
      'pending': 'Pending Verification',
      'verified': 'Verified',
      'rejected': 'Rejected',
      'processing': 'Processing'
    };
    return statusMap[status] || 'Pending';
  }

  getVerificationStatusColor(status) {
    const colorMap = {
      'pending': 'yellow',
      'verified': 'green', 
      'rejected': 'red',
      'processing': 'blue'
    };
    return colorMap[status] || 'yellow';
  }

  canProcessPaymentVerification(order) {
    return order.verificationStatus === 'pending' || !order.verificationStatus;
  }

async updateVerificationStatus(orderId, status, notes = '') {
    await this.delay();
    const orderIndex = this.orders.findIndex(o => o.id === parseInt(orderId));
    
    if (orderIndex === -1) {
      throw new Error('Order not found');
    }

    const order = this.orders[orderIndex];
    
    if (order.verificationStatus && order.verificationStatus !== 'pending') {
      throw new Error('Order verification is not pending');
    }

    const updatedOrder = {
      ...order,
      verificationStatus: status,
      verificationNotes: notes,
      verifiedAt: new Date().toISOString(),
      verifiedBy: 'admin',
      paymentStatus: status === 'verified' ? 'completed' : 'verification_failed',
      updatedAt: new Date().toISOString(),
      paymentFlowStage: status === 'verified' ? 'verified' : 'rejected'
    };

    // Update order status based on verification result - aligned with delivery tracking
    if (status === 'verified') {
      // When payment is verified by admin, set to pending first, then confirmed
      updatedOrder.status = 'pending'; // Order Placed
      updatedOrder.paymentVerifiedAt = new Date().toISOString();
      updatedOrder.approvalStatus = 'approved'; // Update approval status
      updatedOrder.adminConfirmed = true;
      updatedOrder.proofStatus = 'verified';
      updatedOrder.reservationStatus = 'fulfilled'; // Mark reservation as fulfilled
      
      // Immediately update to confirmed status
      setTimeout(async () => {
        try {
          await this.update(orderId, { status: 'confirmed' });
        } catch (error) {
          console.error('Failed to update order to confirmed:', error);
        }
      }, 100);
    } else if (status === 'rejected') {
      updatedOrder.status = 'payment_rejected';
      updatedOrder.paymentRejectedAt = new Date().toISOString();
      updatedOrder.approvalStatus = 'rejected'; // Update approval status
      updatedOrder.proofStatus = 'rejected';
      updatedOrder.reservationStatus = 'cancelled'; // Cancel reservation
    }

    this.orders[orderIndex] = updatedOrder;
    return { ...updatedOrder };
  }

  // Enhanced reservation management for customer support
  async reserveOrder(orderData, reservationDuration = 3600000) { // 1 hour default
    const reservationId = `RES-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const reservationExpiry = new Date(Date.now() + reservationDuration).toISOString();
    
    const reservedOrder = {
      ...orderData,
      reservationStatus: 'active',
      reservationId,
      reservationExpiry,
      reservationDuration,
      status: 'reserved_pending_verification',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return reservedOrder;
  }

  async extendReservation(orderId, additionalTime = 1800000) { // 30 minutes default
    const orderIndex = this.orders.findIndex(o => o.id === parseInt(orderId));
    if (orderIndex === -1) {
      throw new Error('Order not found');
    }

    const order = this.orders[orderIndex];
    if (order.reservationStatus !== 'active') {
      throw new Error('Order is not reserved');
    }

    const currentExpiry = new Date(order.reservationExpiry);
    const newExpiry = new Date(currentExpiry.getTime() + additionalTime);

    this.orders[orderIndex] = {
      ...order,
      reservationExpiry: newExpiry.toISOString(),
      reservationExtended: true,
      reservationExtendedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return { ...this.orders[orderIndex] };
  }

// Enhanced auto-refresh functionality for order tracking
  async getNewOrdersCount(lastCheckTime) {
    await this.delay();
    const newOrders = this.orders.filter(order => 
      new Date(order.createdAt) > new Date(lastCheckTime) &&
      (order.status === 'payment_pending' || order.verificationStatus === 'pending' || order.status === 'confirmed')
    );
    return newOrders.length;
  }

  // Check for order updates since last refresh
  async checkOrderUpdates(orderId, lastRefreshTime) {
    await this.delay();
    const order = await this.getById(parseInt(orderId));
    if (!order) return { hasUpdates: false };

    const orderUpdatedAt = new Date(order.updatedAt);
    const lastRefresh = new Date(lastRefreshTime);

    return {
      hasUpdates: orderUpdatedAt > lastRefresh,
      order: orderUpdatedAt > lastRefresh ? order : null,
      lastStatusChange: order.statusHistory?.[order.statusHistory.length - 1]?.timestamp || order.createdAt
    };
  }

  async refreshVendorOrders(vendorId) {
    await this.delay();
    // Simulate real-time data refresh
    return this.getVendorOrders(vendorId);
  }

  async getVerificationHistory(orderId) {
    await this.delay();
    const order = await this.getById(orderId);
    
    if (!order.paymentProof) {
      return null;
    }

return {
      orderId: order?.id,
      submittedAt: order?.paymentProofSubmittedAt,
      verifiedAt: order?.verifiedAt,
      status: order?.verificationStatus || 'pending',
      notes: order?.verificationNotes || '',
      paymentProof: order?.paymentProof || null,
      paymentProofFileName: order?.paymentProofFileName || 'unknown'
    };
  }

// Order Calculation Methods
  calculateOrderSubtotal(items) {
    if (!items || !Array.isArray(items)) {
      return 0;
    }
    
    return items.reduce((subtotal, item) => {
      const itemPrice = parseFloat(item.price) || 0;
      const itemQuantity = parseInt(item.quantity) || 0;
      return subtotal + (itemPrice * itemQuantity);
    }, 0);
  }

  calculateOrderTotal(items, deliveryCharge = 0) {
    const subtotal = this.calculateOrderSubtotal(items);
    const delivery = parseFloat(deliveryCharge) || 0;
    return subtotal + delivery;
  }

  validateOrderAmount(order) {
    const calculatedSubtotal = this.calculateOrderSubtotal(order.items);
    const calculatedTotal = this.calculateOrderTotal(order.items, order.deliveryCharge);
    
    // Return calculated values if order total is missing or zero
    if (!order.total || order.total === 0) {
      return {
        subtotal: calculatedSubtotal,
        total: calculatedTotal,
        isCalculated: true
      };
    }
    
    return {
      subtotal: calculatedSubtotal,
      total: order.total,
      isCalculated: false
    };
  }

// Enhanced Vendor Availability Methods with Real-time Tracking
  async updateVendorAvailability(orderId, vendorId, productId, availabilityData) {
    await this.delay();
    
    const orderIndex = this.orders.findIndex(o => o.id === parseInt(orderId));
    if (orderIndex === -1) {
      throw new Error('Order not found');
    }

    const order = this.orders[orderIndex];
    
    // Initialize vendor_availability if not exists
    if (!order.vendor_availability) {
      order.vendor_availability = {};
    }

    // Store availability data with composite key: productId_vendorId
    const availabilityKey = `${productId}_${vendorId}`;
    order.vendor_availability[availabilityKey] = {
      available: availabilityData.available,
      notes: availabilityData.notes || '',
      timestamp: availabilityData.timestamp || new Date().toISOString(),
      vendorId: parseInt(vendorId),
      productId: parseInt(productId),
      // Enhanced real-time response tracking
      responseDeadline: availabilityData.responseDeadline || this.calculateResponseDeadline(order.createdAt),
      responseTime: this.calculateResponseTime(order.createdAt),
      notificationSent: true,
      escalationLevel: this.calculateEscalationLevel(order.createdAt)
    };

    order.updatedAt = new Date().toISOString();
    
    // Update payment flow stage if all items confirmed
    if (this.areAllItemsConfirmed(order)) {
      order.paymentFlowStage = 'availability_confirmed';
      order.fulfillment_stage = 'availability_confirmed';
    }
    
    this.orders[orderIndex] = order;
    
    return { ...order };
  }

  // Helper method to check if all items are confirmed
  areAllItemsConfirmed(order) {
    if (!order.items || !order.vendor_availability) return false;
    
    return order.items.every(item => {
      const vendorId = item.productId % 3 + 1; // Simplified vendor assignment
      const availabilityKey = `${item.productId}_${vendorId}`;
      const availability = order.vendor_availability[availabilityKey];
      return availability && availability.available === true;
    });
  }

  // Calculate response time for vendor availability
  calculateResponseTime(orderCreatedAt) {
    const created = new Date(orderCreatedAt);
    const now = new Date();
    const diffInMinutes = Math.floor((now - created) / (1000 * 60));
    return `${diffInMinutes} minutes`;
  }

  // Calculate escalation level based on response time
  calculateEscalationLevel(orderCreatedAt) {
    const created = new Date(orderCreatedAt);
    const now = new Date();
    const diffInHours = (now - created) / (1000 * 60 * 60);
    
    if (diffInHours > 2) return 'overdue';
    if (diffInHours > 1.5) return 'urgent';
    if (diffInHours > 1) return 'high';
    return 'normal';
  }

  async getVendorOrders(vendorId) {
    await this.delay();
    
    // Filter orders that contain products assigned to this vendor
    // In a real system, this would be based on product-vendor mappings
    return this.orders.filter(order => {
      if (!order.items) return false;
      
      // Simplified vendor assignment logic for demo
      const hasVendorProducts = order.items.some(item => 
        (item.productId % 3 + 1) === parseInt(vendorId)
      );
      
      return hasVendorProducts;
    }).map(order => ({ ...order }));
  }

async getPendingAvailabilityRequests() {
    await this.delay();
    
    return this.orders.filter(order => {
      if (!order.items) return false;
      
      // Only include orders that haven't reached availability_confirmed stage
      if (order.fulfillment_stage && order.fulfillment_stage !== 'pending') {
        return false;
      }
      
      // Check if any products still need vendor availability response
      const hasPendingAvailability = order.items.some(item => {
        const vendorId = item.productId % 3 + 1; // Simplified assignment
        const availabilityKey = `${item.productId}_${vendorId}`;
        return !order.vendor_availability || !order.vendor_availability[availabilityKey];
      });
      
      return hasPendingAvailability;
    }).map(order => ({ 
      ...order,
      responseDeadline: this.calculateResponseDeadline(order.createdAt)
    }));
  }

  calculateResponseDeadline(createdAt) {
    const created = new Date(createdAt);
    const deadline = new Date(created.getTime() + 2 * 60 * 60 * 1000); // 2 hours from creation
    return deadline.toISOString();
  }

  async updateVendorAvailabilityBulk(vendorId, updates) {
    await this.delay();
    
    const results = [];
    for (const update of updates) {
      try {
        const result = await this.updateVendorAvailability(
          update.orderId, 
          vendorId, 
          update.productId, 
          update.availabilityData
        );
        results.push({ orderId: update.orderId, success: true, data: result });
      } catch (error) {
        results.push({ orderId: update.orderId, success: false, error: error.message });
      }
    }
    
    return results;
  }

  async getVendorAvailabilityStatus(orderId) {
    await this.delay();
    
    const order = await this.getById(parseInt(orderId));
    if (!order) {
      throw new Error('Order not found');
    }

    return order.vendor_availability || {};
  }

// Enhanced Vendor Item Management for Order Summary Display
  async getVendorItems(orderId, vendorId) {
    try {
      await this.delay();
      
      console.log('OrderService.getVendorItems: Loading items for order:', orderId, 'vendor:', vendorId);
      
      const order = await this.getById(parseInt(orderId));
      if (!order || !order.items) {
        throw new Error(`Order #${orderId} not found or has no items`);
      }

      // Filter items for the specific vendor
      const vendorItems = order.items.filter(item => {
        const itemVendorId = item.productId % 3 + 1; // Simplified vendor assignment
        return itemVendorId === parseInt(vendorId);
      });

      // Enhance items with vendor-specific data
      const enhancedItems = vendorItems.map(item => ({
        ...item,
        vendorId: parseInt(vendorId),
        vendor: this.getVendorName(parseInt(vendorId)),
        status: this.getItemAvailabilityStatus(order, item.productId, parseInt(vendorId)),
        estimatedPreparationTime: this.calculatePreparationTime(item),
        qualityGrade: this.getQualityGrade(item),
        lastUpdated: new Date().toISOString()
      }));

      console.log('OrderService.getVendorItems: Found', enhancedItems.length, 'items for vendor', vendorId);
      
      return {
        vendor: this.getVendorName(parseInt(vendorId)),
        vendorId: parseInt(vendorId),
        items: enhancedItems,
        totalItems: enhancedItems.length,
        vendorTotal: enhancedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      console.error('OrderService.getVendorItems: Error loading vendor items:', error);
      
      if (error.message.includes('not found')) {
        throw new Error(`Order #${orderId} not found`);
      } else if (error.message.includes('network')) {
        throw new Error('Network error loading vendor items. Please try again.');
      } else {
        throw new Error('Unable to load vendor items. Please try again later.');
      }
    }
  }

  getVendorName(vendorId) {
    const vendors = {
      1: 'Fresh Foods Co.',
      2: 'Premium Grocers', 
      3: 'Organic Market'
    };
    return vendors[vendorId] || 'Unknown Vendor';
  }

  getItemAvailabilityStatus(order, productId, vendorId) {
    if (!order.vendor_availability) return 'pending';
    
    const availabilityKey = `${productId}_${vendorId}`;
    const availability = order.vendor_availability[availabilityKey];
    
    if (!availability) return 'pending';
    return availability.available ? 'available' : 'unavailable';
  }

  calculatePreparationTime(item) {
    // Simple preparation time calculation based on item type
    const baseTime = 15; // 15 minutes base
    const quantityFactor = Math.ceil(item.quantity / 5) * 5; // 5 min per 5 units
    return `${baseTime + quantityFactor} mins`;
  }

  getQualityGrade(item) {
    // Mock quality grades
    const grades = ['Premium', 'Standard', 'Economy'];
    const gradeIndex = item.productId % 3;
    return grades[gradeIndex];
  }

  delay() {
    return new Promise(resolve => setTimeout(resolve, 400));
  }
// Enhanced Fulfillment Workflow Methods with Payment Flow Integration
  async updateFulfillmentStage(orderId, stage, additionalData = {}) {
    await this.delay();
    
    const validStages = [
      'availability_confirmed',
      'packed', 
      'payment_processed',
      'admin_paid',
      'handed_over'
    ];
    
    if (!validStages.includes(stage)) {
      throw new Error(`Invalid fulfillment stage: ${stage}`);
    }
    
    const orderIndex = this.orders.findIndex(o => o.id === parseInt(orderId));
    if (orderIndex === -1) {
      throw new Error('Order not found');
    }

    const order = this.orders[orderIndex];
    
    // Initialize order_status_timestamps if not exists
    if (!order.order_status_timestamps) {
      order.order_status_timestamps = {};
    }
    
    // Enhanced Payment Flow Integration
    if (stage === 'payment_processed') {
      order.vendorProcessed = true;
      order.paymentFlowStage = 'vendor_processed';
      order.paymentTimestamp = new Date().toISOString();
      order.paymentProcessedBy = additionalData.vendorId || 'vendor';
    }
    
    if (stage === 'admin_paid') {
      order.adminConfirmed = true;
      order.paymentFlowStage = 'admin_paid';
      order.adminPaymentTimestamp = new Date().toISOString();
      order.adminPaymentProof = additionalData.proofData || null;
      order.amountMatched = this.checkAmountMatch(order, additionalData.paymentAmount);
    }
    
    // Auto-assign delivery personnel when moving to packed stage
    if (stage === 'packed' && !order.assignedDelivery) {
      const deliveryAssignment = await this.autoAssignDeliveryPersonnel(order);
      order.assignedDelivery = deliveryAssignment;
    }
    
    // Store stage-specific data with payment flow tracking
    if (stage === 'packed' && additionalData) {
      order.packingInfo = {
        ...additionalData,
        completedAt: new Date().toISOString(),
        qualityVerified: additionalData.qualityChecked || false,
        packedBy: additionalData.vendorId || 'vendor'
      };
    }
    
    // Update fulfillment stage and timestamp
    order.fulfillment_stage = stage;
    order.order_status_timestamps[stage] = new Date().toISOString();
    order.updatedAt = new Date().toISOString();
    
    // Enhanced order status mapping with payment flow
    const stageToStatusMap = {
      'availability_confirmed': 'confirmed',
      'packed': 'packed',
      'payment_processed': 'payment_processed',
      'admin_paid': 'ready_for_delivery',
      'handed_over': 'shipped'
    };
    
    if (stageToStatusMap[stage]) {
      order.status = stageToStatusMap[stage];
      order.order_status_timestamps[stageToStatusMap[stage]] = new Date().toISOString();
    }
    
    // Vendor confirmation check for payment flow completion
    if (stage === 'admin_paid' && order.amountMatched) {
      order.vendorConfirmed = true;
      order.paymentFlowStage = 'vendor_confirmed';
      order.vendorConfirmationTimestamp = new Date().toISOString();
    }
    
    this.orders[orderIndex] = order;
    return { ...order };
  }

  // Check if payment amounts match between vendor and admin
  checkAmountMatch(order, adminPaymentAmount) {
    if (!adminPaymentAmount || !order.total) return false;
    const tolerance = 0.01; // 1 cent tolerance
    return Math.abs(adminPaymentAmount - order.total) <= tolerance;
  }

  async autoAssignDeliveryPersonnel(order) {
    await this.delay(200);
    
    // Simulate delivery personnel assignment
    const availablePersonnel = [
      {
        name: "Ali Raza",
        phone: "+923001234567",
        eta: "13:30-14:00",
        vehicle: "Bike-15"
      },
      {
        name: "Hassan Ahmed", 
        phone: "+923009876543",
        eta: "14:00-14:30",
        vehicle: "Car-08"
      },
      {
        name: "Usman Khan",
        phone: "+923005555666",
        eta: "12:45-13:15", 
        vehicle: "Bike-22"
      }
    ];
    
    // Simple assignment based on order location/city
    const cityToPersonnelMap = {
      'Lahore': 0,
      'Karachi': 1,
      'Islamabad': 2
    };
    
    const city = order.deliveryAddress?.city || 'Lahore';
    const personnelIndex = cityToPersonnelMap[city] || 0;
    
    return availablePersonnel[personnelIndex];
  }

  async getFulfillmentOrders(vendorId) {
    await this.delay();
    
    // Get orders that have vendor products and need fulfillment
    return this.orders.filter(order => {
      if (!order.items) return false;
      
      // Check if order has products assigned to this vendor
      const hasVendorProducts = order.items.some(item => 
        (item.productId % 3 + 1) === parseInt(vendorId)
      );
      
      // Only include orders that have confirmed availability
      const hasConfirmedAvailability = order.vendor_availability && 
        Object.values(order.vendor_availability).some(avail => 
          avail.vendorId === parseInt(vendorId) && avail.available === true
        );
      
      return hasVendorProducts && hasConfirmedAvailability;
    }).map(order => {
      // Ensure fulfillment_stage is set
      if (!order.fulfillment_stage) {
        order.fulfillment_stage = 'availability_confirmed';
      }
      return { ...order };
    });
  }

  async confirmHandover(orderId, handoverData) {
    await this.delay();
    
    const orderIndex = this.orders.findIndex(o => o.id === parseInt(orderId));
    if (orderIndex === -1) {
      throw new Error('Order not found');
    }

    const order = this.orders[orderIndex];
    
    order.fulfillment_stage = 'handed_over';
    order.handoverSignature = handoverData.signature;
    order.handoverTimestamp = handoverData.timestamp;
    order.handoverVendorId = handoverData.vendorId;
    order.status = 'shipped';
    order.deliveryStatus = 'picked_up';
    order.updatedAt = new Date().toISOString();
    
    this.orders[orderIndex] = order;
    return { ...order };
}

  // Enhanced Price Summary Data Retrieval with Role-Based Filtering
  async getPriceSummaryData(orderId, options = {}) {
    try {
      await this.delay();
      
      const order = await this.getById(parseInt(orderId));
      if (!order || !order.items) {
        throw new Error(`Order #${orderId} not found or has no items`);
      }

      const { userRole = 'customer', vendorId = null, includeCategories = true, includeVendorBreakdown = true } = options;
      
      // Security: Customers cannot access cost prices
      const canViewCostPrices = userRole === 'admin' || userRole === 'vendor';
      
      console.log('OrderService.getPriceSummaryData: Loading price data for order:', orderId, 'Role:', userRole);

      // Enhanced price data with mock cost prices
      const enhancedItems = order.items.map(item => {
        const costPrice = canViewCostPrices ? this.generateCostPrice(item.price) : null;
        const margin = canViewCostPrices ? item.price - costPrice : null;
        const marginPercentage = canViewCostPrices && costPrice > 0 ? ((margin / costPrice) * 100).toFixed(1) : null;

        return {
          ...item,
          costPrice: costPrice,
          sellingPrice: item.price,
          margin: margin,
          marginPercentage: marginPercentage,
          profitPerUnit: margin,
          totalCost: canViewCostPrices ? costPrice * item.quantity : null,
          totalSelling: item.price * item.quantity,
          totalProfit: canViewCostPrices ? margin * item.quantity : null,
          vendorId: item.productId % 3 + 1, // Simplified vendor assignment
          vendor: this.getVendorName(item.productId % 3 + 1),
          category: this.getItemCategory(item.name)
        };
      });

      // Filter items for vendor users
      const filteredItems = userRole === 'vendor' && vendorId 
        ? enhancedItems.filter(item => item.vendorId === parseInt(vendorId))
        : enhancedItems;

      // Group by categories if requested
      const categories = includeCategories ? this.groupPricesByCategory(filteredItems) : {};
      
      // Calculate totals
      const totalCost = canViewCostPrices ? filteredItems.reduce((sum, item) => sum + (item.totalCost || 0), 0) : null;
      const totalSelling = filteredItems.reduce((sum, item) => sum + item.totalSelling, 0);
      const totalProfit = canViewCostPrices ? filteredItems.reduce((sum, item) => sum + (item.totalProfit || 0), 0) : null;
      const totalItems = filteredItems.length;
      const averageMargin = canViewCostPrices && totalCost > 0 ? ((totalProfit / totalCost) * 100).toFixed(1) : null;

      const priceSummaryData = {
        orderId: order.id,
        orderStatus: order.status,
        paymentStatus: order.paymentStatus,
        userRole: userRole,
        canViewCostPrices: canViewCostPrices,
        totalCost: totalCost,
        totalSelling: totalSelling,
        totalProfit: totalProfit,
        totalItems: totalItems,
        averageMargin: averageMargin,
        deliveryCharge: order.deliveryCharge || 0,
        grandTotal: totalSelling + (order.deliveryCharge || 0),
        categories: categories,
        items: filteredItems,
        generatedAt: new Date().toISOString()
      };

      console.log('OrderService.getPriceSummaryData: Generated price summary:', {
        orderId: orderId,
        totalItems: totalItems,
        canViewCostPrices: canViewCostPrices,
        totalSelling: totalSelling,
        categoriesCount: Object.keys(categories).length
      });

      return priceSummaryData;

    } catch (error) {
      console.error('OrderService.getPriceSummaryData: Error loading price summary:', error);
      
      if (error.message.includes('not found')) {
        throw new Error(`Order #${orderId} not found`);
      } else if (error.message.includes('network')) {
        throw new Error('Network error loading price summary. Please try again.');
      } else {
        throw new Error('Unable to load price summary. Please try again later.');
      }
    }
  }

  // Generate realistic cost prices (typically 60-80% of selling price)
  generateCostPrice(sellingPrice) {
    const costRatio = 0.65 + (Math.random() * 0.15); // 65-80% cost ratio
    return Math.round(sellingPrice * costRatio * 100) / 100;
  }

  // Group enhanced price data by categories
  groupPricesByCategory(items) {
    const grouped = {};
    
    items.forEach(item => {
      const category = item.category;
      
      if (!grouped[category]) {
        grouped[category] = {
          totalCost: 0,
          totalSelling: 0,
          totalProfit: 0,
          totalItems: 0,
          vendorData: {}
        };
      }
      
      const categoryData = grouped[category];
      const vendorName = item.vendor;
      
      // Initialize vendor data if not exists
      if (!categoryData.vendorData[vendorName]) {
        categoryData.vendorData[vendorName] = {
          vendorId: item.vendorId,
          totalCost: 0,
          totalSelling: 0,
          totalProfit: 0,
          items: []
        };
      }
      
      const vendorData = categoryData.vendorData[vendorName];
      
      // Add item to vendor
      vendorData.items.push(item);
      vendorData.totalCost += item.totalCost || 0;
      vendorData.totalSelling += item.totalSelling;
      vendorData.totalProfit += item.totalProfit || 0;
      
      // Add to category totals
      categoryData.totalCost += item.totalCost || 0;
      categoryData.totalSelling += item.totalSelling;
      categoryData.totalProfit += item.totalProfit || 0;
      categoryData.totalItems += 1;
    });
    
    return grouped;
  }

  // Get item category for price grouping
  getItemCategory(itemName) {
    const name = itemName.toLowerCase();
    if (name.includes('rice') || name.includes('flour') || name.includes('wheat')) {
      return 'Grains & Cereals';
    }
    if (name.includes('meat') || name.includes('chicken') || name.includes('mutton') || name.includes('beef')) {
      return 'Meat & Poultry';
    }
    if (name.includes('apple') || name.includes('mango') || name.includes('banana') || name.includes('orange') || name.includes('fruit')) {
      return 'Fruits';
    }
    if (name.includes('tomato') || name.includes('potato') || name.includes('onion') || name.includes('vegetable')) {
      return 'Vegetables';
    }
    if (name.includes('milk') || name.includes('cheese') || name.includes('yogurt') || name.includes('dairy')) {
      return 'Dairy Products';
    }
    return 'Other Items';
  }
}
export const orderService = new OrderService();