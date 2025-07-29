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
import ChatWidget from "@/components/molecules/ChatWidget";
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
  const [uploadAttempts, setUploadAttempts] = useState(0);
  const [lastUploadError, setLastUploadError] = useState(null);
  const [showAlternativeOptions, setShowAlternativeOptions] = useState(false);
  const [showHelpOptions, setShowHelpOptions] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [showSampleImages, setShowSampleImages] = useState(false);
  const [testUploadMode, setTestUploadMode] = useState(false);
  const [orderReserved, setOrderReserved] = useState(false);
  const [reservationTimer, setReservationTimer] = useState(3600); // 1 hour in seconds
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
    loadSavedProgress();
  }, []);

  // Load saved form progress from localStorage
  function loadSavedProgress() {
    try {
      const savedProgress = localStorage.getItem('checkout-progress');
      if (savedProgress) {
        const data = JSON.parse(savedProgress);
        if (data.formData) {
          setFormData(prevData => ({ ...prevData, ...data.formData }));
        }
        if (data.paymentMethod) {
          setPaymentMethod(data.paymentMethod);
        }
        if (data.transactionId) {
          setTransactionId(data.transactionId);
        }
        toast.info('Previous form data restored');
      }
    } catch (error) {
      console.warn('Failed to load saved progress:', error);
    }
  }

  // Save form progress to localStorage
  function saveProgress() {
    try {
      const progressData = {
        formData,
        paymentMethod,
        transactionId,
        timestamp: Date.now()
      };
      localStorage.setItem('checkout-progress', JSON.stringify(progressData));
    } catch (error) {
      console.warn('Failed to save progress:', error);
    }
  }

  // Auto-save progress when form data changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.name || formData.phone || formData.address) {
        saveProgress();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [formData, paymentMethod, transactionId]);
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

async function handleFileUpload(e, isRetry = false) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // Reset states
      setUploadLoading(true);
      setUploadProgress(0);
      setIsCompressing(false);
      setShowAlternativeOptions(false);
      
      if (!isRetry) {
        setUploadAttempts(0);
        setLastUploadError(null);
      }
      
      // Clear any previous errors
      if (errors.paymentProof) {
        setErrors(prev => ({
          ...prev,
          paymentProof: ''
        }));
      }

      // Enhanced file validation with better error messages
