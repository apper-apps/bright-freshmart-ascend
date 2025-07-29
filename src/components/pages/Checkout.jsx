import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { CreditCard, Mail, MapPin, Phone, User } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { toast } from "react-toastify";
import { orderService } from "@/services/api/orderService";
import { paymentService } from "@/services/api/paymentService";
import { productService } from "@/services/api/productService";
import ApperIcon from "@/components/ApperIcon";
import PaymentMethod from "@/components/molecules/PaymentMethod";
import Loading from "@/components/ui/Loading";
import Error from "@/components/ui/Error";
import Account from "@/components/pages/Account";
import Input from "@/components/atoms/Input";
import Button from "@/components/atoms/Button";
import { clearCart } from "@/store/cartSlice";
import formatCurrency from "@/utils/currency";

function Checkout() {
  const navigate = useNavigate();
  const { cart, clearCart: clearCartHook } = useCart();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState([]);
  const [gatewayConfig, setGatewayConfig] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    postalCode: '',
    instructions: ''
  });
  const [paymentProof, setPaymentProof] = useState(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
const [transactionId, setTransactionId] = useState('');
  const [errors, setErrors] = useState({});
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isCompressing, setIsCompressing] = useState(false);

  // Calculate totals with validated pricing and deals
  const calculateCartTotals = () => {
    let subtotal = 0;
    let totalSavings = 0;
    
    cart.forEach(item => {
      const itemTotal = item.price * item.quantity;
      subtotal += itemTotal;
      
      // Calculate deal savings
      if (item.dealType && item.dealValue) {
        if (item.dealType === 'BOGO' && item.quantity >= 2) {
          const freeItems = Math.floor(item.quantity / 2);
          totalSavings += freeItems * item.price;
        } else if (item.dealType === 'Bundle' && item.quantity >= 3) {
          const [buyQty, payQty] = item.dealValue.split('for').map(x => parseInt(x.trim()));
          if (buyQty && payQty && item.quantity >= buyQty) {
            const bundleSets = Math.floor(item.quantity / buyQty);
            const freeItems = bundleSets * (buyQty - payQty);
            totalSavings += freeItems * item.price;
          }
        }
      }
    });
    
    const discountedSubtotal = subtotal - totalSavings;
    const deliveryCharge = discountedSubtotal >= 2000 ? 0 : 150;
    
    return {
      originalSubtotal: subtotal,
      dealSavings: totalSavings,
      subtotal: discountedSubtotal,
      deliveryCharge,
      total: discountedSubtotal + deliveryCharge + calculateGatewayFee(discountedSubtotal)
    };
  };

  const totals = calculateCartTotals();
  const { originalSubtotal, dealSavings, subtotal, deliveryCharge, total } = totals;
  const gatewayFee = calculateGatewayFee(subtotal);
useEffect(() => {
    loadPaymentMethods();
  }, []);
  async function loadPaymentMethods() {
    try {
      const methods = await paymentService.getAvailablePaymentMethods();
      const config = await paymentService.getGatewayConfig();
      const enabledMethods = methods?.filter(method => method?.enabled) || [];
      setAvailablePaymentMethods(enabledMethods);
      setGatewayConfig(config || {});
      
      // Set default payment method to first enabled method
      if (enabledMethods.length > 0) {
        setPaymentMethod(enabledMethods[0].id);
      }
    } catch (error) {
      console.error('Failed to load payment methods:', error);
      toast.error('Failed to load payment options');
}
  }

  function calculateGatewayFee(currentSubtotal = 0) {
    const selectedMethod = availablePaymentMethods.find(method => method?.id === paymentMethod);
    if (!selectedMethod || !selectedMethod.fee) return 0;
    
    const feeAmount = typeof selectedMethod.fee === 'number' 
      ? selectedMethod.fee * currentSubtotal 
      : selectedMethod.fee;
    
    return Math.max(feeAmount, selectedMethod.minimumFee || 0);
  }

  function handleInputChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
}
  }

