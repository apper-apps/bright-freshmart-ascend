import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  ShoppingCart, 
  CreditCard, 
  MapPin, 
  User, 
  Phone, 
  Mail,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Shield,
  Clock
} from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import PaymentMethod from '@/components/molecules/PaymentMethod';
import { ChatWidget } from '@/components/molecules/ChatWidget';
import { clearCart } from '@/store/cartSlice';
import { orderService } from '@/services/api/orderService';
import { paymentService } from '@/services/api/paymentService';
import { formatCurrency } from '@/utils/currency';

const Checkout = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  // Redux state
  const { items: cartItems, total: cartTotal } = useSelector(state => state.cart);
  
  // Local state
  const [loading, setLoading] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    // Customer Information
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    
    // Delivery Information
    address: '',
    city: '',
    postalCode: '',
    deliveryNotes: '',
    
    // Payment Information
    paymentMethod: 'card',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    nameOnCard: ''
  });
  
  const [formErrors, setFormErrors] = useState({});
  const [paymentProof, setPaymentProof] = useState(null);
  const [reservationTimer, setReservationTimer] = useState(15 * 60); // 15 minutes

  // Effects
  useEffect(() => {
    // Redirect if cart is empty
    if (!cartItems || cartItems.length === 0) {
      toast.error('Your cart is empty');
      navigate('/cart');
      return;
    }

    // Start reservation timer
    const timer = setInterval(() => {
      setReservationTimer(prev => {
        if (prev <= 1) {
          toast.error('Reservation expired. Please restart checkout.');
          navigate('/cart');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cartItems, navigate]);

  // Helper functions
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const validateForm = () => {
    const errors = {};

    // Customer information validation
    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email is invalid';
    }
    if (!formData.phone.trim()) {
      errors.phone = 'Phone number is required';
    }

    // Delivery information validation
    if (!formData.address.trim()) {
      errors.address = 'Address is required';
    }
    if (!formData.city.trim()) {
      errors.city = 'City is required';
    }
    if (!formData.postalCode.trim()) {
      errors.postalCode = 'Postal code is required';
    }

    // Payment validation (if card payment)
    if (formData.paymentMethod === 'card') {
      if (!formData.cardNumber.trim()) {
        errors.cardNumber = 'Card number is required';
      }
      if (!formData.expiryDate.trim()) {
        errors.expiryDate = 'Expiry date is required';
      }
      if (!formData.cvv.trim()) {
        errors.cvv = 'CVV is required';
      }
      if (!formData.nameOnCard.trim()) {
        errors.nameOnCard = 'Name on card is required';
      }
    }

    // Payment proof validation (if bank transfer)
    if (formData.paymentMethod === 'bank_transfer' && !paymentProof) {
      errors.paymentProof = 'Payment proof is required for bank transfer';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handlePaymentMethodChange = (method) => {
    setFormData(prev => ({
      ...prev,
      paymentMethod: method
    }));
  };

  const handlePaymentProofUpload = async (file) => {
    try {
      setLoading(true);
      
      // Validate file
      if (!file) {
        throw new Error('Please select a file');
      }

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new Error('File size must be less than 5MB');
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Only JPEG and PNG files are allowed');
      }

      // Upload file
      const uploadResult = await paymentService.uploadPaymentProof(file);
      setPaymentProof(uploadResult);
      
      toast.success('Payment proof uploaded successfully');
      
      // Clear error if exists
      if (formErrors.paymentProof) {
        setFormErrors(prev => ({
          ...prev,
          paymentProof: ''
        }));
      }
    } catch (error) {
      console.error('Payment proof upload error:', error);
      toast.error(error.message || 'Failed to upload payment proof');
    } finally {
      setLoading(false);
    }
  };

  const processPayment = async (orderData) => {
    try {
      let paymentResult = null;

      switch (formData.paymentMethod) {
        case 'card':
          paymentResult = await paymentService.processCardPayment({
            amount: cartTotal,
            cardNumber: formData.cardNumber,
            expiryDate: formData.expiryDate,
            cvv: formData.cvv,
            nameOnCard: formData.nameOnCard,
            orderId: orderData.id
          });
          break;

        case 'bank_transfer':
          paymentResult = await paymentService.processBankTransfer({
            amount: cartTotal,
            paymentProof: paymentProof,
            orderId: orderData.id
          });
          break;

        case 'cash_on_delivery':
          paymentResult = await paymentService.processCashOnDelivery({
            amount: cartTotal,
            orderId: orderData.id
          });
          break;

        default:
          throw new Error('Invalid payment method');
      }

      return paymentResult;
    } catch (error) {
      console.error('Payment processing error:', error);
      throw error;
    }
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();

    try {
      // Validate form
      if (!validateForm()) {
        toast.error('Please fix the errors in the form');
        return;
      }

      setOrderSubmitting(true);

      // Prepare order data
      const orderData = {
        items: cartItems,
        customer: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone
        },
        delivery: {
          address: formData.address,
          city: formData.city,
          postalCode: formData.postalCode,
          notes: formData.deliveryNotes
        },
        payment: {
          method: formData.paymentMethod,
          amount: cartTotal
        },
        status: 'pending'
      };

      // Create order
      const createdOrder = await orderService.createOrder(orderData);

      // Process payment
      const paymentResult = await processPayment(createdOrder);

      // Update order with payment info
      await orderService.updateOrder(createdOrder.id, {
        payment: {
          ...orderData.payment,
          status: paymentResult.status,
          transactionId: paymentResult.transactionId
        }
      });

      // Clear cart
      dispatch(clearCart());

      // Show success message
      toast.success('Order placed successfully!');

      // Redirect to order confirmation
      navigate(`/order-summary/${createdOrder.id}`, {
        state: { 
          order: createdOrder,
          payment: paymentResult
        }
      });

    } catch (error) {
      console.error('Order submission error:', error);
      
      let errorMessage = 'Failed to place order';
      
      if (error.response?.status === 400) {
        errorMessage = error.response.data?.message || 'Invalid order data';
      } else if (error.response?.status === 402) {
        errorMessage = 'Payment failed. Please check your payment information';
      } else if (error.response?.status === 409) {
        errorMessage = 'Some items are no longer available';
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    } finally {
      setOrderSubmitting(false);
    }
  };

  const calculateTotals = () => {
    const subtotal = cartTotal;
    const deliveryFee = subtotal > 50 ? 0 : 5.99;
    const tax = subtotal * 0.1; // 10% tax
    const total = subtotal + deliveryFee + tax;

    return {
      subtotal,
      deliveryFee,
      tax,
      total
    };
  };

  const totals = calculateTotals();

  if (!cartItems || cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <ShoppingCart className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-2xl font-semibold text-gray-600 mb-2">Cart is Empty</h2>
          <p className="text-gray-500 mb-4">Add some items to your cart to checkout</p>
          <Button onClick={() => navigate('/')} className="btn-primary">
            Continue Shopping
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => navigate('/cart')}
              variant="ghost"
              className="p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-3xl font-bold gradient-text">Checkout</h1>
          </div>
          
          {/* Reservation Timer */}
          <div className="flex items-center space-x-2 bg-orange-50 px-4 py-2 rounded-lg reservation-timer">
            <Clock className="w-5 h-5 text-orange-600" />
            <span className="text-orange-600 font-medium">
              Reserve expires in: {formatTime(reservationTimer)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmitOrder} className="space-y-8">
              {/* Customer Information */}
              <div className="card p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <User className="w-6 h-6 text-primary" />
                  <h2 className="text-xl font-semibold">Customer Information</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Input
                      label="First Name"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      error={formErrors.firstName}
                      required
                    />
                  </div>
                  <div>
                    <Input
                      label="Last Name"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      error={formErrors.lastName}
                      required
                    />
                  </div>
                  <div>
                    <Input
                      label="Email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      error={formErrors.email}
                      required
                    />
                  </div>
                  <div>
                    <Input
                      label="Phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleInputChange}
                      error={formErrors.phone}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Information */}
              <div className="card p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <MapPin className="w-6 h-6 text-primary" />
                  <h2 className="text-xl font-semibold">Delivery Information</h2>
                </div>

                <div className="space-y-4">
                  <Input
                    label="Address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    error={formErrors.address}
                    required
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="City"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      error={formErrors.city}
                      required
                    />
                    <Input
                      label="Postal Code"
                      name="postalCode"
                      value={formData.postalCode}
                      onChange={handleInputChange}
                      error={formErrors.postalCode}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Delivery Notes (Optional)
                    </label>
                    <textarea
                      name="deliveryNotes"
                      value={formData.deliveryNotes}
                      onChange={handleInputChange}
                      rows={3}
                      className="input-field resize-none"
                      placeholder="Any special delivery instructions..."
                    />
                  </div>
                </div>
              </div>

              {/* Payment Information */}
              <div className="card p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <CreditCard className="w-6 h-6 text-primary" />
                  <h2 className="text-xl font-semibold">Payment Information</h2>
                </div>

                <PaymentMethod
                  selectedMethod={formData.paymentMethod}
                  onMethodChange={handlePaymentMethodChange}
                  onPaymentProofUpload={handlePaymentProofUpload}
                  paymentProof={paymentProof}
                  loading={loading}
                  errors={formErrors}
                />

                {/* Card Payment Form */}
                {formData.paymentMethod === 'card' && (
                  <div className="mt-6 space-y-4">
                    <Input
                      label="Card Number"
                      name="cardNumber"
                      value={formData.cardNumber}
                      onChange={handleInputChange}
                      error={formErrors.cardNumber}
                      placeholder="1234 5678 9012 3456"
                      required
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Expiry Date"
                        name="expiryDate"
                        value={formData.expiryDate}
                        onChange={handleInputChange}
                        error={formErrors.expiryDate}
                        placeholder="MM/YY"
                        required
                      />
                      <Input
                        label="CVV"
                        name="cvv"
                        value={formData.cvv}
                        onChange={handleInputChange}
                        error={formErrors.cvv}
                        placeholder="123"
                        required
                      />
                    </div>

                    <Input
                      label="Name on Card"
                      name="nameOnCard"
                      value={formData.nameOnCard}
                      onChange={handleInputChange}
                      error={formErrors.nameOnCard}
                      required
                    />
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="card p-6 sticky top-6">
              <h2 className="text-xl font-semibold mb-6">Order Summary</h2>

              {/* Items */}
              <div className="space-y-4 mb-6">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center space-x-3">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-12 h-12 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <h3 className="font-medium text-sm">{item.name}</h3>
                      <p className="text-gray-600 text-xs">Qty: {item.quantity}</p>
                    </div>
                    <span className="font-medium text-sm">
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Delivery Fee</span>
                  <span>
                    {totals.deliveryFee === 0 ? (
                      <span className="text-green-600">FREE</span>
                    ) : (
                      formatCurrency(totals.deliveryFee)
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax</span>
                  <span>{formatCurrency(totals.tax)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>

              {/* Security Notice */}
              <div className="mt-6 p-4 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-green-700 font-medium">
                    Secure Checkout
                  </span>
                </div>
                <p className="text-xs text-green-600 mt-1">
                  Your payment information is encrypted and secure
                </p>
              </div>

              {/* Place Order Button */}
              <Button
                type="submit"
                form="checkout-form"
                onClick={handleSubmitOrder}
                disabled={orderSubmitting || loading}
                className="w-full mt-6 btn-primary"
                size="lg"
              >
                {orderSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Processing Order...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Place Order - {formatCurrency(totals.total)}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Customer Support */}
        <div className="mt-8">
          <ChatWidget 
            className="chat-widget-checkout"
            position="inline"
            title="Need help with checkout?"
            subtitle="Our support team is here to assist you"
          />
        </div>
      </div>
    </div>
  );
};

export default Checkout;