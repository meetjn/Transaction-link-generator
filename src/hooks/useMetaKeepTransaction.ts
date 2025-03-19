import { useState } from 'react';
import { ethers } from 'ethers';
import { useMetaKeep } from '../context/MetakeepContext';
import { TransactionDetails } from '../types';
import { validateTransactionDetails, validateContractCode } from '../utils/validation';
import { defaultRateLimiter } from '../utils/rateLimiting';

/**
 * Interface defining the return value of the useMetaKeepTransaction hook
 * 
 * @property execute - Function to execute a transaction with the MetaKeep wallet
 * @property txHash - The transaction hash after successful execution
 * @property loading - Loading state during transaction execution
 * @property error - Error message if transaction execution fails
 */
interface UseMetaKeepTransactionResult {
  execute: (transactionDetails: TransactionDetails) => Promise<string>;
  txHash: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook for executing transactions with the MetaKeep wallet
 * 
 * This hook handles:
 * - Transaction validation
 * - Contract validation
 * - Chain switching
 * - Transaction encoding
 * - Transaction signing and submission
 * - Error handling
 * - Rate limiting
 * 
 * @returns Object with execute function, transaction hash, loading state, and error
 */
export const useMetaKeepTransaction = (): UseMetaKeepTransactionResult => {
  // Get MetaKeep context values
  const { metaKeep, connected, accountAddress } = useMetaKeep();
  
  // Transaction state
  const [txHash, setTxHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Execute a transaction using the MetaKeep wallet
   * 
   * Handles the entire transaction flow from validation to signing,
   * with fallback methods to handle different MetaKeep SDK versions.
   * 
   * @param transactionDetails - Details of the transaction to execute
   * @returns Promise resolving to the transaction hash
   * @throws Error if transaction execution fails
   */
  const execute = async (transactionDetails: TransactionDetails): Promise<string> => {
    // Check if wallet is connected
    if (!metaKeep || !connected || !accountAddress) {
      throw new Error('Wallet not connected');
    }

    // Check rate limit before executing transaction
    if (!defaultRateLimiter.checkRateLimit()) {
      throw new Error(`Rate limit exceeded. Maximum 10 transactions per minute allowed.`);
    }

    // Update state for transaction execution
    setLoading(true);
    setError(null);
    setTxHash(null);

    try {
      // Validate transaction details
      const validation = validateTransactionDetails(transactionDetails);
      if (!validation.isValid) {
        throw new Error(`Invalid transaction: ${validation.errors.join(', ')}`);
      }

      // Get provider for contract validation
      const provider = new ethers.providers.JsonRpcProvider(
        transactionDetails.rpcUrl || 'https://polygon-rpc.com'
      );

      // Validate contract code to ensure it exists and is deployed
      const contractValidation = await validateContractCode(
        transactionDetails.contractAddress,
        provider
      );
      if (!contractValidation.isValid) {
        throw new Error(contractValidation.error || 'Invalid contract');
      }

      // Destructure transaction details
      const { contractAddress, abi, functionName, functionParams, value, chainId } = transactionDetails;

      // Make sure we're on the right chain
      let currentChainId;
      try {
        // Get current chain ID using multiple fallback methods
        currentChainId = typeof metaKeep.chainId === 'number'
          ? metaKeep.chainId
          : (await (metaKeep as any).getChainId?.()) || chainId;

        console.log("Current chain ID:", currentChainId, "Target chain ID:", chainId);

        // Switch chain if needed and if the wallet supports it
        if (currentChainId !== chainId && typeof (metaKeep as any).switchChain === 'function') {
          console.log("Switching chain to:", chainId);
          await (metaKeep as any).switchChain(chainId);
        }
      } catch (chainErr) {
        console.error("Error with chain operations:", chainErr);
        // Continue anyway - some SDKs might not support chain operations
      }

      // Create the transaction by encoding the function call
      const iface = new ethers.utils.Interface(abi);
      const data = iface.encodeFunctionData(functionName, functionParams);
      console.log("Encoded function data:", data);

      // Prepare transaction parameters
      const txParams: any = {
        to: contractAddress,
        data,
        from: accountAddress,
      };

      // Add value if specified (for payable functions)
      if (value) {
        txParams.value = ethers.utils.parseEther(value);
      }

      console.log("Transaction params:", txParams);

      // Try all possible transaction signing methods in sequence
      // This ensures compatibility with different MetaKeep SDK versions
      let hash;
      const errors: any[] = [];

      // Method 1: Object form with transactionObject (newer SDK versions)
      try {
        console.log("Trying object form with transactionObject");
        const result = await (metaKeep as any).signTransaction({
          transactionObject: txParams,
          reason: "Execute smart contract transaction"
        });

        console.log("Sign transaction result (object form):", result);
        hash = result?.transactionHash || result?.hash || (typeof result === 'string' ? result : null);
        if (hash) return hash;
      } catch (err1) {
        console.error("Error with object form:", err1);
        errors.push(err1);
      }

      // Method 2: Direct call with two parameters (older SDK versions)
      try {
        console.log("Trying direct call with two parameters");
        const result = await (metaKeep as any).signTransaction(txParams, accountAddress);
        console.log("Sign transaction result (direct call):", result);
        hash = typeof result === 'string' ? result : result?.transactionHash || result?.hash;
        if (hash) return hash;
      } catch (err2) {
        console.error("Error with direct call:", err2);
        errors.push(err2);
      }

      // Method 3: Try sendTransaction (alternative method in some SDK versions)
      try {
        console.log("Trying sendTransaction method");
        const result = await (metaKeep as any).sendTransaction(txParams);
        console.log("Send transaction result:", result);
        hash = typeof result === 'string' ? result : result?.transactionHash || result?.hash;
        if (hash) return hash;
      } catch (err3) {
        console.error("Error with sendTransaction:", err3);
        errors.push(err3);
      }

      // If we got here, all methods failed
      throw new Error(`All transaction methods failed: ${errors.map(e => e.message || String(e)).join('; ')}`);
    }
    catch (err) {
      console.error('Transaction execution error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error executing transaction';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Return hook interface
  return {
    execute,
    txHash,
    loading,
    error
  };
};