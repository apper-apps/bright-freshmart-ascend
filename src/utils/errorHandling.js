// Comprehensive error handling utilities
export class ErrorHandler {
static classifyError(error) {
    const message = error.message?.toLowerCase() || '';
    
    // COD and Order-specific errors
    if (message.includes('order id is required') || message.includes('invalid order id') || message.includes('order creation failed')) {
      return 'order-processing';
    }
    if (message.includes('cod processing') || message.includes('cash on delivery')) {
      return 'cod-processing';
    }
    if (message.includes('payment processing') || message.includes('payment failed')) {
      return 'payment-processing';
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return 'network';
    }
    if (message.includes('timeout') || message.includes('deadline')) {
      return 'timeout';
    }
    if (message.includes('validation') || message.includes('invalid') || message.includes('parse')) {
      return 'validation';
    }
    if (message.includes('server') || message.includes('500') || message.includes('503')) {
      return 'server';
    }
    if (message.includes('not found') || message.includes('404')) {
      return 'not-found';
    }
    if (message.includes('permission') || message.includes('unauthorized') || message.includes('403')) {
      return 'permission';
    }
    
    return 'general';
  }

static createUserFriendlyMessage(error, context = '') {
    const type = this.classifyError(error);
    const contextPrefix = context ? `${context}: ` : '';
    
    switch (type) {
      case 'order-processing':
        return `${contextPrefix}Order processing failed. Please try again or contact support at support@freshmart.pk`;
      case 'cod-processing':
        return `${contextPrefix}Cash on delivery processing issue. Please contact support for assistance.`;
      case 'payment-processing':
        return `${contextPrefix}Payment processing failed. Please verify your payment details and try again.`;
      case 'network':
        return `${contextPrefix}Network connection issue. Please check your internet connection and try again.`;
      case 'timeout':
        return `${contextPrefix}Request timed out. Please try again.`;
      case 'server':
        return `${contextPrefix}Server error occurred. Please try again in a few moments.`;
      case 'validation':
        return `${contextPrefix}Invalid data provided. Please check your input and try again.`;
      case 'not-found':
        return `${contextPrefix}Requested item not found.`;
      case 'permission':
        return `${contextPrefix}You don't have permission to perform this action.`;
      default:
        return `${contextPrefix}An unexpected error occurred. Please try again.`;
    }
  }

static shouldRetry(error, attemptCount = 0, maxRetries = 3, context = '') {
    if (attemptCount >= maxRetries) return false;
    
    const type = this.classifyError(error);
    const message = error.message?.toLowerCase() || '';
    
    // Upload-specific retry logic with customer support considerations
if (context.includes('upload') || context.includes('file')) {
      // More aggressive retry for upload operations
      const uploadRetryableTypes = ['network', 'timeout', 'server'];
      
      if (uploadRetryableTypes.includes(type)) {
        // Don't retry file format or size errors - direct to support
        if (message.includes('format') || message.includes('size') || message.includes('type')) {
          // Flag for customer support with WhatsApp fallback
          localStorage.setItem('checkout-upload-error', JSON.stringify({
            type: 'format_size_error',
            message: error.message,
            timestamp: Date.now(),
            needsSupport: true,
            supportContact: 'support@freshmart.pk',
            whatsappFallback: '+92-300-1234567',
            suggestedAction: 'Send payment proof via WhatsApp if upload continues to fail'
          }));
          return false;
        }
        
        // Don't retry permanent upload errors - offer alternatives
        if (message.includes('unsupported') || message.includes('invalid')) {
          localStorage.setItem('checkout-upload-error', JSON.stringify({
            type: 'unsupported_error',
            message: error.message,
            timestamp: Date.now(),
            needsAlternatives: true,
            supportContact: 'support@freshmart.pk',
            whatsappFallback: '+92-300-1234567',
            alternativeMethod: 'WhatsApp payment proof submission'
          }));
          return false;
        }
        
        // Retry network issues more aggressively for uploads
        if (type === 'network') {
          return attemptCount < Math.min(maxRetries + 2, 5);
        }
        
        // Retry timeout issues for uploads
        if (type === 'timeout') {
          return attemptCount < Math.min(maxRetries + 1, 4);
        }
        
        // After 2 failed attempts, suggest customer support
        if (attemptCount >= 2) {
          localStorage.setItem('checkout-upload-error', JSON.stringify({
            type: 'repeated_failure',
            message: error.message,
            timestamp: Date.now(),
            attemptCount,
            suggestSupport: true,
            supportContact: 'support@freshmart.pk'
          }));
        }
        
        return attemptCount < maxRetries;
      }
      
      return false;
    }
    
// Checkout-specific error handling
    if (context.includes('checkout') || context.includes('order')) {
      // Never retry order processing failures - require immediate attention
      if (message.includes('order id is required') || message.includes('order creation failed') || message.includes('invalid order id')) {
        localStorage.setItem('checkout-order-error', JSON.stringify({
          type: 'order_processing_failure',
          message: error.message,
          timestamp: Date.now(),
          requiresSupport: true,
          supportContact: 'support@freshmart.pk',
          urgency: 'high'
        }));
        return false;
      }
      
      // Never retry COD processing failures - require user intervention
      if (message.includes('cod processing') || message.includes('cash on delivery')) {
        localStorage.setItem('checkout-cod-error', JSON.stringify({
          type: 'cod_processing_failure',
          message: error.message,
          timestamp: Date.now(),
          requiresSupport: true,
          supportContact: 'support@freshmart.pk'
        }));
        return false;
      }
      
      // Never retry payment failures - require user intervention
      if (message.includes('payment') || message.includes('transaction')) {
        localStorage.setItem('checkout-payment-error', JSON.stringify({
          type: 'payment_failure',
          message: error.message,
          timestamp: Date.now(),
          requiresSupport: true,
          supportContact: 'support@freshmart.pk'
        }));
        return false;
      }
      
      // Retry network issues for order placement
      if (type === 'network' && attemptCount < 2) {
        return true;
      }
    }
    // Original retry logic for non-upload operations
    const retryableTypes = ['network', 'timeout', 'server'];
    
    if (retryableTypes.includes(type)) {
      // Don't retry certain permanent errors
      if (message.includes('404') || message.includes('forbidden') || message.includes('unauthorized')) {
        return false;
      }
      
      // Retry network and timeout errors more aggressively
      if (type === 'network' || type === 'timeout') {
        return attemptCount < maxRetries;
      }
      
      // Be more conservative with server errors
      if (type === 'server') {
        return attemptCount < Math.min(maxRetries, 2);
      }
      
      return true;
    }
    
    return false;
  }

