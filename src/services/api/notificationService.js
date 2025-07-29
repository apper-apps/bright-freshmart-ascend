// Mock data for notification counts including approval workflow
const mockNotificationCounts = {
  payments: 5,
  orders: 3,
  products: 12,
  pos: 2,
  financial: 1,
  ai: 0,
  verification: 8,
  management: 4,
  delivery: 6,
  analytics: 0,
  approvals: 3,
  workflow: 2,
  sensitive_changes: 1
};

class NotificationService {
  constructor() {
    this.counts = { ...mockNotificationCounts };
    this.lastUpdate = new Date().toISOString();
  }
  async getUnreadCounts() {
    await this.delay();
    
    // Simulate real-time changes by occasionally updating counts
    if (Math.random() > 0.7) {
      this.simulateCountChanges();
    }
    
    return {
      ...this.counts,
      lastUpdated: this.lastUpdate
    };
  }

  async markAsRead(category) {
    await this.delay(200);
    
    if (this.counts[category] !== undefined) {
      this.counts[category] = 0;
      this.lastUpdate = new Date().toISOString();
    }
    
    return {
      success: true,
      category,
      newCount: this.counts[category] || 0
    };
  }

  async markAllAsRead() {
    await this.delay(300);
    
    Object.keys(this.counts).forEach(key => {
      this.counts[key] = 0;
    });
    
    this.lastUpdate = new Date().toISOString();
    
    return {
      success: true,
      counts: { ...this.counts }
    };
  }

  // Simulate realistic count changes
  simulateCountChanges() {
    const categories = Object.keys(this.counts);
    const categoryToUpdate = categories[Math.floor(Math.random() * categories.length)];
    
    // Randomly increase or decrease counts (but not below 0)
    const change = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
    this.counts[categoryToUpdate] = Math.max(0, this.counts[categoryToUpdate] + change);
    
    // Occasionally add new notifications
    if (Math.random() > 0.8) {
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];
      this.counts[randomCategory] += Math.floor(Math.random() * 2) + 1;
    }
    
    this.lastUpdate = new Date().toISOString();
  }

  // Utility method for simulating API delay
  delay(ms = 300) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

// Map quick action paths to notification categories
  getNotificationKey(path) {
    const pathMap = {
      '/admin/products': 'products',
      '/admin/pos': 'pos',
      '/orders': 'orders',
      '/admin/financial-dashboard': 'financial',
      '/admin/ai-generate': 'ai',
      '/admin/payments?tab=verification': 'verification',
      '/admin/payments': 'payments',
      '/admin/delivery-dashboard': 'delivery',
      '/admin/analytics': 'analytics',
      '/admin/approvals': 'approvals',
      '/admin/workflow': 'workflow',
      '/admin/sensitive-changes': 'sensitive_changes'
    };
    
    return pathMap[path] || null;
  }

  // Approval workflow specific notifications
  async getApprovalNotifications() {
    await this.delay(200);
    
    return {
      pendingApprovals: this.counts.approvals || 0,
      workflowAlerts: this.counts.workflow || 0,
      sensitiveChanges: this.counts.sensitive_changes || 0,
      lastUpdated: this.lastUpdate
    };
  }

  async markApprovalAsRead(category) {
    await this.delay(150);
    
    const approvalCategories = ['approvals', 'workflow', 'sensitive_changes'];
    if (approvalCategories.includes(category)) {
      this.counts[category] = 0;
      this.lastUpdate = new Date().toISOString();
    }
    
    return {
      success: true,
      category,
      newCount: this.counts[category] || 0
    };
  }