// Enhanced file validation with better error messages and format support
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
      const fileType = file.type.toLowerCase();
      const fileName = file.name.toLowerCase();
      
      // Check for HEIC files and offer conversion guidance
      if (fileName.includes('.heic') || fileName.includes('.heif')) {
        setLastUploadError({
          type: 'unsupported_format',
          message: 'HEIC format not supported',
          guidance: 'Please convert to JPG or PNG using your phone\'s photo app or an online converter. Most phones can save photos in JPG format in camera settings.'
        });
        toast.error('HEIC format not supported. Please convert to JPG/PNG first.');
        setUploadLoading(false);
        setShowAlternativeOptions(true);
        return;
      }
      
      // Check for other unsupported formats with specific guidance
      if (!allowedTypes.includes(fileType)) {
        let errorMessage = 'Invalid file format';
        let guidance = 'Only JPG, PNG, WebP images and PDF receipts are supported';
        
        if (fileType.includes('bmp') || fileType.includes('gif') || fileType.includes('tiff')) {
          errorMessage = 'Image format not optimized for upload';
          guidance = 'Please save your image as JPG or PNG format. Most image editors can convert to these formats.';
        } else if (fileType.includes('svg')) {
          errorMessage = 'Vector graphics not supported';
          guidance = 'Please convert to JPG or PNG format, or take a screenshot of your payment receipt.';
        } else if (fileType.includes('word') || fileType.includes('doc')) {
          errorMessage = 'Document format not supported';
          guidance = 'Please export your document as PDF or take a screenshot and save as JPG/PNG.';
        }
        
        setLastUploadError({
          type: 'invalid_format',
          message: errorMessage,
          guidance: guidance
        });
        toast.error(`${errorMessage}. Please use JPG, PNG, WebP, or PDF format.`);
        setUploadLoading(false);
        setShowAlternativeOptions(true);
        return;

      setUploadProgress(20);

      // Enhanced file size validation with progressive limits
// Enhanced file size validation with format-specific limits
      const maxSizeForImages = 15 * 1024 * 1024; // 15MB for images
      const maxSizeForPDF = 10 * 1024 * 1024; // 10MB for PDFs
      const maxSize = fileType === 'application/pdf' ? maxSizeForPDF : maxSizeForImages;
      
      if (file.size > maxSize) {
        const maxSizeMB = fileType === 'application/pdf' ? '10MB' : '15MB';
        setLastUploadError({
          type: 'file_too_large',
          message: 'File too large',
          guidance: `Maximum file size is ${maxSizeMB}. ${fileType === 'application/pdf' ? 'Try compressing your PDF or export at lower quality.' : 'Please resize your image, reduce quality, or take a new photo with lower resolution.'}`
        });
        toast.error(`File is too large. Maximum size is ${maxSizeMB}.`);
        setUploadLoading(false);
        setShowAlternativeOptions(true);
        return;
      }

// Handle compression for images only (skip PDFs)
      let processedFile = file;
      if (fileType !== 'application/pdf' && file.size > 3 * 1024 * 1024) { // 3MB threshold for compression
        setIsCompressing(true);
        toast.info('Large image detected. Optimizing for faster upload...');
        setUploadProgress(40);
        
        try {
          processedFile = await compressImage(file);
          const originalSize = (file.size / 1024 / 1024).toFixed(1);
          const compressedSize = (processedFile.size / 1024 / 1024).toFixed(1);
          toast.success(`✅ Image optimized: ${originalSize}MB → ${compressedSize}MB`);
        } catch (compressionError) {
          console.warn('Compression failed, using original file:', compressionError);
          
          // If compression fails but file is still under 8MB, proceed
          if (file.size <= 8 * 1024 * 1024) {
            toast.warn('Could not optimize image, using original file');
            processedFile = file;
          } else {
            setLastUploadError({
              type: 'compression_failed',
              message: 'Image optimization failed',
              guidance: 'Please resize your image manually using your phone\'s photo editor or try taking a new photo at lower resolution.'
            });
            throw new Error('Compression failed and file too large');
          }
        }
        
        setIsCompressing(false);
      } else if (fileType === 'application/pdf') {
        // For PDFs, just provide feedback about processing
        toast.info('Processing PDF receipt...');
        setUploadProgress(50);
      }

// Final size check after compression with format-specific limits
      const finalMaxSize = fileType === 'application/pdf' ? 10 * 1024 * 1024 : 8 * 1024 * 1024;
      if (processedFile.size > finalMaxSize) {
        const finalMaxSizeMB = fileType === 'application/pdf' ? '10MB' : '8MB';
        setLastUploadError({
          type: 'size_after_compression',
          message: `File still too large after processing`,
          guidance: fileType === 'application/pdf' 
            ? 'Please compress your PDF or export at lower quality from your banking app.'
            : 'Please take a new photo with lower resolution, or use your phone\'s photo editor to reduce file size.'
        });
        toast.error(`File size must be under ${finalMaxSizeMB}. Please reduce file size.`);
        setUploadLoading(false);
        setShowAlternativeOptions(true);
        return;
      }

      setUploadProgress(70);

      // Create preview with enhanced error handling
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          setUploadProgress(100);
          setPaymentProofPreview(e.target.result);
          setPaymentProof(processedFile);
          setUploadLoading(false);
          setUploadAttempts(0);
          setLastUploadError(null);
          setShowAlternativeOptions(false);
          
          // Save the successful upload state
          const progressData = JSON.parse(localStorage.getItem('checkout-progress') || '{}');
          progressData.hasPaymentProof = true;
          progressData.uploadSuccess = true;
          localStorage.setItem('checkout-progress', JSON.stringify(progressData));
          
const savings = file.size !== processedFile.size 
            ? ` (optimized from ${(file.size / 1024 / 1024).toFixed(1)}MB)`
            : '';
          const fileTypeText = fileType === 'application/pdf' ? '📄 PDF receipt' : '📸 Payment proof';
          toast.success(`✅ ${fileTypeText} uploaded successfully${savings}`);
        } catch (previewError) {
          throw new Error('Failed to create image preview');
        }
      };
      
      reader.onerror = (readerError) => {
        console.error('FileReader error:', readerError);
        setLastUploadError({
          type: 'read_failed',
          message: 'Failed to read image file',
          guidance: 'The image file may be corrupted. Please try a different photo'
        });
        setUploadLoading(false);
        setUploadProgress(0);
        setShowAlternativeOptions(true);
        toast.error('Failed to process image. Please try a different file.');
      };
      
      reader.readAsDataURL(processedFile);
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploadLoading(false);
      setUploadProgress(0);
      setIsCompressing(false);
      
      const currentAttempts = uploadAttempts + 1;
      setUploadAttempts(currentAttempts);
      