// Helper function to compress image
  async function compressImage(file, maxSizeMB = 3) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        const maxDimension = 1920; // Max width or height
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          } else {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        // Try different quality levels until under maxSizeMB
        let quality = 0.8;
        const tryCompress = () => {
          canvas.toBlob((blob) => {
            if (blob.size <= maxSizeMB * 1024 * 1024 || quality <= 0.1) {
              // Create new file with compressed data
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              quality -= 0.1;
              tryCompress();
            }
          }, file.type, quality);
        };
        
        tryCompress();
      };
      
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = URL.createObjectURL(file);
    });
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // Reset states
      setUploadLoading(true);
      setUploadProgress(0);
      setIsCompressing(false);
      
      // Clear any previous errors
      if (errors.paymentProof) {
        setErrors(prev => ({
          ...prev,
          paymentProof: ''
        }));
      }

      // Validate file type with better detection
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
      const fileType = file.type.toLowerCase();
      
      // Check for HEIC files which browsers don't handle well
      if (file.name.toLowerCase().includes('.heic') || file.name.toLowerCase().includes('.heif')) {
        toast.error('HEIC format not supported. Please convert to JPG or PNG first.');
        setUploadLoading(false);
        return;
      }
      
      if (!allowedTypes.includes(fileType)) {
        toast.error('Please upload a JPG, PNG, or WebP image file');
        setUploadLoading(false);
        return;
      }

      setUploadProgress(20);

      // Check file size and compress if needed
      let processedFile = file;
      if (file.size > 3 * 1024 * 1024) { // 3MB threshold for compression
        if (file.size > 10 * 1024 * 1024) { // 10MB absolute limit
          toast.error('File is too large. Maximum size is 10MB.');
          setUploadLoading(false);
          return;
        }
        
        setIsCompressing(true);
        toast.info('Large file detected. Compressing image...');
        setUploadProgress(40);
        
        try {
          processedFile = await compressImage(file);
          toast.success(`Image compressed from ${(file.size / 1024 / 1024).toFixed(1)}MB to ${(processedFile.size / 1024 / 1024).toFixed(1)}MB`);
        } catch (compressionError) {
          console.warn('Compression failed, using original file:', compressionError);
          toast.warn('Could not compress image, using original file');
          processedFile = file;
        }
        
        setIsCompressing(false);
      }

      // Final size check
      if (processedFile.size > 5 * 1024 * 1024) {
        toast.error('File size must be under 5MB. Please resize your image.');
        setUploadLoading(false);
        return;
      }

      setUploadProgress(70);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadProgress(100);
        setPaymentProofPreview(e.target.result);
        setPaymentProof(processedFile);
        setUploadLoading(false);
        
        const savings = file.size !== processedFile.size 
          ? ` (compressed from ${(file.size / 1024 / 1024).toFixed(1)}MB)`
          : '';
        toast.success(`Payment proof uploaded successfully${savings}`);
      };
      
      reader.onerror = () => {
        setUploadLoading(false);
        setUploadProgress(0);
        toast.error('Failed to process image. Please try a different file.');
      };
      
      reader.readAsDataURL(processedFile);
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploadLoading(false);
      setUploadProgress(0);
      setIsCompressing(false);
      
      // Enhanced error messages
      if (error.message.includes('network') || error.message.includes('fetch')) {
        toast.error('Network error. Please check your connection and try again.');
      } else if (error.message.includes('compression')) {
        toast.error('Image processing failed. Please try a different image.');
      } else {
        toast.error('Upload failed. Please try again or contact support.');
      }
    }
  }

  function removePaymentProof() {
    setPaymentProof(null);
    setPaymentProofPreview(null);
    setUploadLoading(false);
    setUploadProgress(0);
    setIsCompressing(false);
    toast.info('Payment proof removed');
  }

  function handleUploadRetry() {
    // Reset upload states
    setUploadLoading(false);
    setUploadProgress(0);
    setIsCompressing(false);
    
    // Clear the current file input and trigger new selection
    const fileInput = document.getElementById('payment-proof-upload');
    if (fileInput) {
      fileInput.value = '';
      fileInput.click();
    }
  }

  function validateForm() {
    const newErrors = {};
    const required = ['name', 'phone', 'address', 'city', 'postalCode'];
    
    required.forEach(field => {
      if (!formData[field]?.trim()) {
        newErrors[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
      }
    });

    // Validate phone number
    if (formData.phone && !/^03[0-9]{9}$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid Pakistani phone number (03XXXXXXXXX)';
    }

    // Validate email if provided
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Validate payment proof and transaction ID for non-cash payments
    if (paymentMethod !== 'cash') {
      if (!transactionId.trim()) {
        newErrors.transactionId = 'Transaction ID is required';
      }
      if (!paymentProof) {
        newErrors.paymentProof = 'Payment proof is required';
      }
    }

    setErrors(newErrors);
return Object.keys(newErrors).length === 0;
  }

  async function handlePaymentRetry() {
    try {
      setLoading(true);
      const paymentResult = await paymentService.retryPayment(
        'previous_transaction_id',
        { amount: total, orderId: Date.now() }
      );
      return paymentResult;
    } catch (error) {
      toast.error('Payment retry failed: ' + error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function handlePaymentVerification(transactionId) {
    try {
      const verificationResult = await paymentService.verifyPayment(transactionId, {
        amount: total,
        orderId: Date.now()
      });
      return verificationResult;
    } catch (error) {
      toast.error('Payment verification failed: ' + error.message);
      throw error;
    }
  }

  // Convert file to base64 for safe serialization
  async function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
});
  }

  async function completeOrder(paymentResult) {
    try {
      let paymentProofData = null;
      
      // Safely convert file to base64 if payment proof exists
      if (paymentProof) {
        try {
          paymentProofData = await convertFileToBase64(paymentProof);
        } catch (fileError) {
          console.warn('Failed to convert payment proof to base64:', fileError);
          toast.warn('Payment proof could not be processed, but order will continue');
        }
      }

      // Validate cart items before order creation
      const validatedItems = [];
      let hasValidationErrors = false;
      
      for (const item of cart) {
        try {
          const currentProduct = await productService.getById(item.id);
          
          if (!currentProduct.isActive) {
            toast.error(`${item.name} is no longer available`);
            hasValidationErrors = true;
            continue;
          }
          
          if (currentProduct.stock < item.quantity) {
            toast.error(`${item.name} has insufficient stock. Available: ${currentProduct.stock}`);
            hasValidationErrors = true;
            continue;
          }
          
          // Use current validated price
          validatedItems.push({
            id: item.id,
            name: item.name,
            price: currentProduct.price, // Use validated current price
            quantity: item.quantity,
            image: item.image,
            validatedAt: new Date().toISOString()
          });
        } catch (error) {
          toast.error(`Failed to validate ${item.name}`);
          hasValidationErrors = true;
        }
      }
      
      if (hasValidationErrors) {
        throw new Error('Please review cart items and try again');
      }

      // Recalculate totals with validated prices and deals
      let validatedSubtotal = 0;
      let validatedDealSavings = 0;
      
      validatedItems.forEach(item => {
        const itemTotal = item.price * item.quantity;
        validatedSubtotal += itemTotal;
        
        // Recalculate deal savings with current validated data
        const originalItem = cart.find(cartItem => cartItem.id === item.id);
        if (originalItem?.dealType && originalItem?.dealValue) {
          if (originalItem.dealType === 'BOGO' && item.quantity >= 2) {
            const freeItems = Math.floor(item.quantity / 2);
            validatedDealSavings += freeItems * item.price;
          } else if (originalItem.dealType === 'Bundle' && item.quantity >= 3) {
            const [buyQty, payQty] = originalItem.dealValue.split('for').map(x => parseInt(x.trim()));
            if (buyQty && payQty && item.quantity >= buyQty) {
              const bundleSets = Math.floor(item.quantity / buyQty);
              const freeItems = bundleSets * (buyQty - payQty);
              validatedDealSavings += freeItems * item.price;
            }
          }
        }
      });
      
      const finalSubtotal = validatedSubtotal - validatedDealSavings;
      const validatedDeliveryCharge = finalSubtotal >= 2000 ? 0 : 150;
      const validatedTotal = finalSubtotal + validatedDeliveryCharge + gatewayFee;

      const orderData = {
        items: validatedItems,
        originalSubtotal: validatedSubtotal,
        dealSavings: validatedDealSavings,
        subtotal: finalSubtotal,
        deliveryCharge: validatedDeliveryCharge,
        gatewayFee,
        total: validatedTotal,
        paymentMethod,
        paymentResult,
        paymentStatus: paymentMethod === 'cash' ? 'pending' : 'pending_verification',
        paymentProof: paymentProofData ? {
          fileName: paymentProof?.name || null,
          fileSize: paymentProof?.size || 0,
          uploadedAt: new Date().toISOString(),
          dataUrl: paymentProofData
        } : null,
        transactionId: transactionId || paymentResult?.transactionId || null,
        deliveryAddress: {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          city: formData.city,
          postalCode: formData.postalCode,
          instructions: formData.instructions
        },
        status: paymentMethod === 'cash' ? 'confirmed' : 'payment_pending',
        verificationStatus: paymentMethod === 'cash' ? null : 'pending',
        priceValidatedAt: new Date().toISOString(),
        walletTransaction: paymentMethod === 'wallet' && paymentResult ? {
          transactionId: paymentResult.transactionId,
          type: 'order_payment',
          amount: validatedTotal,
          processedAt: paymentResult.timestamp
        } : null
      };

const order = await orderService.create(orderData);
      clearCartHook();
      toast.success('Order placed successfully!');
      navigate('/orders');
      return order;
    } catch (error) {
      toast.error('Failed to create order: ' + error.message);
      throw error;
}
  }

  async function handleSubmit(e, isRetry = false) {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Please fix the form errors');
      return;
    }

    try {
      setLoading(true);
      let paymentResult = null;

      // Process payment based on admin-managed gateway configuration
      const selectedGateway = availablePaymentMethods.find(method => method?.id === paymentMethod);
      
      if (!selectedGateway || !selectedGateway.enabled) {
        throw new Error(`Payment method ${paymentMethod} is not available`);
      }

      if (paymentMethod === 'card') {
        paymentResult = await paymentService.processCardPayment(
          { 
            cardNumber: '4111111111111111', 
            cvv: '123', 
            expiryDate: '12/25',
            cardholderName: formData.name 
          },
          total,
          Date.now()
        );
      } else if (paymentMethod === 'jazzcash' || paymentMethod === 'easypaisa') {
        paymentResult = await paymentService.processDigitalWalletPayment(
          paymentMethod,
          total,
          Date.now(),
          formData.phone
        );
      } else if (paymentMethod === 'wallet') {
        paymentResult = await paymentService.processWalletPayment(total, Date.now());
        
        // Record wallet transaction for order payment
        if (paymentResult?.status === 'completed') {
          await paymentService.recordWalletTransaction({
            type: 'order_payment',
            amount: -total, // Negative because it's a payment (deduction)
            description: `Order payment for ${cart?.length || 0} items`,
            reference: paymentResult.transactionId,
            orderId: Date.now(),
            transactionId: paymentResult.transactionId,
            status: 'completed',
            metadata: {
              itemCount: cart?.length || 0,
              originalAmount: originalSubtotal,
              dealSavings: dealSavings,
              deliveryCharge: deliveryCharge
            }
          });
        }
      } else if (paymentMethod === 'bank') {
        paymentResult = await paymentService.processBankTransfer(
          total,
          Date.now(),
          { accountNumber: '1234567890', bankName: 'Test Bank' }
        );
        
        // Handle verification if required
        if (paymentResult.requiresVerification) {
          const verificationResult = await handlePaymentVerification(paymentResult.transactionId);
          if (!verificationResult.verified) {
            throw new Error('Payment verification failed');
          }
        }
      }

      // Override system-generated transaction ID with user-provided one for non-cash payments
      if (paymentResult && transactionId && paymentMethod !== 'cash') {
        paymentResult.transactionId = transactionId;
      }

      // Complete the order
      await completeOrder(paymentResult);
      
} catch (error) {
      console.error('Order submission error:', error);
      
      // Track error for monitoring
      if (typeof window !== 'undefined' && window.performanceMonitor) {
        window.performanceMonitor.trackError(error, 'checkout-submission');
      }
      
      // Enhanced error handling with specific messaging and recovery
      let errorMessage = 'Order failed: ' + error.message;
      let showRetry = false;
      let retryDelay = 2000;
      let errorType = 'general';
      
      // Comprehensive error classification
      if (error.code === 'WALLET_PAYMENT_FAILED') {
        errorMessage = error.userGuidance || error.message;
        showRetry = error.retryable !== false;
        retryDelay = 3000;
        errorType = 'wallet';
      } else if (error.message.includes('payment')) {
        showRetry = !isRetry;
        errorMessage = `Payment processing failed. ${error.message}`;
        errorType = 'payment';
      } else if (error.message.includes('network') || error.message.includes('connectivity') || error.message.includes('fetch')) {
        showRetry = true;
        errorMessage = 'Network error occurred. Please check your internet connection and try again.';
        errorType = 'network';
      } else if (error.message.includes('timeout') || error.message.includes('deadline')) {
        showRetry = true;
        errorMessage = 'Request timed out. Please try again.';
        errorType = 'timeout';
      } else if (error.message.includes('validation') || error.message.includes('invalid')) {
        errorMessage = 'Please check your order details and try again.';
        errorType = 'validation';
      } else if (error.message.includes('server') || error.message.includes('500') || error.message.includes('503')) {
        showRetry = true;
        errorMessage = 'Server error occurred. Please try again in a few moments.';
        errorType = 'server';
        retryDelay = 5000;
      }
      
      toast.error(errorMessage, {
        duration: errorType === 'network' ? 6000 : 4000,
        action: showRetry && !isRetry ? {
          label: 'Retry',
          onClick: () => handleSubmit(e, true)
        } : undefined
      });
      
      // Offer retry for applicable errors with enhanced messaging
      if (showRetry && !isRetry) {
        setTimeout(() => {
          let retryMessage;
          
          switch (errorType) {
            case 'wallet':
              retryMessage = `${error.walletType || 'Wallet'} payment failed. Would you like to try again or choose a different payment method?`;
              break;
            case 'network':
              retryMessage = 'Network issue detected. Would you like to retry the order?';
              break;
            case 'timeout':
              retryMessage = 'The request timed out. Would you like to try again?';
              break;
            case 'server':
              retryMessage = 'Server error occurred. Would you like to retry your order?';
              break;
            default:
              retryMessage = 'Order failed. Would you like to retry?';
          }
            
          if (window.confirm(retryMessage)) {
            handleSubmit(e, true);
          }
        }, retryDelay);
      }
    } finally {
      setLoading(false);
    }
  }

  // Redirect if cart is empty
  if (!cart || cart.length === 0) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Your cart is empty</h1>
            <p className="text-gray-600 mb-6">Add some products to your cart before checkout</p>
            <Button onClick={() => navigate('/')}>Continue Shopping</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center mb-8">
          <ApperIcon className="h-8 w-8 text-primary mr-3" />
          <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Summary */}
          <div className="order-2 lg:order-1">
            <div className="card p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
              <div className="space-y-4">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b">
                    <div className="flex items-center">
                      <img 
                        src={item.image || item.imageUrl || '/placeholder-image.jpg'} 
                        alt={item.name}
                        className="w-12 h-12 object-cover rounded mr-3"
                        onError={(e) => {
                          e.target.src = '/placeholder-image.jpg';
                        }}
                      />
                      <div>
                        <h3 className="font-medium">{item.name}</h3>
                        <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                      </div>
                    </div>
                    <span className="font-semibold">
                      Rs. {(item.price * item.quantity).toLocaleString()}
