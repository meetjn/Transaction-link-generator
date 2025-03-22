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
    // Get contract bytecode from the blockchain
    const code = await provider.getCode(contractAddress);
    
    // Check if contract is deployed (has code)
    // '0x' is returned when no code exists at the address
    if (code === '0x') {
      return { isValid: false, error: 'Contract not deployed at this address' };
    }

    // Check the code length - very short code is suspicious
    if (code.length < 10) {
      return { isValid: false, error: 'Suspiciously short contract code' };
    }

    // Contract exists and passes basic validation
    return { isValid: true };
  } catch (err) {
    // Network error or other issue accessing the blockchain
    console.error("Error validating contract code:", err);
    return { isValid: false, error: `Failed to validate contract code: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}; 