// Enhanced error classification and user guidance
      let errorMessage = 'Upload failed. Please try again.';
      let shouldShowAlternatives = false;
      let errorDetails = null;
      
      if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('connection')) {
        errorMessage = 'Network error. Please check your connection and try again.';
        errorDetails = {
          type: 'network_error',
          message: 'Network connection issue',
          guidance: 'Check your internet connection, try switching between WiFi and mobile data, or move to an area with better signal strength.'
        };
        shouldShowAlternatives = currentAttempts >= 2;
      } else if (error.message.includes('compression') || error.message.includes('processing')) {
        errorMessage = 'File processing failed. Please try a different approach.';
        errorDetails = {
          type: 'processing_error',
          message: 'File processing failed',
          guidance: 'Try: 1) Taking a new screenshot 2) Saving in different format (JPG/PNG) 3) Using a different device or app to capture the receipt.'
        };
        shouldShowAlternatives = true;
      } else if (error.message.includes('memory') || error.message.includes('resource')) {
        errorMessage = 'Device memory issue. Please free up space and try again.';
        errorDetails = {
          type: 'memory_error',
          message: 'Insufficient device memory',
          guidance: 'Close other apps, restart your browser, or try uploading from a different device with more available memory.'
        };
        shouldShowAlternatives = true;
      } else if (error.message.includes('timeout') || error.message.includes('deadline')) {
        errorMessage = 'Upload timed out. Please try again with a smaller file.';
        errorDetails = {
          type: 'timeout_error',
          message: 'Upload timeout',
          guidance: 'Try compressing your image first, or use a faster internet connection. Large files may need more time to upload.'
        };
        shouldShowAlternatives = currentAttempts >= 2;
      } else {
        errorMessage = 'Upload failed. Multiple solutions available.';
        errorDetails = {
          type: 'unknown_error',
          message: 'Unknown upload error',
          guidance: 'Try: 1) Refreshing the page 2) Using a different browser 3) Contacting support via chat for immediate assistance.'
        };
        shouldShowAlternatives = currentAttempts >= 1;
      }
      
      setLastUploadError(errorDetails);
      setShowAlternativeOptions(shouldShowAlternatives);
      
      toast.error(errorMessage, {
        duration: shouldShowAlternatives ? 6000 : 4000
      });
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
    setErrors(prev => ({ ...prev, paymentProof: '' }));
    
    // Clear the current file input and trigger new selection
    const fileInput = document.getElementById('payment-proof-upload');
    if (fileInput) {
      fileInput.value = '';
      fileInput.click();
    }
  }

  function handleSmartRetry() {
    // Intelligent retry based on error type
    if (lastUploadError?.type === 'network_error') {
      // Check network status before retry
      if (!navigator.onLine) {
        toast.error('No internet connection. Please check your network and try again.');
        return;
      }
      
      // Wait briefly for network to stabilize
      setTimeout(() => {
        handleUploadRetry();
      }, 1000);
    } else {
      handleUploadRetry();
    }
  }