</span>
                  </div>
                ))}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Original Subtotal:</span>
                    <span>Rs. {originalSubtotal.toLocaleString()}</span>
                  </div>
                  {dealSavings > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span className="flex items-center">
                        <ApperIcon name="Gift" size={16} className="mr-1" />
                        Deal Savings:
                      </span>
                      <span>-Rs. {dealSavings.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium">
                    <span>Subtotal after deals:</span>
                    <span>Rs. {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery Charge:</span>
                    <span>Rs. {deliveryCharge.toLocaleString()}</span>
                  </div>
                  {gatewayFee > 0 && (
                    <div className="flex justify-between">
                      <span>Gateway Fee:</span>
                      <span>Rs. {gatewayFee.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-semibold border-t pt-2">
                    <span>Total:</span>
                    <span className="gradient-text">Rs. {total.toLocaleString()}</span>
                  </div>
                  {dealSavings > 0 && (
                    <div className="text-center py-2 bg-green-50 rounded-lg">
                      <span className="text-sm text-green-700 font-medium">
                        🎉 You saved Rs. {dealSavings.toLocaleString()} with deals!
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Checkout Form */}
          <div className="order-1 lg:order-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Delivery Information */}
              <div className="card p-6">
                <h2 className="text-xl font-semibold mb-4">Delivery Information</h2>
                <div className="space-y-4">
                  <div>
                    <Input
                      label="Full Name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      error={errors.name}
                      required
                    />
                  </div>
                  <div>
                    <Input
                      label="Phone Number"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      error={errors.phone}
                      placeholder="03XXXXXXXXX"
                      required
                    />
                  </div>
                  <div>
                    <Input
                      label="Email Address"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      error={errors.email}
                    />
                  </div>
                  <div>
                    <Input
                      label="Address"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      error={errors.address}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="City"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      error={errors.city}
                      required
                    />
                    <Input
                      label="Postal Code"
                      name="postalCode"
                      value={formData.postalCode}
                      onChange={handleInputChange}
                      error={errors.postalCode}
                      required
                    />
                  </div>
                  <div>
                    <Input
                      label="Delivery Instructions"
                      name="instructions"
value={formData.instructions}
                      onChange={handleInputChange}
                      placeholder="Special instructions for delivery..."
                    />
                  </div>
                </div>
              </div>
              {/* Payment Method */}
              <div className="card p-6">
                <h2 className="text-xl font-semibold mb-4">Payment Method</h2>
                {availablePaymentMethods.length === 0 ? (
                  <div className="text-center py-8">
                    <ApperIcon name="CreditCard" size={48} className="mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">Loading payment methods...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {availablePaymentMethods.map((method) => (
                      <div
                        key={method.id}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                          paymentMethod === method.id
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setPaymentMethod(method.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-medium text-gray-900">{method.name}</h3>
                                <p className="text-sm text-gray-600">{method.description}</p>
                                {method.fee > 0 && (
                                  <p className="text-xs text-orange-600 mt-1">
                                    Fee: {typeof method.fee === 'number' ? `${(method.fee * 100).toFixed(1)}%` : `PKR ${method.fee}`}
                                    {method.minimumFee && ` (min PKR ${method.minimumFee})`}
                                  </p>
                                )}
                              </div>
                              <div className={`w-4 h-4 rounded-full border-2 ${
                                paymentMethod === method.id
                                  ? 'border-primary bg-primary'
                                  : 'border-gray-300'
                              }`}>
                                {paymentMethod === method.id && (
                                  <div className="w-full h-full rounded-full bg-white scale-50"></div>
                                )}
                              </div>
                            </div>

                            {/* Account Details for Admin-Configured Gateways */}
                            {paymentMethod === method.id && method.accountNumber && (
                              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="space-y-2">
                                  {method.accountName && (
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-blue-700 font-medium">Account Name:</span>
                                      <div className="flex items-center space-x-2">
                                        <span className="text-sm font-mono text-blue-900">{method.accountName}</span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(method.accountName);
                                            toast.success('Account name copied!');
                                          }}
                                          className="text-blue-600 hover:text-blue-800 transition-colors"
                                        >
                                          <ApperIcon name="Copy" size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-blue-700 font-medium">Account Number:</span>
                                    <div className="flex items-center space-x-2">
                                      <span className="text-sm font-mono text-blue-900">{method.accountNumber}</span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(method.accountNumber);
                                          toast.success('Account number copied!');
                                        }}
                                        className="text-blue-600 hover:text-blue-800 transition-colors"
                                      >
                                        <ApperIcon name="Copy" size={14} />
                                      </button>
                                    </div>
                                  </div>
                                  {method.instructions && (
<div className="pt-2 border-t border-blue-200">
                                      <p className="text-xs text-blue-700">{method.instructions}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
{/* Payment Details for Non-Cash Methods */}
                {paymentMethod !== 'cash' && (
                  <div className="mt-4 space-y-4">
                    {/* Transaction ID Input */}
                    <div>
                      <Input
                        label="Transaction ID"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        placeholder="Enter your transaction ID"
                        error={errors.transactionId}
                      />
                    </div>

                    {/* Payment Proof Upload for Bank Transfers */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload Payment Proof *
                      </label>
                      
                      {!paymentProof && !uploadLoading && (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-primary transition-colors">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="payment-proof-upload"
                          />
                          <label
                            htmlFor="payment-proof-upload"
                            className="cursor-pointer flex flex-col items-center space-y-2"
                          >
                            <ApperIcon name="Upload" size={32} className="text-gray-400" />
                            <div>
                              <span className="text-primary font-medium">Click to upload</span>
                              <span className="text-gray-500"> or drag and drop</span>
                            </div>
                            <span className="text-xs text-gray-400">PNG, JPG, WebP up to 5MB</span>
                          </label>
                        </div>
                      )}

{uploadLoading && (
                        <div className="border-2 border-dashed border-blue-300 bg-blue-50 rounded-lg p-6 text-center">
                          <div className="space-y-3">
                            {isCompressing ? (
                              <>
                                <ApperIcon name="Zap" size={32} className="text-amber-500 animate-pulse mx-auto mb-2" />
                                <p className="text-amber-700 font-medium">Compressing large image...</p>
                                <p className="text-amber-600 text-sm">Optimizing file size for faster upload</p>
                              </>
                            ) : (
                              <>
                                <ApperIcon name="Loader2" size={32} className="text-blue-500 animate-spin mx-auto mb-2" />
                                <p className="text-blue-700 font-medium">Processing image...</p>
                                <p className="text-blue-600 text-sm">Please wait while we prepare your preview</p>
                              </>
                            )}
                            
                            {uploadProgress > 0 && (
                              <div className="w-full bg-blue-200 rounded-full h-2 mt-3">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                                  style={{ width: `${uploadProgress}%` }}
                                ></div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {errors.paymentProof && (
                        <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-3 upload-error-animate">
                          <div className="flex items-center space-x-2">
                            <ApperIcon name="AlertCircle" size={16} className="text-red-500" />
                            <p className="text-sm text-red-600">{errors.paymentProof}</p>
                          </div>
                          <div className="mt-2 flex space-x-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="small"
                              onClick={handleUploadRetry}
                              className="text-red-600 border-red-300 hover:bg-red-50"
                            >
                              <ApperIcon name="RefreshCw" size={14} className="mr-1" />
                              Retry Upload
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="small"
                              onClick={() => toast.info('Contact support at +92-300-SUPPORT for assistance')}
                              className="text-blue-600 border-blue-300 hover:bg-blue-50"
                            >
                              <ApperIcon name="MessageCircle" size={14} className="mr-1" />
                              Contact Support
                            </Button>
                          </div>
                        </div>
                      )}

                      {paymentProof && paymentProofPreview && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                <ApperIcon name="CheckCircle" size={20} className="text-green-600" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-green-800">
                                  Payment Proof Uploaded
                                </p>
                                <p className="text-xs text-green-600">
                                  {paymentProof.name} • {(paymentProof.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={removePaymentProof}
                              className="text-green-600 hover:text-green-800 transition-colors p-1 hover:bg-green-100 rounded"
                            >
                              <ApperIcon name="X" size={16} />
                            </button>
                          </div>
                          
                          <div className="mt-3">
                            <img
                              src={paymentProofPreview}
                              alt="Payment proof preview"
                              className="max-w-full h-40 object-cover rounded-lg border border-green-200 shadow-sm"
                              onError={() => toast.error('Failed to display image preview')}
                            />
                          </div>
                          
                          <div className="mt-3 flex items-center space-x-2 text-xs text-green-700 bg-green-100 rounded-lg p-2">
                            <ApperIcon name="Info" size={14} />
                            <span>Image ready for submission. You can now place your order.</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <ApperIcon name="Info" size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800">
                          <p className="font-medium mb-1">Payment Instructions:</p>
                          <ul className="space-y-1 text-xs">
                            <li>• Transfer the exact amount using the account details above</li>
                            <li>• Copy the transaction ID and enter it in the field above</li>
                            <li>• Take a clear screenshot of the payment confirmation</li>
                            <li>• Upload the screenshot for verification</li>
                            <li>• Your order will be processed after payment verification</li>
                          </ul>
</div>
</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="card p-6">
<Button
                  type="submit"
                  disabled={loading || uploadLoading || (paymentMethod !== 'cash' && !paymentProof)}
                  className="w-full"
                >
                  {loading ? 'Processing...' : `Place Order - Rs. ${total.toLocaleString()}`}
                </Button>
</div>
            </form>
          </div>
        </div>
      </div>
    </div>
    );
}

export default Checkout;