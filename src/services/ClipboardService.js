// Enhanced clipboard service with mobile support
export class ClipboardService {
  static async copyToClipboard(text, onSuccess = null, onError = null) {
    if (!text) {
      onError?.('No text to copy');
      return false;
    }
    
    try {
      // Modern Clipboard API with fallback
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        onSuccess?.('Copied to clipboard!');
        return true;
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        onSuccess?.('Copied to clipboard!');
        return true;
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      const errorMessage = 'Failed to copy to clipboard. Please try selecting and copying manually.';
      onError?.(errorMessage);
      return false;
    }
  }

  static isCopySupported() {
    return !!(navigator.clipboard?.writeText || document.execCommand);
  }

  static async copyWithFeedback(text, successCallback, errorCallback) {
    const success = await this.copyToClipboard(text, successCallback, errorCallback);
    return success;
  }
}

export default ClipboardService;