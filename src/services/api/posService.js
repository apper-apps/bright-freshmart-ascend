import posData from '../mockData/posTransactions.json';

class POSService {
  constructor() {
    this.transactions = [...posData];
  }

  async getAll() {
    await this.delay();
    return [...this.transactions];
  }

  async getById(id) {
    await this.delay();
    const transaction = this.transactions.find(t => t.id === id);
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    return { ...transaction };
  }

  async createTransaction(transactionData) {
    await this.delay();
    const newTransaction = {
      id: this.getNextId(),
      ...transactionData,
      timestamp: new Date().toISOString()
    };
    this.transactions.push(newTransaction);
    return { ...newTransaction };
  }

  async getDailySales(date) {
    await this.delay();
    const targetDate = new Date(date).toDateString();
    const dailyTransactions = this.transactions.filter(
      t => new Date(t.timestamp).toDateString() === targetDate
    );
    
    return {
      transactions: dailyTransactions,
      totalSales: dailyTransactions.reduce((sum, t) => sum + t.total, 0),
      totalTransactions: dailyTransactions.length
    };
  }

  getNextId() {
    const maxId = this.transactions.reduce((max, transaction) => 
      transaction.id > max ? transaction.id : max, 0);
    return maxId + 1;
  }

// Payment Integration Methods
async processPayment(transactionId, paymentData) {
    await this.delay();
    
    // Validate input parameters
    if (!transactionId) {
      throw new Error('Transaction ID is required');
    }
    
    if (!paymentData) {
      throw new Error('Payment data is required');
    }
// Enhanced payment data validation with defensive checks
    const requiredFields = ['paymentMethod', 'amount'];
    const missingFields = requiredFields.filter(field => !paymentData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required payment fields: ${missingFields.join(', ')}`);
    }
    
    // Enhanced COD payment validation with better error handling
    if (paymentData.paymentMethod === 'COD' || paymentData.paymentMethod === 'cash_on_delivery' || paymentData.paymentMethod === 'cash') {
      // Flexible order ID validation - check multiple possible fields
      const orderId = paymentData.orderId || paymentData.id || paymentData.orderNumber || paymentData.transactionOrderId;
      
      if (!orderId) {
        console.error('COD Payment Error: Missing order ID in payment data:', {
          paymentData: { ...paymentData, amount: paymentData.amount },
          availableFields: Object.keys(paymentData)
        });
        throw new Error('Order ID is required for COD payments. Please ensure order is created before processing payment.');
      }
      
      // Validate order ID format
      const numericOrderId = parseInt(orderId);
      if (isNaN(numericOrderId) || numericOrderId <= 0) {
        console.error('COD Payment Error: Invalid order ID format:', orderId);
        throw new Error('Invalid order ID format for COD payment. Order ID must be a positive number.');
      }
      
      // Store validated order ID back to payment data
      paymentData.orderId = numericOrderId;
      
      if (!paymentData.customerInfo) {
        throw new Error('Customer information is required for COD payments');
      }
    }
    
    const transaction = this.transactions.find(t => t.id === transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Ensure paymentData includes orderId if not present
    const processedPaymentData = {
      ...paymentData,
      orderId: paymentData.orderId || transaction.orderId || `ORDER_${transactionId}`,
      transactionId: transactionId,
      processedAt: new Date().toISOString()
    };

    const updatedTransaction = {
      ...transaction,
      paymentProcessed: true,
      paymentData: processedPaymentData,
      processedAt: new Date().toISOString()
    };

    const index = this.transactions.findIndex(t => t.id === transactionId);
    this.transactions[index] = updatedTransaction;
    
    return { ...updatedTransaction };
  }

  async getTransactionsByPaymentMethod(paymentMethod) {
    await this.delay();
    return this.transactions.filter(t => t.paymentType === paymentMethod);
  }

  async getDailyPaymentBreakdown(date) {
    await this.delay();
    const targetDate = new Date(date).toDateString();
    const dailyTransactions = this.transactions.filter(
      t => new Date(t.timestamp).toDateString() === targetDate
    );

    const breakdown = dailyTransactions.reduce((acc, transaction) => {
      const method = transaction.paymentType;
      if (!acc[method]) {
        acc[method] = { count: 0, total: 0 };
      }
      acc[method].count += 1;
      acc[method].total += transaction.total;
      return acc;
    }, {});

    return breakdown;
  }

  delay() {
    return new Promise(resolve => setTimeout(resolve, 300));
  }
}

export const posService = new POSService();