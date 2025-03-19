import { ethers } from 'ethers';
import { TransactionDetails } from '../types';

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
      const value = ethers.utils.parseEther(details.value);
      if (value.lte(0)) {
        errors.push('Transaction value must be greater than 0');
      }
      
      // Optional: Add maximum value check
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

export const validateContractCode = async (
  contractAddress: string,
  provider: ethers.providers.Provider
): Promise<{ isValid: boolean; error?: string }> => {
  try {
    // Get contract code
    const code = await provider.getCode(contractAddress);
    
    // Check if contract is deployed (has code)
    if (code === '0x') {
      return { isValid: false, error: 'Contract not deployed at this address' };
    }

    // Optional: Add more sophisticated contract code validation
    // For example, check for known malicious patterns
    const maliciousPatterns = [
      '0x6080604052', // Example pattern
    ];

    for (const pattern of maliciousPatterns) {
      if (code.includes(pattern)) {
        return { isValid: false, error: 'Potentially malicious contract code detected' };
      }
    }

    return { isValid: true };
  } catch (err) {
    return { isValid: false, error: 'Failed to validate contract code' };
  }
}; 