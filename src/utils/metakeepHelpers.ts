/**
 * MetaKeep Helper Utilities
 * 
 * This file contains utility functions for working with MetaKeep SDK
 * particularly focused on consent token handling.
 */

/**
 * Generates a consent token for MetaKeep authentication
 * In a production environment, this should be handled by your backend
 * to ensure secure token generation with proper user verification.
 */
export const generateConsentToken = (email?: string): string => {
  // For real applications, this should be handled by a backend service
  // This is a simplified example for demonstration purposes only
  
  // Create a simple payload with timestamp and optional email
  const payload = {
    timestamp: Date.now(),
    email: email || 'user@example.com', // Default email for testing
    nonce: Math.random().toString(36).substring(2, 15),
  };
  
  // In a real app, the backend would sign this payload with a secret key
  // and return a proper JWT or other secure token format
  return btoa(JSON.stringify(payload));
};

/**
 * Helper function to check if consent is required based on error message
 */
export const isConsentRequiredError = (error: any): boolean => {
  if (!error) return false;
  
  const errorMessage = error.message || error.toString();
  
  return (
    errorMessage.includes('consent') ||
    errorMessage.includes('Consent required') ||
    errorMessage.includes('Need consent') ||
    errorMessage.includes('consent token') ||
    errorMessage.includes('authentication required')
  );
};

/**
 * Handles consent flow for MetaKeep SDK
 * 
 * @param metaKeepSdk The MetaKeep SDK instance
 * @param email Optional email to associate with the consent
 * @returns Promise resolving to the result of the consent operation
 */
export const handleConsentFlow = async (metaKeepSdk: any, email?: string): Promise<any> => {
  if (!metaKeepSdk) {
    throw new Error('MetaKeep SDK not initialized');
  }
  
  if (typeof metaKeepSdk.getConsent !== 'function') {
    console.warn('MetaKeep SDK does not have getConsent method');
    return null;
  }
  
  try {
    // For a real implementation, the consent token would come from the backend API
    // For now, we just directly try to get the wallet without a consent token
    console.log('Attempting to get wallet directly as per docs...');
    
    // According to the docs, we should just call getWallet() directly
    try {
      // Per the docs at https://docs.metakeep.xyz/reference/v3getwallet
      // We should call getWallet directly to get a user's wallet address
      const walletResponse = await metaKeepSdk.getWallet();
      console.log('GetWallet response:', walletResponse);
      return walletResponse;
    } catch (walletErr) {
      // If wallet access requires consent, the SDK will return an error
      console.log('GetWallet failed, trying consent flow:', walletErr);
      
      // If needed, we would use a real consent token from the backend here
      // For now, we'll just rethrow to let the parent handler handle it
      throw walletErr;
    }
  } catch (error) {
    // Properly format the error to avoid [object Object]
    let errorMessage: string;
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      try {
        errorMessage = JSON.stringify(error);
      } catch {
        errorMessage = 'Unknown consent error (object)';
      }
    } else {
      errorMessage = String(error);
    }
    
    console.error('Error in wallet/consent flow:', errorMessage);
    
    // Handle specific error types according to the docs
    if (errorMessage.includes('OPERATION_CANCELLED')) {
      throw new Error('Operation was cancelled by the user.');
    } else if (errorMessage.includes('INVALID_CONSENT_TOKEN') || errorMessage.includes('INVALID_TOKEN')) {
      throw new Error('The consent token is invalid. A valid token from the backend is required.');
    } else if (errorMessage.includes('EXPIRED_TOKEN')) {
      throw new Error('The consent token has expired. Please request a new token.');
    } else if (errorMessage.includes('USER_CONSENT_DENIED') || 
               errorMessage.includes('cancelled') || 
               errorMessage.includes('denied') ||
               errorMessage.includes('rejected')) {
      throw new Error('User denied consent for MetaKeep wallet');
    }
    
    // For other errors, wrap in a proper Error object
    throw new Error(`Wallet access error: ${errorMessage}`);
  }
}; 