function handleAlternativeUpload(method) {
    const orderDetails = `Order Details:
- Amount: Rs. ${total.toLocaleString()}
- Items: ${cart.length} items
- Payment Method: ${availablePaymentMethods.find(m => m.id === paymentMethod)?.name || paymentMethod}
- Transaction ID: ${transactionId}
- Customer: ${formData.name}
- Phone: ${formData.phone}`;

    if (method === 'email') {
      const subject = encodeURIComponent('Payment Proof - Order Submission');
      const body = encodeURIComponent(`Hello,

I am unable to upload my payment proof directly on the website. Please find the payment screenshot attached to this email.

${orderDetails}

Please process my order once you verify the payment.

Thank you!`);
      
      window.location.href = `mailto:orders@freshmart.com?subject=${subject}&body=${body}`;
      toast.info('Email client opened. Please attach your payment proof and send.');
    } else if (method === 'whatsapp') {
      const message = encodeURIComponent(`Hello! I need help uploading my payment proof for my order.

${orderDetails}

I will send the payment screenshot in the next message. Please help me complete my order.`);
      
      window.open(`https://wa.me/923001234567?text=${message}`, '_blank');
      toast.info('WhatsApp opened. Please send your payment proof there.');
    }

    // Mark that customer used alternative method and reserve order
    const progressData = JSON.parse(localStorage.getItem('checkout-progress') || '{}');
    progressData.alternativeUploadUsed = method;
    progressData.alternativeUploadTime = Date.now();
    progressData.orderReserved = true;
    progressData.reservationExpiry = Date.now() + (3600 * 1000); // 1 hour
    localStorage.setItem('checkout-progress', JSON.stringify(progressData));
    
    setOrderReserved(true);
    startReservationTimer();
  }

  function startReservationTimer() {
    const interval = setInterval(() => {
      setReservationTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setOrderReserved(false);
          toast.warning('Order reservation expired. Please resubmit your order.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function formatReservationTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  function handleTestUpload(e) {
    setTestUploadMode(true);
    toast.info('Test mode: This upload won\'t be saved. Use this to check if your file works.');
    handleFileUpload(e, false, true);
  }

  function handleShowHelp() {
    setShowHelpOptions(!showHelpOptions);
  }

  function handleContactSupport(method) {
    if (method === 'chat') {
      // This will be handled by the ChatWidget component
      toast.info('Live chat opened. Our support team will help you shortly.');
    } else if (method === 'email') {
      const subject = encodeURIComponent('Checkout Help Required');
      const body = encodeURIComponent(`Hello,

I need assistance with my checkout process. 

Current Issue: [Please describe your issue]

Order Amount: Rs. ${total.toLocaleString()}
Items: ${cart.length} items

Please help me complete my order.

Thank you!`);
      
      window.location.href = `mailto:support@freshmart.com?subject=${subject}&body=${body}`;
    } else if (method === 'whatsapp') {
      const message = encodeURIComponent(`Hello! I need help with my checkout process.

Order Amount: Rs. ${total.toLocaleString()}
Items: ${cart.length} items

Please assist me in completing my order.`);
      
      window.open(`https://wa.me/923001234567?text=${message}`, '_blank');
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
<div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <ApperIcon name="ShoppingCart" className="h-8 w-8 text-primary mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
          </div>
          
          {/* Help Button */}
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              onClick={handleShowHelp}
              className="flex items-center space-x-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
            >
              <ApperIcon name="HelpCircle" size={20} />
              <span>Need Help?</span>
            </Button>

            {/* Help Options Dropdown */}
            {showHelpOptions && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Get Support</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => handleContactSupport('chat')}
                      className="w-full flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <ApperIcon name="MessageCircle" size={16} className="text-blue-600" />
                      <div className="text-left">
                        <div className="font-medium text-sm">Live Chat</div>
                        <div className="text-xs text-gray-500">Get instant help</div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => handleContactSupport('whatsapp')}
                      className="w-full flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <ApperIcon name="MessageSquare" size={16} className="text-green-600" />
                      <div className="text-left">
                        <div className="font-medium text-sm">WhatsApp</div>
                        <div className="text-xs text-gray-500">+92 300 123 4567</div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => handleContactSupport('email')}
                      className="w-full flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <ApperIcon name="Mail" size={16} className="text-orange-600" />
                      <div className="text-left">
                        <div className="font-medium text-sm">Email Support</div>
                        <div className="text-xs text-gray-500">support@freshmart.com</div>
                      </div>
                    </button>
                    
                    <hr className="my-2" />
                    
                    <button
                      onClick={() => setShowFAQ(true)}
                      className="w-full flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <ApperIcon name="BookOpen" size={16} className="text-purple-600" />
                      <div className="text-left">
                        <div className="font-medium text-sm">FAQ</div>
                        <div className="text-xs text-gray-500">Common questions</div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => setShowSampleImages(true)}
                      className="w-full flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <ApperIcon name="Image" size={16} className="text-indigo-600" />
                      <div className="text-left">
                        <div className="font-medium text-sm">Sample Images</div>
                        <div className="text-xs text-gray-500">Valid payment proofs</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Order Reservation Status */}
        {orderReserved && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <ApperIcon name="Clock" size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-blue-900">Order Reserved</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Your order is reserved for <strong>{formatReservationTime(reservationTimer)}</strong>. 
                  We'll hold your items while you send the payment proof via email or WhatsApp.
                </p>
                <div className="mt-2 text-xs text-blue-600">
                  Reservation ID: {Date.now().toString().slice(-8)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FAQ Modal */}
        {showFAQ && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Frequently Asked Questions</h2>
                  <button
                    onClick={() => setShowFAQ(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <ApperIcon name="X" size={24} />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="border-b pb-4">
                    <h3 className="font-medium text-gray-900 mb-2">Why can't I upload my payment proof?</h3>
                    <p className="text-sm text-gray-600">
                      Common reasons include: file too large (&gt;5MB), wrong format (use JPG/PNG), 
                      poor internet connection, or browser issues. Try compressing your image first.
                    </p>
                  </div>
                  
                  <div className="border-b pb-4">
                    <h3 className="font-medium text-gray-900 mb-2">What makes a valid payment proof?</h3>
                    <p className="text-sm text-gray-600">
                      Clear screenshot showing: transaction amount, transaction ID, date/time, 
                      recipient account, and your name. Avoid blurry or cropped images.
                    </p>
                  </div>
                  
                  <div className="border-b pb-4">
                    <h3 className="font-medium text-gray-900 mb-2">How long does verification take?</h3>
                    <p className="text-sm text-gray-600">
                      Usually 30 minutes to 2 hours during business hours. Your order is reserved 
                      for 1 hour automatically. We'll send updates via SMS.
                    </p>
                  </div>
                  
                  <div className="border-b pb-4">
                    <h3 className="font-medium text-gray-900 mb-2">Can I edit my order after submission?</h3>
                    <p className="text-sm text-gray-600">
                      Contact support immediately via WhatsApp or chat. Minor changes may be possible 
                      before payment verification.
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">What if my payment was deducted but order failed?</h3>
                    <p className="text-sm text-gray-600">
                      Don't worry! Contact support with your transaction ID. We'll verify and process 
                      your order manually within 24 hours.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sample Images Modal */}
        {showSampleImages && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Sample Payment Proof Images</h2>
                  <button
                    onClick={() => setShowSampleImages(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <ApperIcon name="X" size={24} />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h3 className="font-medium text-green-700 flex items-center">
                      <ApperIcon name="CheckCircle" size={16} className="mr-2" />
                      ✅ Good Examples
                    </h3>
                    
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="bg-white rounded border p-3 mb-2">
                        <div className="text-xs font-mono">
                          <div>💳 Bank Transfer Receipt</div>
                          <div>Amount: Rs. 2,450.00</div>
                          <div>To: FreshMart Store</div>
                          <div>TID: TXN123456789</div>
                          <div>Date: 15 Dec 2024 14:30</div>
                          <div>Status: ✅ Successful</div>
                        </div>
                      </div>
                      <p className="text-xs text-green-700">
                        Clear, complete information visible
                      </p>
                    </div>
                    
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="bg-white rounded border p-3 mb-2">
                        <div className="text-xs font-mono">
                          <div>📱 JazzCash Receipt</div>
                          <div>Sent Rs. 1,250 to</div>
                          <div>03XX-XXXXXXX</div>
                          <div>TID: JC789123456</div>
                          <div>15-Dec-24 2:30 PM ✅</div>
                        </div>
                      </div>
                      <p className="text-xs text-green-700">
                        Mobile wallet confirmation screen
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="font-medium text-red-700 flex items-center">
                      <ApperIcon name="XCircle" size={16} className="mr-2" />
                      ❌ Poor Examples
                    </h3>
                    
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="bg-white rounded border p-3 mb-2 blur-sm">
                        <div className="text-xs font-mono">
                          <div>💳 Bank Transfer Receipt</div>
                          <div>Amount: Rs. 2,450.00</div>
                          <div>To: FreshMart Store</div>
                        </div>
                      </div>
                      <p className="text-xs text-red-700">
                        Blurry or unclear image
                      </p>
                    </div>
                    
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="bg-white rounded border p-3 mb-2" style={{clipPath: 'inset(40% 0 0 0)'}}>
                        <div className="text-xs font-mono">
                          <div>TID: JC789123456</div>
                          <div>15-Dec-24 2:30 PM ✅</div>
                        </div>
                      </div>
                      <p className="text-xs text-red-700">
                        Cropped - missing important details
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">📝 Checklist for Valid Payment Proof</h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>✅ Transaction amount matches your order total</li>
                    <li>✅ Transaction ID clearly visible</li>
                    <li>✅ Date and time stamp present</li>
                    <li>✅ Recipient name/account visible</li>
                    <li>✅ "Successful" or "Completed" status shown</li>
                    <li>✅ Image is clear and not blurry</li>
                    <li>✅ All corners of the receipt visible</li>
                  </ul>
                </div>
              </div>
</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Summary */}
          <div className="order-2 lg:order-1">
            <div className="card p-6 mb-6">
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
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Upload Payment Proof *
                        </label>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => setShowSampleImages(true)}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            View samples
                          </button>
                          <span className="text-gray-300">|</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleTestUpload}
                            className="hidden"
                            id="test-upload"
                          />
                          <label
                            htmlFor="test-upload"
                            className="text-xs text-green-600 hover:text-green-800 underline cursor-pointer"
                          >
                            Test upload
                          </label>
                        </div>
                      </div>
                      
                      {!paymentProof && !uploadLoading && (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-primary transition-colors upload-zone-enhanced">
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
<span className="text-xs text-gray-400">JPG, PNG, PDF, WebP up to 15MB</span>
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
                                <p className="text-blue-700 font-medium">
                                  {testUploadMode ? 'Testing file upload...' : 'Processing image...'}
                                </p>
                                <p className="text-blue-600 text-sm">
                                  {testUploadMode ? 'This is just a test - file won\'t be saved' : 'Please wait while we prepare your preview'}
                                </p>
                              </>
                            )}
                            
                            {uploadProgress > 0 && (
                              <div className="w-full bg-blue-200 rounded-full h-2 mt-3">
                                <div 
                                  className="upload-progress-bar h-2 rounded-full transition-all duration-300" 
                                  style={{ width: `${uploadProgress}%` }}
                                ></div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

{(errors.paymentProof || lastUploadError) && (
                        <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-4 upload-error-animate">
                          <div className="flex items-start space-x-2">
                            <ApperIcon name="AlertCircle" size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-red-800">
                                {lastUploadError?.message || errors.paymentProof}
                              </p>
                              {lastUploadError?.guidance && (
                                <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-xs text-red-700">
                                  <p className="font-medium">💡 How to fix this:</p>
                                  <p>{lastUploadError.guidance}</p>
                                </div>
                              )}
                              
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="small"
                                  onClick={handleSmartRetry}
                                  className="text-red-600 border-red-300 hover:bg-red-50 retry-button-enhanced"
                                >
                                  <ApperIcon name="RefreshCw" size={14} className="mr-1" />
                                  Try Again
                                  {uploadAttempts > 0 && (
                                    <span className="text-xs ml-1">({uploadAttempts} attempts)</span>
                                  )}
                                </Button>
                                
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="small"
                                  onClick={() => handleContactSupport('chat')}
                                  className="text-purple-600 border-purple-300 hover:bg-purple-50"
                                >
                                  <ApperIcon name="MessageCircle" size={14} className="mr-1" />
                                  Live Chat Help
                                </Button>
                                
                                {showAlternativeOptions && (
                                  <>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="small"
                                      onClick={() => handleAlternativeUpload('email')}
                                      className="text-blue-600 border-blue-300 hover:bg-blue-50"
                                    >
                                      <ApperIcon name="Mail" size={14} className="mr-1" />
                                      Email Proof
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="small"
                                      onClick={() => handleAlternativeUpload('whatsapp')}
                                      className="text-green-600 border-green-300 hover:bg-green-50"
                                    >
                                      <ApperIcon name="MessageSquare" size={14} className="mr-1" />
                                      WhatsApp Help
                                    </Button>
                                  </>
                                )}
                              </div>
                              
                              {showAlternativeOptions && (
                                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                  <div className="flex items-start space-x-2">
                                    <ApperIcon name="Info" size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                                    <div className="text-xs text-yellow-800">
                                      <p className="font-medium mb-1">🚀 Alternative Upload Options</p>
                                      <p>Having trouble? Send your payment proof via email or WhatsApp. We'll process your order manually and hold your items for 1 hour while we verify.</p>
                                      <div className="mt-2 text-xs text-yellow-700">
                                        <p>✓ Email: payments@freshmart.pk</p>
                                        <p>✓ WhatsApp: +92 300 123 4567</p>
                                        <p>✓ Chat support available now</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {paymentProof && paymentProofPreview && !testUploadMode && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 upload-success">
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
                          
                          <div className="mt-3 image-preview-container">
                            <img
                              src={paymentProofPreview}
                              alt="Payment proof preview"
                              className="max-w-full h-40 object-cover rounded-lg border border-green-200 shadow-sm"
                              onError={() => toast.error('Failed to display image preview')}
                            />
                            <div className="image-preview-overlay">
                              <ApperIcon name="Eye" size={24} className="text-white" />
                            </div>
                          </div>
                          
                          <div className="mt-3 flex items-center space-x-2 text-xs text-green-700 bg-green-100 rounded-lg p-2">
                            <ApperIcon name="Info" size={14} />
                            <span>Image ready for submission. You can now place your order.</span>
                          </div>
                        </div>
                      )}

                      {testUploadMode && paymentProofPreview && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-start space-x-3 mb-3">
                            <ApperIcon name="TestTube2" size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-blue-800">
                                Test Upload Successful!
                              </p>
                              <p className="text-xs text-blue-600">
                                Your file format and size are compatible. Ready for actual upload.
                              </p>
                            </div>
                          </div>
                          
                          <div className="mt-3">
                            <img
                              src={paymentProofPreview}
                              alt="Test upload preview"
                              className="max-w-full h-32 object-cover rounded-lg border border-blue-200 shadow-sm opacity-75"
                            />
                          </div>
                          
                          <div className="mt-3 flex items-center justify-between">
                            <Button
                              type="button"
                              variant="outline"
                              size="small"
                              onClick={() => {
                                setTestUploadMode(false);
                                setPaymentProofPreview(null);
                              }}
                              className="text-gray-600 border-gray-300"
                            >
                              Close Test
                            </Button>
                            <Button
                              type="button"
                              size="small"
                              onClick={() => {
                                setTestUploadMode(false);
                                document.getElementById('payment-proof-upload').click();
                              }}
                              className="bg-blue-600 text-white"
                            >
                              Upload for Real
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <ApperIcon name="Info" size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800">
                          <p className="font-medium mb-2">Payment Instructions:</p>
                          <ul className="space-y-1 text-xs mb-3">
                            <li>• Transfer the exact amount using the account details above</li>
                            <li>• Copy the transaction ID and enter it in the field above</li>
                            <li>• Take a clear screenshot of the payment confirmation</li>
                            <li>• Upload the screenshot for verification</li>
                            <li>• Your order will be processed after payment verification</li>
                          </ul>
                          
                          <div className="flex items-center space-x-4 pt-2 border-t border-blue-200">
                            <button
                              type="button"
                              onClick={() => setShowSampleImages(true)}
                              className="text-xs text-blue-700 hover:text-blue-900 underline flex items-center space-x-1"
                            >
                              <ApperIcon name="Image" size={12} />
                              <span>View sample images</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowFAQ(true)}
                              className="text-xs text-blue-700 hover:text-blue-900 underline flex items-center space-x-1"
                            >
                              <ApperIcon name="HelpCircle" size={12} />
                              <span>Common issues</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="card p-6">
                <div className="space-y-3">
                  {/* Progress indicator */}
                  {(formData.name || formData.phone || formData.address) && (
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                        <ApperIcon name="Save" size={16} className="text-green-500" />
                        <span>Progress automatically saved</span>
                      </div>
                    </div>
                  )}
                  
                  <Button
                    type="submit"
                    disabled={loading || uploadLoading || (paymentMethod !== 'cash' && !paymentProof && !showAlternativeOptions && !orderReserved)}
                    className="w-full"
                  >
                    {loading ? 'Processing...' : `Place Order - Rs. ${total.toLocaleString()}`}
                  </Button>
                  
                  {/* Alternative submission note */}
                  {(showAlternativeOptions || orderReserved) && paymentMethod !== 'cash' && !paymentProof && (
                    <div className="text-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        {orderReserved 
                          ? `Order reserved! You can still place your order. We'll verify your payment manually within ${formatReservationTime(reservationTimer)}.`
                          : 'You can still place your order. We\'ll verify your payment manually after you send the proof via email or WhatsApp.'
                        }
                      </p>
                    </div>
                  )}

                  {/* Emergency contact options */}
                  <div className="text-center pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-600 mb-2">Need immediate help?</p>
                    <div className="flex items-center justify-center space-x-4">
                      <button
                        type="button"
                        onClick={() => handleContactSupport('chat')}
                        className="text-xs text-blue-600 hover:text-blue-800 underline flex items-center space-x-1"
                      >
                        <ApperIcon name="MessageCircle" size={12} />
                        <span>Live Chat</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleContactSupport('whatsapp')}
                        className="text-xs text-green-600 hover:text-green-800 underline flex items-center space-x-1"
                      >
                        <ApperIcon name="MessageSquare" size={12} />
                        <span>WhatsApp</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleContactSupport('email')}
                        className="text-xs text-orange-600 hover:text-orange-800 underline flex items-center space-x-1"
                      >
                        <ApperIcon name="Mail" size={12} />
                        <span>Email</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
</div>
        
        {/* Chat Widget for checkout support */}
        <ChatWidget />
      </div>
    </div>
  );
}
export default Checkout;