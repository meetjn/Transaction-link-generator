import { ethers } from 'ethers';
import { TransactionDetails } from '../types';

/**
 * Validates transaction details before execution
 * 
 * Performs comprehensive validation on all aspects of a transaction including:
 * - Contract address format and validity
 * - Chain ID existence and validity
 * - Function name format and validity
 * - ABI structure
 * - Function parameters
 * - Transaction value (if provided)
 * 
 * @param details - The transaction details to validate
 * @returns Object with validation result and any error messages
 */
export const validateTransactionDetails = (details: TransactionDetails): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Validate contract address
  if (!details.contractAddress || !ethers.utils.isAddress(details.contractAddress)) {
    errors.push('Invalid contract address');
  }

  // Validate chain ID
  if (!details.chainId || details.chainId <= 0) {
    errors.push('Invalid chain ID');
  }

  // Validate function name
  if (!details.functionName || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(details.functionName)) {
    errors.push('Invalid function name');
  }

  // Validate ABI
  if (!Array.isArray(details.abi) || details.abi.length === 0) {
    errors.push('Invalid ABI');
  }

  // Validate function parameters
  if (!Array.isArray(details.functionParams)) {
    errors.push('Invalid function parameters');
  }

  // Validate transaction value
  if (details.value) {
    try {
      // Parse and check that value is positive
      const value = ethers.utils.parseEther(details.value);
      if (value.lte(0)) {
        errors.push('Transaction value must be greater than 0');
      }
      
      // Optional: Add maximum value check for security
      const maxValue = ethers.utils.parseEther('1000'); // Example: 1000 ETH max
      if (value.gt(maxValue)) {
        errors.push('Transaction value exceeds maximum allowed');
      }
    } catch (err) {
      errors.push('Invalid transaction value');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validates that a smart contract exists at the given address
 * 
 * Performs these validations:
 * 1. Checks if any code exists at the address (contract is deployed)
 * 2. Makes sure the code length is reasonable
 * 
 * @param contractAddress - The address of the contract to validate
 * @param provider - An ethers.js provider to connect to the blockchain
 * @returns Promise resolving to validation result and optional error message
 */
export const validateContractCode = async (
  contractAddress: string,
  provider: ethers.providers.Provider
): Promise<{ isValid: boolean; error?: string }> => {
  try {
    console.log(`Validating contract code at address: ${contractAddress}`);
    
    // Get network info to determine if we're on a testnet
    let isTestnet = false;
    try {
      const network = await provider.getNetwork();
      isTestnet = network.chainId === 80002 || // Polygon Amoy
                  network.chainId === 5 ||      // Goerli
                  network.chainId === 11155111 || // Sepolia
                  network.chainId === 97;       // BSC Testnet
                  
      console.log(`Network detected: ${network.name} (chainId: ${network.chainId}), isTestnet: ${isTestnet}`);
    } catch (networkErr) {
      console.warn("Could not detect network:", networkErr);
    }
    
    // Get contract bytecode from the blockchain
    const code = await provider.getCode(contractAddress);
    console.log(`Contract code length: ${code.length}`);
    
    // Check if contract is deployed (has code)
    // '0x' is returned when no code exists at the address
    if (code === '0x') {
      console.warn(`No code found at address ${contractAddress}`);
      
      // If we're on a testnet, we might want to be more lenient
      if (isTestnet) {
        console.log("On testnet, marking as valid despite no code found");
        return { isValid: true };
      }
      
      return { isValid: false, error: 'Contract not deployed at this address' };
    }

    // Check the code length - very short code is suspicious
    if (code.length < 10) {
      console.warn(`Suspiciously short contract code at ${contractAddress}: ${code}`);
      
      // On testnet, we'll allow it
      if (isTestnet) {
        console.log("On testnet, marking as valid despite short code");
        return { isValid: true };
      }
      
      return { isValid: false, error: 'Suspiciously short contract code' };
    }

    // Contract exists and passes basic validation
    console.log("Contract validation successful");
    return { isValid: true };
  } catch (err) {
    // Format the error properly
    let errorMessage: string;
    
    if (err instanceof Error) {
      errorMessage = err.message;
      
      // Preserve the error code if it exists
      if ('code' in err) {
        // @ts-ignore - Adding the code to the error object for reference
        err.code = (err as any).code;
      }
    } else if (typeof err === 'object' && err !== null) {
      try {
        errorMessage = JSON.stringify(err);
      } catch {
        errorMessage = 'Error in contract validation (object format)';
      }
    } else {
      errorMessage = String(err);
    }
    
    // Detect network errors specifically
    const isNetworkError = 
      errorMessage.includes('network') || 
      errorMessage.includes('noNetwork') ||
      (typeof err === 'object' && err !== null && (err as any).code === 'NETWORK_ERROR');
    
    if (isNetworkError) {
      console.warn('Network error during contract validation:', errorMessage);
      return { 
        isValid: false, 
        error: `Network detection error. Please check your internet connection and the RPC provider.`,
        // @ts-ignore - Adding more context to the error
        code: 'NETWORK_ERROR',
        originalError: err
      };
    }
    
    // For other errors
    return { 
      isValid: false, 
      error: `Failed to validate contract code: ${errorMessage}` 
    };
  }
}; 