// Enhanced vendor notification system for better order tracking
  async sendVendorOrderAlert(order) {
    await this.delay(100);
    
    try {
      // Get vendors for order items
      const vendorAlerts = this.getVendorsForOrder(order);
      
      // Send email/SMS notifications to each vendor
      for (const vendorAlert of vendorAlerts) {
        // Email notification
        await this.sendVendorEmail(vendorAlert);
        
        // SMS notification for critical orders
        if (order.status === 'pending' || order.total > 1000) {
          await this.sendVendorSMS(vendorAlert);
        }
      }
      
      return {
        success: true,
        alertsSent: vendorAlerts.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Vendor alert system error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async sendVendorEmail(vendorAlert) {
    await this.delay(200);
    
    const emailContent = {
      to: vendorAlert.vendor.email,
      subject: `🚨 New Order Alert - Order #${vendorAlert.order.id}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #dc2626, #ef4444); color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">🚨 New Order Alert</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Order #${vendorAlert.order.id} requires immediate attention</p>
          </div>
          
          <div style="padding: 20px; background: #fef2f2; border-left: 4px solid #dc2626;">
            <h2 style="color: #dc2626; margin-top: 0;">Order Details</h2>
            <p><strong>Customer:</strong> ${vendorAlert.order.deliveryAddress?.name || 'N/A'}</p>
            <p><strong>Phone:</strong> ${vendorAlert.order.deliveryAddress?.phone || 'N/A'}</p>
            <p><strong>Total Amount:</strong> Rs. ${vendorAlert.order.total}</p>
            <p><strong>Payment Method:</strong> ${vendorAlert.order.paymentMethod?.toUpperCase()}</p>
            <p><strong>Order Time:</strong> ${new Date(vendorAlert.order.createdAt).toLocaleString()}</p>
          </div>
          
          <div style="padding: 20px;">
            <h3 style="color: #374151;">Your Items:</h3>
            ${vendorAlert.items.map(item => `
              <div style="background: #f9fafb; padding: 10px; margin: 5px 0; border-radius: 5px;">
                <strong>${item.name}</strong> - Qty: ${item.quantity} ${item.unit} × Rs. ${item.price}
              </div>
            `).join('')}
          </div>
          
          <div style="background: #dc2626; color: white; padding: 20px; text-align: center;">
            <p style="margin: 0; font-size: 18px; font-weight: bold;">⏰ Action Required Within 30 Minutes</p>
            <p style="margin: 10px 0 0 0;">Log in to your vendor portal to confirm availability</p>
          </div>
        </div>
      `
    };
    
    // Mock email sending
    console.log(`📧 Email sent to ${vendorAlert.vendor.email}:`, emailContent.subject);
    return { success: true, type: 'email', recipient: vendorAlert.vendor.email };
  }
  
  async sendVendorSMS(vendorAlert) {
    await this.delay(150);
    
    const smsContent = {
      to: vendorAlert.vendor.phone,
      message: `🚨 NEW ORDER ALERT! Order #${vendorAlert.order.id} - Rs.${vendorAlert.order.total} - Customer: ${vendorAlert.order.deliveryAddress?.name} - ${vendorAlert.items.length} items assigned to you. RESPOND WITHIN 30 MIN! Login: vendor.freshmart.com`
    };
    
    // Mock SMS sending
    console.log(`📱 SMS sent to ${vendorAlert.vendor.phone}:`, smsContent.message);
    return { success: true, type: 'sms', recipient: vendorAlert.vendor.phone };
  }
  
  getVendorsForOrder(order) {
    // Mock vendor assignment logic - in real app, this would query vendor database
    const mockVendors = [
      { id: 1, name: "Fresh Produce Co", email: "orders@freshproduce.com", phone: "+92 300 1111111" },
      { id: 2, name: "Quality Meats", email: "alerts@qualitymeats.com", phone: "+92 300 2222222" },
      { id: 3, name: "Dairy Farm Direct", email: "notifications@dairyfarm.com", phone: "+92 300 3333333" }
    ];
    
    return order.items.map(item => {
      // Simple vendor assignment based on product ID
      const vendorId = (item.productId % 3) + 1;
      const vendor = mockVendors.find(v => v.id === vendorId) || mockVendors[0];
      
      return {
        order: order,
        vendor: vendor,
        items: [item],
        urgency: order.status === 'pending' ? 'high' : 'normal',
        responseDeadline: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      };
    });
  }
  
  // Get order status colors for better visual tracking
  getOrderStatusColor(status) {
    const statusColors = {
      'pending': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
      'confirmed': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
      'verified': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
      'packed': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
      'shipped': { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
      'delivered': { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
      'payment_pending': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
      'cancelled': { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' }
    };
    
    return statusColors[status] || statusColors['pending'];
  }
  
  // Enhanced notification for order status changes
  async notifyOrderStatusChange(orderId, oldStatus, newStatus, additionalData = {}) {
    await this.delay(100);
    
    const statusChangeAlert = {
      orderId,
      oldStatus,
      newStatus,
      timestamp: new Date().toISOString(),
      ...additionalData
    };
    
    // Update notification counts based on status change
    if (newStatus === 'pending') {
      this.counts.orders += 1;
    } else if (oldStatus === 'pending' && newStatus !== 'pending') {
      this.counts.orders = Math.max(0, this.counts.orders - 1);
    }
    
    this.lastUpdate = new Date().toISOString();
    
    return {
      success: true,
      statusChange: statusChangeAlert,
      newOrderCount: this.counts.orders
    };
  }
}

export const notificationService = new NotificationService();