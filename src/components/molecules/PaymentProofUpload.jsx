import React, { useState, useCallback } from 'react';
import ApperIcon from '@/components/ApperIcon';
import { toast } from 'react-hot-toast';
import { withUploadErrorHandling } from '@/utils/errorHandling';

const PaymentProofUpload = ({ 
  onUpload, 
  preview, 
  error, 
  loading = false,
  accept = "image/*",
  maxSize = 5 * 1024 * 1024 // 5MB
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const processFile = useCallback(withUploadErrorHandling(async (file) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Unsupported format - please use JPG/PNG');
    }

    // Validate file size
    if (file.size > maxSize) {
      throw new Error(`File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`);
    }

    setUploading(true);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      onUpload(file, e.target.result);
      setUploading(false);
    };
    reader.onerror = () => {
      throw new Error('Failed to read file');
    };
    reader.readAsDataURL(file);
  }, 'Payment proof upload'), [maxSize, onUpload]);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  return (
    <div className="space-y-4">
      <div
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200
          ${dragOver ? 'border-primary bg-primary/5 scale-102' : 'border-gray-300'}
          ${error ? 'border-red-300 bg-red-50' : ''}
          ${loading || uploading ? 'opacity-50 pointer-events-none' : 'hover:border-primary hover:bg-primary/5'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
          id="payment-proof-upload"
          disabled={loading || uploading}
        />
        
        <label htmlFor="payment-proof-upload" className="cursor-pointer block">
          <div className="space-y-2">
            <ApperIcon 
              name={uploading ? "Loader2" : "Upload"} 
              size={32} 
              className={`mx-auto text-gray-400 ${uploading ? 'animate-spin' : ''}`} 
            />
            <div>
              <p className="text-sm font-medium text-gray-700">
                {uploading ? 'Processing...' : 'Upload payment screenshot'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                JPG, PNG, HEIC up to {Math.round(maxSize / 1024 / 1024)}MB
              </p>
            </div>
          </div>
        </label>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <ApperIcon name="AlertCircle" size={16} className="text-red-500 mt-0.5" />
            <div className="text-sm">
              <p className="text-red-700 font-medium">{error}</p>
              <p className="text-red-600 text-xs mt-1">
                Having trouble? Contact support@freshmart.pk
              </p>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="relative">
          <img
            src={preview}
            alt="Payment proof preview"
            className="max-w-full h-48 object-contain rounded-lg border bg-gray-50"
          />
          <div className="mt-2 flex items-center justify-between text-sm text-gray-600">
            <span className="flex items-center">
              <ApperIcon name="CheckCircle" size={16} className="text-green-500 mr-1" />
              Payment proof uploaded
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentProofUpload;