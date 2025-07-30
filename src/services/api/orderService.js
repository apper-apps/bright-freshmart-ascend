import ordersData from "@/services/mockData/orders.json";

// Simulate API delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Generate unique ID
const generateId = () => 'order_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

// Order status transitions
const STATUS_TRANSITIONS = {
  'pending': ['verified', 'cancelled'],
  'verified': ['confirmed', 'cancelled'],
  'confirmed': ['shipped', 'cancelled'],
  'shipped': ['delivered', 'cancelled'],
  'delivered': [],
  'cancelled': []
};

class OrderService {
  constructor() {
    this.orders = [...ordersData];
  }

  // Get all orders
  async getAllOrders(filters = {}) {
    try {
      await delay(500);
      
      let filteredOrders = [...this.orders];

      // Apply filters
      if (filters.status) {
        filteredOrders = filteredOrders.filter(order => order.status === filters.status);
      }

      if (filters.customerId) {
        filteredOrders = filteredOrders.filter(order => order.customerId === filters.customerId);
      }

      if (filters.vendorId) {
        filteredOrders = filteredOrders.filter(order => 
          order.items.some(item => item.vendorId === filters.vendorId)
        );
      }

      if (filters.dateFrom) {
        filteredOrders = filteredOrders.filter(order => 
          new Date(order.createdAt) >= new Date(filters.dateFrom)
        );
      }

      if (filters.dateTo) {
        filteredOrders = filteredOrders.filter(order => 
          new Date(order.createdAt) <= new Date(filters.dateTo)
        );
      }

      // Sort by creation date (newest first)
      filteredOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return {
        success: true,
        data: filteredOrders,
        total: filteredOrders.length
      };
    } catch (error) {
      console.error('Error fetching orders:', error);
      return {
        success: false,
        error: 'Failed to fetch orders',
        data: []
      };
    }
  }

  // Get order by ID
  async getOrderById(orderId) {
    try {
      await delay(300);
      
      const order = this.orders.find(o => o.id === orderId);
      
      if (!order) {
        return {
          success: false,
          error: 'Order not found',
          data: null
        };
      }

      return {
        success: true,
        data: order
      };
    } catch (error) {
      console.error('Error fetching order:', error);
      return {
        success: false,
        error: 'Failed to fetch order',
        data: null
      };
    }
  }