  // Enhanced error guidance for customer support
static getCustomerSupportGuidance(error, context = '') {
    const type = this.classifyError(error);
    const message = error.message?.toLowerCase() || '';
    
    const guidance = {
      showChat: false,
      showWhatsApp: false,
      showEmail: false,
      showFAQ: false,
      showSamples: false,
      priority: 'normal',
      supportContact: 'support@freshmart.pk',
      recommendedAction: 'contact_support'
    };
    
    if (context.includes('upload')) {
guidance.showFAQ = true;
      guidance.showSamples = true;
      guidance.whatsappFallback = '+92-300-1234567';
      
      if (message.includes('format') || message.includes('heic') || message.includes('unsupported')) {
        guidance.showChat = true;
        guidance.showSamples = true;
        guidance.priority = 'high';
        guidance.recommendedAction = 'try_different_format';
        guidance.whatsappMessage = 'Having trouble with image format? Send your payment proof directly via WhatsApp';
      } else if (message.includes('size') || message.includes('large')) {
        guidance.showChat = true;
        guidance.showFAQ = true;
        guidance.priority = 'medium';
        guidance.recommendedAction = 'compress_image';
        guidance.whatsappMessage = 'Image too large? Send it via WhatsApp and we\'ll process it for you';
      } else if (type === 'network' || type === 'timeout') {
        guidance.showWhatsApp = true;
        guidance.showEmail = true;
        guidance.priority = 'medium';
        guidance.recommendedAction = 'check_connection';
      } else {
        // General upload issues
        guidance.showChat = true;
        guidance.showWhatsApp = true;
        guidance.priority = 'high';
        guidance.recommendedAction = 'contact_support';
      }
    } else if (context.includes('checkout') || context.includes('payment')) {
      guidance.showChat = true;
      guidance.showWhatsApp = true;
      guidance.showEmail = true;
      guidance.priority = 'critical';
      guidance.supportContact = 'support@freshmart.pk';
      
      if (message.includes('payment') || message.includes('transaction')) {
        guidance.recommendedAction = 'verify_payment_details';
      } else {
        guidance.recommendedAction = 'retry_checkout';
      }
    } else {
      // General errors
      guidance.showEmail = true;
      guidance.priority = 'normal';
      guidance.recommendedAction = 'contact_support';
    }
    
    return guidance;
  }

