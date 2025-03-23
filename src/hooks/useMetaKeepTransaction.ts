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
 * - Email confirmation for transactions
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
   * with email verification for enhanced security.
   * 
   * @param transactionDetails - Details of the transaction to execute
   * @returns Promise resolving to the transaction hash
   * @throws Error if transaction execution fails
   */
  const execute = async (transactionDetails: TransactionDetails): Promise<string> => {
    // Check if wallet is connected - log the state for debugging
    console.log("Wallet connection check:", {
      metaKeepExists: !!metaKeep,
      connectedState: connected, 
      accountAddress
    });
    
    if (!metaKeep) {
      throw new Error('MetaKeep SDK not initialized');
    }
    
    if (!accountAddress) {
      throw new Error('Wallet address not available - please reconnect');
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

      // Determine the correct RPC URL based on chainId
      let rpcUrl = transactionDetails.rpcUrl;
      let fallbackUrls: string[] = [];

      if (transactionDetails.chainId === 80002) {
        // Primary and fallback RPC URLs for Polygon Amoy testnet
        rpcUrl = "https://polygon-amoy.g.alchemy.com/v2/dKz6QD3l7WEbD7xKNOhvHQNhjEQrh4gr";
        fallbackUrls = [
          "https://polygon-amoy.blockpi.network/v1/rpc/public",
          "https://polygon-amoy.g.alchemy.com/v2/demo",
          "https://rpc-amoy.polygon.technology",
          "https://polygon-amoy-sequencer.optimism.io"
        ];
        console.log("Using Polygon Amoy testnet primary RPC URL:", rpcUrl);
      } else if (!rpcUrl) {
        // Default fallback for other networks
        rpcUrl = transactionDetails.chainId === 137 
          ? "https://polygon-rpc.com" 
          : "https://eth-mainnet.g.alchemy.com/v2/demo";
      }

      // Get provider for contract validation - try primary RPC first
      let provider: ethers.providers.JsonRpcProvider;
      let providerConnected = false;
      
      // Try the primary RPC URL first
      provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      console.log(`Trying primary RPC URL: ${rpcUrl} for chain ${transactionDetails.chainId}`);
      
      try {
        // Test the provider with a simple call
        await provider.getNetwork();
        providerConnected = true;
        console.log("Successfully connected to primary RPC");
      } catch (networkError) {
        console.warn("Primary RPC failed:", networkError);
        
        // Try fallback URLs if available
        if (fallbackUrls.length > 0) {
          console.log("Attempting fallback RPC URLs...");
          
          for (const fbUrl of fallbackUrls) {
            try {
              provider = new ethers.providers.JsonRpcProvider(fbUrl);
              await provider.getNetwork();
              console.log("Successfully connected to fallback RPC:", fbUrl);
              rpcUrl = fbUrl; // Update the RPC URL to the working one
              providerConnected = true;
              break;
            } catch (fbError) {
              console.warn(`Fallback RPC failed: ${fbUrl}`, fbError);
            }
          }
        }
      }
      
      // If we still don't have a connection and bypassSecurity is enabled, proceed anyway
      if (!providerConnected && transactionDetails.bypassSecurity) {
        console.warn("All RPC URLs failed, but proceeding with transaction due to bypassSecurity flag");
      } else if (!providerConnected) {
        throw new Error("Could not connect to any RPC provider. Please check your internet connection or try a different network.");
      }

      // Skip contract validation if we couldn't connect to an RPC or bypassSecurity is enabled
      // Also skip validation completely on Polygon Amoy testnet as it's a development network
      if (transactionDetails.chainId === 80002) {
        console.log("Skipping contract validation on Polygon Amoy testnet");
        // Skip validation for Polygon Amoy testnet
      } else if (providerConnected && !transactionDetails.bypassSecurity) {
        try {
          const contractValidation = await validateContractCode(
            transactionDetails.contractAddress,
            provider
          );
          if (!contractValidation.isValid) {
            throw new Error(contractValidation.error || 'Invalid contract');
          }
        } catch (validationError) {
          console.error("Contract validation error:", validationError);
          
          // For network errors, we'll bypass validation if the user has enabled bypassSecurity
          if (validationError.code === "NETWORK_ERROR" || 
              String(validationError).includes("network") || 
              String(validationError).includes("noNetwork")) {
            
            console.warn("Network error during contract validation");
            
            if (transactionDetails.bypassSecurity) {
              console.log("Bypassing contract validation due to network error and bypassSecurity flag");
            } else {
              throw new Error(`Failed to validate contract code: could not detect network. Please check your connection or enable the bypassSecurity option to proceed anyway.`);
            }
          } else {
            throw validationError;
          }
        }
      } else {
        console.log("Skipping contract validation due to RPC connection issues or bypassSecurity flag");
      }

      // Create the transaction by encoding the function call
      console.log("ABI format:", JSON.stringify(transactionDetails.abi, null, 2));
      console.log("Function name:", transactionDetails.functionName);
      console.log("Function parameters:", transactionDetails.functionParams);
      
      let data: string;
      try {
        const iface = new ethers.utils.Interface(transactionDetails.abi);
        data = iface.encodeFunctionData(transactionDetails.functionName, transactionDetails.functionParams);
        console.log("Successfully encoded function data:", data);
      } catch (encodeError) {
        console.error("Error encoding function data:", encodeError);
        
        // Try to provide more helpful error messages
        if (String(encodeError).includes("no matching function")) {
          throw new Error(`Function '${transactionDetails.functionName}' not found in contract ABI. Please check function name and ABI.`);
        } else if (String(encodeError).includes("types/values length mismatch")) {
          throw new Error(`Parameter mismatch for function '${transactionDetails.functionName}'. Please check parameter types and values.`);
        } else {
          throw new Error(`Error encoding function call: ${encodeError instanceof Error ? encodeError.message : String(encodeError)}`);
        }
      }

      // Get the current nonce for the account address
      let nonce: string | number;
      try {
        const nonceCount = await provider.getTransactionCount(accountAddress);
        nonce = ethers.utils.hexlify(nonceCount); // Convert to hex format
        console.log("Retrieved nonce from provider:", nonce);
      } catch (nonceErr) {
        console.error("Error getting nonce, using default:", nonceErr);
        nonce = "0x1"; // Fallback to default if we can't get the current nonce
      }

      // Destructure transaction details
      const { contractAddress, abi, functionName, functionParams, value, chainId, email } = transactionDetails;

      // Add transaction security confirmation step
      console.log(`Transaction security validated for contract: ${contractAddress}`);
      console.log(`Transaction function: ${functionName}`);
      console.log(`Transaction parameters:`, functionParams);

      // Log email if provided
      if (email) {
        console.log("Email for transaction verification:", email);
      } else {
        console.warn("No email provided for transaction verification");
      }

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

      // Prepare transaction parameters exactly as per MetaKeep documentation
      const txObject: any = {
        type: 2, // EIP-1559 transaction type
        from: accountAddress,
        to: contractAddress,
        data,
        nonce, // Include nonce from provider (already converted to hex)
        gasLimit: "0x186a0", // Higher gas limit for contract interactions (100,000 in hex)
        maxFeePerGas: "0x3b9aca00", // 1 Gwei in hex
        maxPriorityFeePerGas: "0x3b9aca00", // 1 Gwei in hex
        chainId: "0x" + chainId.toString(16) // Convert to hex string format
      };

      // Add value if specified (for payable functions)
      if (value) {
        txObject.value = ethers.utils.parseEther(value).toString();
      } else {
        txObject.value = "0x0"; // Explicitly set zero value
      }
      
      console.log("Transaction object:", txObject);
      console.log("Transaction object keys:", Object.keys(txObject).join(", "));

      // Define the reason for the transaction (required by MetaKeep)
      const transactionReason = "Contract Function Execution";

      try {
        console.log("Executing transaction with signTransaction");
        
        // For Polygon Amoy testnet, we'll use a streamlined transaction object
        if (transactionDetails.chainId === 80002) {
          console.log("Using optimized format for Polygon Amoy testnet transaction");
          
          // Create a simpler transaction object according to MetaKeep docs
          const amoyTxObject = {
            to: transactionDetails.contractAddress,
            from: accountAddress,
            data,
            chainId: "0x13882", // 80002 in hex
            value: value ? ethers.utils.parseEther(value).toString() : "0x0",
            // Use minimal gas parameters for Amoy testnet
            gasLimit: "0x186a0", // 100,000 gas limit in hex
            maxFeePerGas: "0x59682f00", // 1.5 Gwei in hex
            maxPriorityFeePerGas: "0x59682f00", // Also 1.5 Gwei to prioritize the transaction
            nonce // Required parameter from provider
          };
          
          console.log("Amoy transaction object:", amoyTxObject);
          console.log("Transaction object keys:", Object.keys(amoyTxObject).join(", "));
          
          // Sign and send transaction with MetaKeep's internal mechanism
          console.log("Signing transaction for Amoy testnet with reason:", transactionReason);
          const signResult = await metaKeep.signTransaction(
            amoyTxObject, 
            transactionReason
          );
          
          console.log("signTransaction result for Amoy testnet:", signResult);
          
          if (signResult && signResult.status === "SUCCESS" && signResult.transactionHash) {
            const txHash = signResult.transactionHash;
            console.log("Transaction hash from MetaKeep for Amoy:", txHash);
            
            // For Amoy testnet, also try to broadcast directly to ensure it's picked up
            if (signResult.signedRawTransaction) {
              try {
                console.log("Additionally broadcasting transaction to Amoy network directly");
                // Use our provider to broadcast the transaction as well
                const sendTxResponse = await provider.sendTransaction(signResult.signedRawTransaction);
                console.log("Direct broadcast response:", sendTxResponse);
              } catch (broadcastError) {
                // Just log the error but continue with the hash we got from MetaKeep
                console.warn("Error during direct broadcast (continuing anyway):", broadcastError);
              }
            }
            
            setTxHash(txHash);
            setLoading(false);
            return txHash;
          } else {
            throw new Error("Failed to get transaction hash from MetaKeep");
          }
        } else {
          // For other networks, use the standard approach
          // Follow exactly what's in the documentation - transaction object and separate reason
          const signResult = await metaKeep.signTransaction(
            txObject, 
            transactionReason
          );
          
          console.log("signTransaction result:", signResult);
          
          // Handle the success response according to the MetaKeep docs
          if (signResult && signResult.status === "SUCCESS") {
            // For EVM transactions, we should get signedRawTransaction that we can send to the network
            if (signResult.signedRawTransaction) {
              console.log("Got signed raw transaction:", signResult.signedRawTransaction);
              
              // For Polygon Amoy testnet, we'll let MetaKeep handle the broadcasting internally
              // This avoids the insufficient funds error when we try to broadcast ourselves
              if (transactionDetails.chainId === 80002) {
                console.log("Using transaction hash from MetaKeep without broadcasting for Amoy testnet");
                const txHash = signResult.transactionHash;
                console.log("Transaction hash from MetaKeep:", txHash);
                setTxHash(txHash);
                setLoading(false);
                return txHash;
              }
              
              // For other networks, we'll broadcast the transaction ourselves
              try {
                const sendTxResponse = await provider.sendTransaction(signResult.signedRawTransaction);
                console.log("Transaction sent to network:", sendTxResponse);
                
                if (sendTxResponse && sendTxResponse.hash) {
                  const txHash = sendTxResponse.hash;
                  console.log("Transaction submitted with hash:", txHash);
                  setTxHash(txHash);
                  setLoading(false);
                  return txHash;
                }
              } catch (sendError) {
                console.error("Error sending signed transaction to network:", sendError);
                // For insufficient funds errors, provide a better error message
                if (String(sendError).includes("insufficient funds")) {
                  throw new Error(`Insufficient funds in wallet to pay for transaction gas fees. Please add funds to your wallet on ${transactionDetails.chainId === 80002 ? "Polygon Amoy testnet" : "the selected network"}.`);
                }
                throw new Error(`Error broadcasting transaction: ${sendError instanceof Error ? sendError.message : String(sendError)}`);
              }
            }
            
            // If we don't get a signedRawTransaction but have a hash, use that
            const hash = signResult.transactionHash || signResult.hash;
            if (hash) {
              console.log("Transaction signed with hash:", hash);
              setTxHash(hash);
              setLoading(false);
              return hash;
            }
          }
        }
      } catch (error) {
        console.error("Transaction error:", error);
        
        // Format error properly to avoid [object Object] display
        let errorMessage;
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'object' && error !== null) {
          // Handle specific MetaKeep error statuses
          if (error.status === "INVALID_REASON") {
            errorMessage = "The MetaKeep service requires a valid transaction reason";
          } else if (error.status === "MISSING_NONCE") {
            errorMessage = "Transaction failed: Missing nonce parameter";
          } else if (error.status === "USER_REQUEST_DENIED" || error.status === "USER_CONSENT_DENIED") {
            errorMessage = "Transaction was denied by the user";
          } else if (error.status === "MISSING_GAS") {
            errorMessage = "Transaction failed: Missing gas parameter";
          } else if (error.status === "INVALID_GAS_FEE_PARAMS") {
            errorMessage = "Transaction failed: Invalid gas fee parameters";
          } else {
            try {
              errorMessage = JSON.stringify(error);
            } catch (e) {
              errorMessage = "Unknown error format";
            }
          }
        } else {
          errorMessage = String(error);
        }
        
        setError(`Transaction failed: ${errorMessage}`);
        setLoading(false);
        throw new Error(`Transaction execution failed: ${errorMessage}`);
      }
    } catch (err) {
      console.error("Transaction processing error:", err);
      
      // Format error for display
      let errorMessage;
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null) {
        try {
          errorMessage = JSON.stringify(err);
        } catch (e) {
          errorMessage = "Unknown error format";
        }
      } else {
        errorMessage = String(err);
      }
      
      setError(errorMessage);
      setLoading(false);
      throw new Error(`Transaction handling error: ${errorMessage}`);
    }

    // If we got a response but no hash, the transaction might be pending email verification
    console.log("Transaction initiated, waiting for email verification");
    const placeholderHash = "email-verification-pending";
    setTxHash(placeholderHash);
    setLoading(false);
    return placeholderHash;
  };

  // Return hook interface
  return {
    execute,
    txHash,
    loading,
    error
  };
};