  // Create new order
  async createOrder(orderData) {
    try {
      await delay(800);
      
      // Validate required fields
// Enhanced validation with flexible property checking
      const hasCustomerInfo = orderData.customerId || orderData.customer_id || orderData.userId || orderData.user_id;
      const hasItems = orderData.items && Array.isArray(orderData.items) && orderData.items.length > 0;
      const hasDeliveryAddress = orderData.deliveryAddress || orderData.delivery_address;
      
// Check for customer information - either customerId or customer object with required fields
      const hasCustomerId = orderData.customerId || orderData.customer_id;
      const hasCustomerObject = orderData.customer && 
        orderData.customer.firstName && 
        orderData.customer.lastName && 
        orderData.customer.email;
      
      if (!hasCustomerId && !hasCustomerObject) {
        const missingFields = [];
        if (!hasCustomerId) missingFields.push('customerId or customer_id');
        if (!hasCustomerObject) missingFields.push('customer object with firstName, lastName, email');
        
        return {
          success: false,
          error: 'Customer information is required for order creation',
          data: null,
          validationDetails: {
            missingFields,
            providedData: Object.keys(orderData),
            customerDataReceived: orderData.customer ? Object.keys(orderData.customer) : 'none'
          }
        };
};
      }
      if (!hasItems) {
        return {
          success: false,
          error: 'Order must contain at least one item',
          data: null,
          validationDetails: {
            missingFields: ['items array'],
            itemsProvided: orderData.items ? orderData.items.length : 0,
            providedData: Object.keys(orderData)
          }
        };
      }
      
      if (!hasDeliveryAddress) {
        return {
          success: false,
          error: 'Delivery address is required for order creation',
          data: null,
          validationDetails: {
            missingFields: ['deliveryAddress or delivery_address'],
            providedData: Object.keys(orderData)
          }
        };
      }

      // Calculate totals
      const subtotal = orderData.items.reduce((sum, item) => 
        sum + (item.price * item.quantity), 0
      );
      
      const tax = subtotal * 0.1; // 10% tax
      const deliveryFee = orderData.deliveryMethod === 'delivery' ? 50000 : 0;
      const total = subtotal + tax + deliveryFee;

const newOrder = {
        id: generateId(),
        orderNumber: `ORD-${Date.now()}`,
        customerId: orderData.customerId || orderData.customer_id || generateId(), // Generate if not provided
        customerInfo: orderData.customerInfo || orderData.customer, // Handle both structures
        customer: orderData.customer, // Keep original customer object
        items: orderData.items,
        subtotal,
        tax,
        deliveryFee,
        total,
        status: 'pending',
        paymentStatus: 'pending',
        paymentMethod: orderData.paymentMethod,
        deliveryMethod: orderData.deliveryMethod,
        deliveryAddress: orderData.deliveryAddress,
        notes: orderData.notes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        statusHistory: [
          {
            status: 'pending',
            timestamp: new Date().toISOString(),
            note: 'Order created'
          }
        ]
      };

      this.orders.push(newOrder);

      return {
        success: true,
        data: newOrder,
message: 'Order created successfully'
      };
    } catch (error) {
      console.error('Error creating order:', error);
      
// Enhanced error logging with comprehensive validation details
      const errorDetails = {
        timestamp: new Date().toISOString(),
        operation: 'createOrder',
        message: error.message,
        stack: error.stack,
        orderDataProvided: !!orderData,
        orderDataKeys: orderData ? Object.keys(orderData) : [],
        orderDataType: typeof orderData,
        validationErrors: [],
        dataAnalysis: {
          hasCustomerId: !!(orderData?.customerId || orderData?.customer_id || orderData?.userId || orderData?.user_id),
          hasItems: !!(orderData?.items && Array.isArray(orderData.items) && orderData.items.length > 0),
          hasDeliveryAddress: !!(orderData?.deliveryAddress || orderData?.delivery_address),
          itemCount: orderData?.items ? orderData.items.length : 0,
          totalValue: orderData?.total || 0
        }
      };
      
      // Add specific validation context with suggestions
      if (!orderData?.customerId && !orderData?.customer_id && !orderData?.userId && !orderData?.user_id) {
        errorDetails.validationErrors.push({
          field: 'customer identification',
          expected: 'customerId, customer_id, userId, or user_id',
          received: 'none found'
        });
      }
      
      if (!orderData?.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
        errorDetails.validationErrors.push({
          field: 'items',
          expected: 'non-empty array of order items',
          received: orderData?.items ? `${typeof orderData.items} with ${orderData.items.length || 0} items` : 'not provided'
        });
      }
      
      if (!orderData?.deliveryAddress && !orderData?.delivery_address) {
        errorDetails.validationErrors.push({
          field: 'delivery address',
          expected: 'deliveryAddress or delivery_address object',
          received: 'not provided'
        });
      }
      
      // Log comprehensive error details for debugging
      console.error('Order Service - Creation failed with detailed analysis:', errorDetails);
      
      // Also log a simplified version for quick debugging
      console.error('Order Service - Quick debug:', {
        error: error.message,
        hasData: !!orderData,
        dataKeys: orderData ? Object.keys(orderData).join(', ') : 'none',
        validationIssues: errorDetails.validationErrors.length
      });
      return {
        success: false,
        error: error.message || 'Failed to create order',
        data: null
      };
    }
  }

  // Update order status
  async updateOrderStatus(orderId, newStatus, note = '') {
    try {
      await delay(500);
      
      const orderIndex = this.orders.findIndex(o => o.id === orderId);
      
      if (orderIndex === -1) {
        return {
          success: false,
          error: 'Order not found',
          data: null
        };
      }

      const order = this.orders[orderIndex];
      const currentStatus = order.status;

      // Validate status transition
      if (!STATUS_TRANSITIONS[currentStatus]?.includes(newStatus)) {
        return {
          success: false,
          error: `Invalid status transition from ${currentStatus} to ${newStatus}`,
          data: null
        };
      }

      // Update order
      const updatedOrder = {
        ...order,
        status: newStatus,
        updatedAt: new Date().toISOString(),
        statusHistory: [
          ...order.statusHistory,
          {
            status: newStatus,
            timestamp: new Date().toISOString(),
            note: note || `Status changed to ${newStatus}`
          }
        ]
      };

      // Update payment status based on order status
      if (newStatus === 'verified') {
        updatedOrder.paymentStatus = 'paid';
      } else if (newStatus === 'cancelled') {
        updatedOrder.paymentStatus = 'refunded';
      }

      this.orders[orderIndex] = updatedOrder;

      return {
        success: true,
        data: updatedOrder,
        message: `Order status updated to ${newStatus}`
      };
    } catch (error) {
      console.error('Error updating order status:', error);
      return {
        success: false,
        error: 'Failed to update order status',
        data: null
      };
    }
  }

  // Update order items
  async updateOrderItems(orderId, items) {
    try {
      await delay(500);
      
      const orderIndex = this.orders.findIndex(o => o.id === orderId);
      
      if (orderIndex === -1) {
        return {
          success: false,
          error: 'Order not found',
          data: null
        };
      }

      const order = this.orders[orderIndex];

      // Only allow updates for pending orders
      if (order.status !== 'pending') {
        return {
          success: false,
          error: 'Cannot modify order items after order is processed',
          data: null
        };
      }

      // Recalculate totals
      const subtotal = items.reduce((sum, item) => 
        sum + (item.price * item.quantity), 0
      );
      
      const tax = subtotal * 0.1;
      const deliveryFee = order.deliveryMethod === 'delivery' ? 50000 : 0;
      const total = subtotal + tax + deliveryFee;

      const updatedOrder = {
        ...order,
        items,
        subtotal,
        tax,
        total,
        updatedAt: new Date().toISOString()
      };

      this.orders[orderIndex] = updatedOrder;

      return {
        success: true,
        data: updatedOrder,
        message: 'Order items updated successfully'
      };
    } catch (error) {
      console.error('Error updating order items:', error);
      return {
        success: false,
        error: 'Failed to update order items',
        data: null
      };
    }
  }

  // Add payment proof
  async addPaymentProof(orderId, paymentProof) {
    try {
      await delay(400);
      
      const orderIndex = this.orders.findIndex(o => o.id === orderId);
      
      if (orderIndex === -1) {
        return {
          success: false,
          error: 'Order not found',
          data: null
        };
      }

      const updatedOrder = {
        ...this.orders[orderIndex],
        paymentProof: {
          ...paymentProof,
          uploadedAt: new Date().toISOString()
        },
        updatedAt: new Date().toISOString()
      };

      this.orders[orderIndex] = updatedOrder;

      return {
        success: true,
        data: updatedOrder,
        message: 'Payment proof uploaded successfully'
      };
    } catch (error) {
      console.error('Error adding payment proof:', error);
      return {
        success: false,
        error: 'Failed to upload payment proof',
        data: null
      };
    }
  }

  // Cancel order
  async cancelOrder(orderId, reason = '') {
    try {
      await delay(600);
      
      const orderIndex = this.orders.findIndex(o => o.id === orderId);
      
      if (orderIndex === -1) {
        return {
          success: false,
          error: 'Order not found',
          data: null
        };
      }

      const order = this.orders[orderIndex];

      // Check if order can be cancelled
      if (['delivered', 'cancelled'].includes(order.status)) {
        return {
          success: false,
          error: 'Order cannot be cancelled',
          data: null
        };
      }

      const updatedOrder = {
        ...order,
        status: 'cancelled',
        paymentStatus: 'refunded',
        cancelReason: reason,
        cancelledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        statusHistory: [
          ...order.statusHistory,
          {
            status: 'cancelled',
            timestamp: new Date().toISOString(),
            note: reason || 'Order cancelled'
          }
        ]
      };

      this.orders[orderIndex] = updatedOrder;

      return {
        success: true,
        data: updatedOrder,
        message: 'Order cancelled successfully'
      };
    } catch (error) {
      console.error('Error cancelling order:', error);
      return {
        success: false,
        error: 'Failed to cancel order',
        data: null
      };
    }
  }

  // Get order statistics
  async getOrderStats(filters = {}) {
    try {
      await delay(300);
      
      let filteredOrders = [...this.orders];

      // Apply date filters
      if (filters.dateFrom) {
        filteredOrders = filteredOrders.filter(order => 
          new Date(order.createdAt) >= new Date(filters.dateFrom)
        );
      }

      if (filters.dateTo) {
        filteredOrders = filteredOrders.filter(order => 
          new Date(order.createdAt) <= new Date(filters.dateTo)
        );
      }

      const stats = {
        total: filteredOrders.length,
        pending: filteredOrders.filter(o => o.status === 'pending').length,
        verified: filteredOrders.filter(o => o.status === 'verified').length,
        confirmed: filteredOrders.filter(o => o.status === 'confirmed').length,
        shipped: filteredOrders.filter(o => o.status === 'shipped').length,
        delivered: filteredOrders.filter(o => o.status === 'delivered').length,
        cancelled: filteredOrders.filter(o => o.status === 'cancelled').length,
        totalRevenue: filteredOrders
          .filter(o => o.status === 'delivered')
          .reduce((sum, order) => sum + order.total, 0)
      };

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('Error fetching order stats:', error);
      return {
        success: false,
        error: 'Failed to fetch order statistics',
        data: null
      };
    }
  }

  // Search orders
  async searchOrders(query, filters = {}) {
    try {
      await delay(400);
      
      if (!query || query.trim() === '') {
        return this.getAllOrders(filters);
      }

      const searchTerm = query.toLowerCase().trim();
      
      const filteredOrders = this.orders.filter(order => {
        const matchesSearch = 
          order.orderNumber?.toLowerCase().includes(searchTerm) ||
          order.id?.toLowerCase().includes(searchTerm) ||
          order.customerInfo?.name?.toLowerCase().includes(searchTerm) ||
          order.customerInfo?.email?.toLowerCase().includes(searchTerm) ||
          order.items?.some(item => 
            item.name?.toLowerCase().includes(searchTerm)
          );

        // Apply additional filters
        let matchesFilters = true;
        
        if (filters.status) {
          matchesFilters = matchesFilters && order.status === filters.status;
        }

        if (filters.customerId) {
          matchesFilters = matchesFilters && order.customerId === filters.customerId;
        }

        return matchesSearch && matchesFilters;
      });

      return {
        success: true,
        data: filteredOrders,
        total: filteredOrders.length
      };
    } catch (error) {
      console.error('Error searching orders:', error);
      return {
        success: false,
        error: 'Failed to search orders',
        data: []
      };
    }
  }
}

// Create singleton instance
const orderService = new OrderService();

// Export individual methods for easier importing
export const getAllOrders = (filters) => orderService.getAllOrders(filters);
export const getOrderById = (orderId) => orderService.getOrderById(orderId);
export const createOrder = (orderData) => orderService.createOrder(orderData);
export const updateOrderStatus = (orderId, status, note) => orderService.updateOrderStatus(orderId, status, note);
export const updateOrderItems = (orderId, items) => orderService.updateOrderItems(orderId, items);
export const addPaymentProof = (orderId, paymentProof) => orderService.addPaymentProof(orderId, paymentProof);
export const cancelOrder = (orderId, reason) => orderService.cancelOrder(orderId, reason);
export const getOrderStats = (filters) => orderService.getOrderStats(filters);
export const searchOrders = (query, filters) => orderService.searchOrders(query, filters);

// Export default service
export default orderService;