  static getRetryDelay(attemptCount, baseDelay = 1000) {
    // Exponential backoff with jitter to prevent thundering herd
    const exponentialDelay = baseDelay * Math.pow(2, attemptCount);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    const totalDelay = exponentialDelay + jitter;
    
    // Cap at 30 seconds
    return Math.min(totalDelay, 30000);
  }

  static trackErrorPattern(error, context = '') {
    // Enhanced error pattern tracking for better diagnostics
    const errorKey = `${error.name || 'Unknown'}_${error.message || 'NoMessage'}`;
    const timestamp = Date.now();
    
    if (!window.errorPatterns) {
      window.errorPatterns = new Map();
    }
    
    const existing = window.errorPatterns.get(errorKey) || { count: 0, contexts: new Set(), firstSeen: timestamp };
    existing.count++;
    existing.contexts.add(context);
    existing.lastSeen = timestamp;
    
    window.errorPatterns.set(errorKey, existing);
    
    // Alert if error pattern is becoming frequent
    if (existing.count >= 5) {
      console.error(`Critical error pattern detected: ${errorKey} occurred ${existing.count} times`, {
        contexts: Array.from(existing.contexts),
        timespan: timestamp - existing.firstSeen
      });
    }
    
    return existing;
  }
}

// Network status monitoring
export class NetworkMonitor {
  static isOnline() {
    return navigator.onLine;
  }

  static addNetworkListener(callback) {
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }
}

// File upload specific error wrapper
export const withUploadErrorHandling = (uploadMethod, context = 'File upload', maxRetries = 3) => {
  return async (...args) => {
    let attemptCount = 0;
    
    while (attemptCount <= maxRetries) {
      try {
        return await uploadMethod(...args);
      } catch (error) {
        console.error(`${context} error (attempt ${attemptCount + 1}):`, error);
        
        // Track upload-specific error patterns
        ErrorHandler.trackErrorPattern(error, `${context}-attempt-${attemptCount + 1}`);
        
        if (ErrorHandler.shouldRetry(error, attemptCount, maxRetries, context)) {
          attemptCount++;
          const delay = ErrorHandler.getRetryDelay(attemptCount, 2000); // Longer delay for uploads
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Create upload-specific error message
        const userMessage = ErrorHandler.createUserFriendlyMessage(error, context);
        const uploadError = new Error(userMessage);
        uploadError.originalError = error;
        uploadError.attemptCount = attemptCount + 1;
        uploadError.isUploadError = true;
        
        throw uploadError;
      }
    }
  };
};

// Service layer error wrapper
export const withErrorHandling = (serviceMethod, context) => {
  return async (...args) => {
    let attemptCount = 0;
    
    while (attemptCount < 3) {
      try {
        return await serviceMethod(...args);
      } catch (error) {
        console.error(`${context} error (attempt ${attemptCount + 1}):`, error);
        
        if (ErrorHandler.shouldRetry(error, attemptCount, 3, context)) {
          attemptCount++;
          const delay = ErrorHandler.getRetryDelay(attemptCount);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw new Error(ErrorHandler.createUserFriendlyMessage(error, context));
      }
    }
  };
};