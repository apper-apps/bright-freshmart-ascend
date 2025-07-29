import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import ApperIcon from '@/components/ApperIcon';
import Button from '@/components/atoms/Button';
import Input from '@/components/atoms/Input';
import Loading from '@/components/ui/Loading';
import { chatService } from '@/services/api/chatService';

const ChatWidget = () => {
  const location = useLocation();
  const messagesEndRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCheckoutPage, setIsCheckoutPage] = useState(false);

  useEffect(() => {
    const isOnCheckout = location.pathname === '/checkout';
    setIsCheckoutPage(isOnCheckout);
    
    // Auto-open chat widget on checkout page if there's an upload error
    if (isOnCheckout && localStorage.getItem('checkout-upload-error')) {
      setIsOpen(true);
      localStorage.removeItem('checkout-upload-error');
    }
  }, [location.pathname]);

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const data = await chatService.getConversations();
      setConversations(data);
      
      // Auto-select first conversation or create new one
      if (data.length > 0) {
        setActiveConversation(data[0]);
        loadMessages(data[0].Id);
      } else {
        // Create new conversation if none exists
        const newConv = await chatService.createConversation({
          title: 'Order Support',
          orderContext: getOrderContext()
        });
        setConversations([newConv]);
        setActiveConversation(newConv);
        setMessages([]);
      }
    } catch (error) {
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      setMessagesLoading(true);
      const data = await chatService.getMessages(conversationId);
      setMessages(data);
    } catch (error) {
      toast.error('Failed to load messages');
    } finally {
      setMessagesLoading(false);
    }
  };

  const getOrderContext = () => {
    // Extract order context from current route
    const path = location.pathname;
    if (path.includes('/orders/')) {
      const orderId = path.split('/orders/')[1];
      return orderId ? { orderId: parseInt(orderId) } : null;
    }
    return null;
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversation || isSending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    try {
      const message = await chatService.createMessage(activeConversation.Id, {
        text: messageText,
        sender: 'customer',
        orderContext: getOrderContext()
      });

      setMessages(prev => [...prev, message]);
      toast.success('Message sent successfully');

      // Simulate admin response after delay
      setTimeout(async () => {
        try {
          const adminResponse = await chatService.createMessage(activeConversation.Id, {
            text: generateAdminResponse(messageText),
            sender: 'admin'
          });
          setMessages(prev => [...prev, adminResponse]);
        } catch (error) {
          console.error('Failed to send admin response:', error);
        }
      }, 2000);

    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const generateAdminResponse = (customerMessage) => {
    const responses = [
      "Thank you for reaching out! I'll help you with your order inquiry.",
      "I understand your concern. Let me check your order details right away.",
      "Thanks for contacting us. I'll get back to you with an update shortly.",
      "I appreciate your patience. Let me look into this for you.",
      "Thank you for your message. I'll ensure this gets resolved quickly."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

const toggleChat = () => {
    setIsOpen(!isOpen);
    
    // Track chat opening on checkout page
    if (!isOpen && isCheckoutPage) {
      toast.info('Customer support is here to help with your checkout!');
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Chat Button */}
      <button
        onClick={toggleChat}
        className={`
          w-14 h-14 bg-gradient-to-r from-primary to-accent rounded-full shadow-lg
          flex items-center justify-center text-white hover:shadow-xl
          transform transition-all duration-300 hover:scale-110
          ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}
        `}
      >
        <ApperIcon name="MessageCircle" size={24} />
      </button>

      {/* Chat Widget */}
<div className={`
        absolute bottom-0 right-0 w-80 h-96 bg-white rounded-lg shadow-2xl
        transform transition-all duration-300 origin-bottom-right
        ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}
        sm:w-96 sm:h-[500px]
        ${isCheckoutPage ? 'border-2 border-blue-200' : ''}
      `}>
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-accent text-white p-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <ApperIcon name="Headphones" size={16} />
              </div>
              <div>
                <h3 className="font-semibold">Customer Support</h3>
                <p className="text-xs opacity-90">We're here to help</p>
              </div>
            </div>
            <button
              onClick={toggleChat}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors"
            >
              <ApperIcon name="X" size={20} />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 h-64 sm:h-80 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <Loading type="default" />
            </div>
          ) : messagesLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loading type="default" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <ApperIcon name="MessageCircle" size={48} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Start a conversation with our support team</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.Id}
                className={`flex ${message.sender === 'customer' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`
                  max-w-xs px-3 py-2 rounded-lg text-sm
                  ${message.sender === 'customer' 
                    ? 'bg-gradient-to-r from-primary to-accent text-white' 
                    : 'bg-gray-100 text-gray-900'
                  }
                `}>
                  <p>{message.text}</p>
                  <p className={`text-xs mt-1 ${
                    message.sender === 'customer' ? 'text-white text-opacity-70' : 'text-gray-500'
                  }`}>
                    {format(new Date(message.createdAt), 'HH:mm')}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-200">
          <form onSubmit={handleSendMessage} className="flex space-x-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 text-sm"
              disabled={isSending}
            />
            <Button
              type="submit"
              disabled={!newMessage.trim() || isSending}
              className="p-2 bg-gradient-to-r from-primary to-accent text-white rounded-lg hover:shadow-lg disabled:opacity-50"
            >
              {isSending ? (
                <ApperIcon name="Loader2" size={16} className="animate-spin" />
              ) : (
                <ApperIcon name="Send" size={16} />
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatWidget;