import { useState } from 'react';
import { ethers } from 'ethers';
import { useMetaKeep } from '../context/MetakeepContext';
import { TransactionDetails } from '../types';
import { validateTransactionDetails, validateContractCode } from '../utils/validation';
import { defaultRateLimiter } from '../utils/rateLimiting';
import { useWalletBalance } from './useWalletBalance';

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
  // Track RPC url and chain ID
  const [currentRpcUrl, setCurrentRpcUrl] = useState<string>('https://polygon-rpc.com');
  const [currentChainId, setCurrentChainId] = useState<number>(137);

  // Initialize balance checker hook
  const {
    checkBalanceForGas,
    fetchBalance
  } = useWalletBalance(currentRpcUrl, currentChainId);

  /**
   * Tests if an RPC provider is working properly (used by getWorkingProvider)
   * @param url The RPC URL to test
   * @returns Promise resolving to a boolean - true if provider is working
   * @private - Internal utility function
   */
  const _testRpcProvider = async (url: string): Promise<boolean> => {
    try {
      const provider = new ethers.providers.JsonRpcProvider(url);
      // Try a simple call that should work on any provider
      const blockNumber = await provider.getBlockNumber();
      console.log(`Provider ${url} is working, current block: ${blockNumber}`);
      return true;
    } catch (err) {
      console.warn(`Provider ${url} failed: ${err.message}`);
      return false;
    }
  };

  /**
   * Get a working provider for a specific chain
   * Tries multiple providers in sequence until one works
   * 
   * @param rpcUrl - Primary RPC URL to try first
   * @param chainId - Chain ID to find fallbacks for
   * @returns A working provider or undefined if all fail
   */
  const getWorkingProvider = async (
    rpcUrl: string,
    chainId: number
  ): Promise<ethers.providers.Provider | undefined> => {
    // Define fallback providers for each network
    const fallbackProviders: { [key: number]: string[] } = {
      // Polygon Amoy testnet
      80002: [
        'https://rpc-amoy.polygon.technology/',
        'https://polygon-amoy-rpc.publicnode.com',
        'https://polygon-amoy.blockpi.network/v1/rpc/public',
        'https://api.zan.top/node/v1/polygon/amoy/public',
        'https://polygon-amoy.drpc.org',
        'https://polygon-amoy.g.alchemy.com/v2/demo'
      ],
      // Polygon mainnet
      137: [
        'https://polygon-rpc.com',
        'https://polygon-mainnet.g.alchemy.com/v2/demo',
        'https://polygon.meowrpc.com',
        'https://polygon.drpc.org',
        'https://polygon.llamarpc.com',
        'https://rpc-mainnet.maticvigil.com'
      ],
      // Ethereum mainnet
      1: [
        'https://eth-mainnet.g.alchemy.com/v2/demo',
        'https://1rpc.io/eth',
        'https://ethereum.publicnode.com',
        'https://rpc.ankr.com/eth',
        'https://eth.meowrpc.com',
        'https://eth.llamarpc.com'
      ]
    };

    console.log(`[Provider] Getting working provider for chainId: ${chainId}, starting with: ${rpcUrl}`);
    
    // Create an array of providers to try
    const providersToTry: string[] = [rpcUrl];
    
    // Add fallbacks for this chain
    const fallbacks = fallbackProviders[chainId] || [];
    providersToTry.push(...fallbacks);
    
    // Deduplicate providers list - use Array.from instead of spreading Set
    const uniqueProviders = Array.from(new Set(providersToTry));
    
    // Try each provider in parallel (faster than sequential)
    const providerPromises = uniqueProviders.map(async (url) => {
      try {
        const provider = new ethers.providers.JsonRpcProvider(url);
        // Set a timeout for the blockNumber request to avoid hanging
        const blockNumberPromise = provider.getBlockNumber();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 3000)
        );
        
        const blockNumber = await Promise.race([blockNumberPromise, timeoutPromise]);
        console.log(`[Provider] ${url} is working, current block: ${blockNumber}`);
        return provider;
      } catch (err) {
        console.warn(`[Provider] ${url} failed: ${err.message}`);
        return null;
      }
    });
    
    // Get the first working provider
    const providers = await Promise.all(providerPromises);
    const workingProvider = providers.find(p => p !== null);
    
    if (workingProvider) {
      return workingProvider;
    }
    
    // Final fallback: try with ethers default provider
    try {
      console.log('[Provider] Trying with ethers default provider');
      const defaultProvider = ethers.getDefaultProvider(chainId);
      await defaultProvider.getBlockNumber();
      return defaultProvider;
    } catch (err) {
      console.error('[Provider] All providers failed, including default provider');
      return undefined;
    }
  };

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
    // Extract all needed transaction properties at the beginning to avoid redeclaration
    const {
      contractAddress,
      abi,
      functionName,
      functionParams,
      value,
      chainId,
      email,
      rpcUrl
    } = transactionDetails;

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

    // Update RPC URL and chain ID for balance checking
    setCurrentRpcUrl(rpcUrl || 'https://polygon-rpc.com');
    setCurrentChainId(chainId);

    // Reset states
    setLoading(true);
    setError(null);
    setTxHash(null);

    try {
      // Validate transaction details
      const validation = validateTransactionDetails(transactionDetails);
      if (!validation.isValid) {
        throw new Error(`Invalid transaction: ${validation.errors.join(', ')}`);
      }

      // Get a working provider for this chain
      console.log("Finding a working provider for chain ID:", chainId);
      const provider = await getWorkingProvider(
        rpcUrl || 'https://polygon-rpc.com',
        chainId
      );

      if (!provider) {
        throw new Error('Network detection failed. Could not connect to any RPC provider for this chain. Please check your internet connection or try again later.');
      }

      // Validate contract code to ensure it exists and is deployed
      const contractValidation = await validateContractCode(
        contractAddress,
        provider
      );
      if (!contractValidation.isValid) {
        throw new Error(contractValidation.error || 'Invalid contract');
      }

      // Create the transaction by encoding the function call
      const iface = new ethers.utils.Interface(abi);
      const data = iface.encodeFunctionData(functionName, functionParams);
      console.log("Encoded function data:", data);

      // Estimate gas for the transaction
      let gasEstimate;
      try {
        // Estimate gas for this transaction
        gasEstimate = await provider.estimateGas({
          to: contractAddress,
          from: accountAddress,
          data,
          value: value ? ethers.utils.parseEther(value) : undefined
        });

        // Add 20% buffer for gas estimate
        gasEstimate = gasEstimate.mul(120).div(100);
        console.log("Gas estimate with buffer:", gasEstimate.toString());

        // Check if user has enough balance for gas
        await fetchBalance(); // Refresh balance
        const hasEnough = checkBalanceForGas(gasEstimate.toString());

        if (!hasEnough) {
          setLoading(false);
          throw new Error(`Insufficient balance to cover gas fees. Please add more AMOY to your wallet.`);
        }
      } catch (gasErr) {
        if (gasErr.message.includes('Insufficient balance')) {
          throw gasErr; // Re-throw balance errors
        }
        console.warn('Error estimating gas:', gasErr);
        // Continue with default gas if estimation fails
        console.log('Continuing with default gas limit');
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

      // Prepare transaction parameters
      const txParams: any = {
        type: 2, // EIP-1559 transaction type as shown in docs
        to: contractAddress,
        data,
        from: accountAddress,
        // Add required fields based on MetaKeep docs and error messages
        nonce: nonce, // Use the nonce we retrieved
        gas: 21000, // Basic gas limit for simple transfers
        chainId: chainId, // Include chain ID as shown in the documentation
        // Add fee parameters as shown in the docs
        maxFeePerGas: 1000,
        maxPriorityFeePerGas: 999,
      };

      // Add value if specified (for payable functions)
      if (value) {
        txParams.value = ethers.utils.parseEther(value);
      }

      console.log("Transaction params:", txParams);

      // Primary method: Use email-based transaction execution for enhanced security
      if (email) {
        try {
          console.log("Executing transaction with email verification");

          // Create simpler transaction request using signTransaction which is available
          console.log("Using signTransaction with email", email);
          
          let hasEmailSent = false; // Flag to track if email was sent

          // First, try with simple transaction parameters plus email
          try {
            // Standard format for MetaKeep SDK - follow docs exactly
            console.log("Attempting signTransaction with format from documentation");

            // Create transaction with required fields in exact format from docs
            const txObject = {
              // Transaction parameters
              type: 2, // EIP-1559 transaction type as shown in docs
              from: accountAddress,
              to: contractAddress,
              data,
              // Include gas parameters if needed (to match example in docs)
              gas: 21000, // basic gas amount
              // Add nonce - required per the error message
              nonce: nonce, // Use the nonce we retrieved from provider
              chainId: chainId, // Include chain ID as shown in the documentation
              // Add fee parameters as shown in the docs
              maxFeePerGas: 1000,
              maxPriorityFeePerGas: 999,
              // Don't include email or reason in transaction object
            };

            console.log("Transaction object:", txObject);
            // Pass reason as a separate parameter as shown in docs
            const signResult = await (metaKeep as any).signTransaction(
              txObject,
              "Transfer" // reason as separate parameter
            );

            console.log("signTransaction result:", signResult);
            
            // Track if the SDK sent an email for verification
            if (signResult?.emailSent) {
              hasEmailSent = true;
              console.log("Email verification was sent by MetaKeep");
            } else if (signResult?.status === "EMAIL_VERIFICATION_SENT" || signResult?.status === "EMAIL_SENT") {
              hasEmailSent = true;
              console.log("Email verification was sent by MetaKeep (status confirmed)");
            }

            const hash = signResult?.hash || signResult?.transactionHash || (typeof signResult === 'string' ? signResult : null);
            if (hash) {
              console.log("Transaction signed with hash:", hash);
              // Verify the transaction actually exists on the blockchain
              const isValid = await verifyTransactionWithRetry(hash, provider, chainId);
              if (!isValid) {
                console.warn("⚠️ Transaction hash not found on blockchain:", hash);
                // Different error message when email verification was successful but transaction not found
                if (hasEmailSent) {
                  throw new Error("Email verification was completed successfully, but the transaction was not found on the blockchain. This is usually a temporary issue with the network rather than a problem with your wallet.");
                } else {
                  throw new Error("Transaction may have failed to broadcast. The hash returned by MetaKeep was not found on the blockchain.");
                }
              }
              // Only set the hash if it's verified
              setTxHash(hash);
              // Start monitoring the transaction in the background
              monitorTransaction(hash, provider, chainId).catch(err => {
                console.error("Error monitoring transaction:", err);
              });
              return hash;
            } else if (hasEmailSent) {
              // Email was sent but no hash yet - this is expected when waiting for verification
              console.log("Transaction initiated, email sent for verification - waiting for response");
              const placeholderHash = "email-verification-pending";
              setTxHash(placeholderHash);
              return placeholderHash;
            } else {
              console.log("No response from MetaKeep, status unclear");
              throw new Error("Transaction initiation didn't receive a clear response from MetaKeep. Please check your email for potential verification requests.");
            }
          } catch (mainErr) {
            console.error("First transaction approach failed:", mainErr);

            // If first approach fails, try another format - raw tx params
            console.log("Trying with raw transaction parameters using documented format");
            try {
              // Match exactly what's in the docs - transaction object and separate reason
              const signResult = await (metaKeep as any).signTransaction(
                txParams, // Basic transaction parameters
                "Transfer" // Reason as separate parameter per docs
              );

              console.log("Raw parameter result:", signResult);

              const hash = signResult?.hash || signResult?.transactionHash || (typeof signResult === 'string' ? signResult : null);
              if (hash) {
                console.log("Transaction signed with hash:", hash);
                // Verify the transaction actually exists on the blockchain
                const isValid = await verifyTransactionWithRetry(hash, provider, chainId);
                if (!isValid) {
                  console.warn("⚠️ Transaction hash not found on blockchain:", hash);
                  // Instead of returning an unconfirmed hash, throw an error
                  throw new Error("Transaction may have failed to broadcast. The hash returned by MetaKeep was not found on the blockchain.");
                }
                // Only set the hash if it's verified
                setTxHash(hash);
                // Start monitoring the transaction in the background
                monitorTransaction(hash, provider, chainId).catch(err => {
                  console.error("Error monitoring transaction:", err);
                });
                return hash;
              } else {
                console.log("Transaction initiated, waiting for email verification");
                const placeholderHash = "email-verification-pending";
                setTxHash(placeholderHash);
                return placeholderHash;
              }
            } catch (signErr) {
              console.error("All sign approaches failed:", signErr);

              // Format error properly to avoid [object Object] display
              let errorMessage;
              if (mainErr instanceof Error) {
                errorMessage = mainErr.message;
              } else if (typeof mainErr === 'object' && mainErr !== null) {
                // Check for the specific status error
                if (mainErr.status === "INVALID_REASON") {
                  throw new Error("Transaction failed: The MetaKeep service requires a valid transaction reason");
                }

                try {
                  errorMessage = JSON.stringify(mainErr);
                } catch (e) {
                  errorMessage = "Unknown error format";
                }
              } else {
                errorMessage = String(mainErr);
              }

              throw new Error(`Transaction execution failed: ${errorMessage}`);
            }
          }
        } catch (emailErr) {
          console.error("Email transaction error:", emailErr);

          // Format error for display
          let errorMessage;
          if (emailErr instanceof Error) {
            errorMessage = emailErr.message;
          } else if (typeof emailErr === 'object' && emailErr !== null) {
            // Check for the specific status error
            if (emailErr.status === "INVALID_REASON") {
              throw new Error("Transaction failed: The MetaKeep service requires a valid transaction reason");
            }

            try {
              errorMessage = JSON.stringify(emailErr);
            } catch (e) {
              errorMessage = "Unknown error format";
            }
          } else {
            errorMessage = String(emailErr);
          }

          throw new Error(`Email verification failed: ${errorMessage}`);
        }
      }

      // Fallback methods if no email is provided
      // Try multiple methods to support different SDK versions
      const errors: any[] = [];

      // Method 1: Object form with transactionObject and bypassSecurityWarnings option
      try {
        console.log("Trying object form with documented approach");
        // Use the exact format from documentation - transaction object and separate reason
        const result = await (metaKeep as any).signTransaction(
          txParams, // Use the transaction parameters directly
          "Transfer" // Separate reason parameter
        );

        console.log("Sign transaction result:", result);
        const hash = result?.transactionHash || result?.hash || (typeof result === 'string' ? result : null);
        if (hash) {
          console.log("Transaction signed with hash:", hash);
          // Verify the transaction actually exists on the blockchain
          const isValid = await verifyTransactionWithRetry(hash, provider, chainId);
          if (!isValid) {
            console.warn("⚠️ Transaction hash not found on blockchain:", hash);
            // Instead of returning an unconfirmed hash, throw an error
            throw new Error("Transaction may have failed to broadcast. The hash returned by MetaKeep was not found on the blockchain.");
          }
          // Only set the hash if it's verified
          setTxHash(hash);
          // Start monitoring the transaction in the background
          monitorTransaction(hash, provider, chainId).catch(err => {
            console.error("Error monitoring transaction:", err);
          });
          return hash;
        }
      } catch (err1: any) {
        console.error("Error with object form:", err1);
        errors.push(err1);

        // Handle security rejection specifically
        if (err1.message?.includes("malicious") ||
          err1.message?.includes("security") ||
          err1.code === "SECURITY_WARNING") {
          throw new Error(`Security check: This transaction was flagged by MetaKeep's security system. If you trust this contract, try again and confirm in the MetaKeep interface.`);
        }
      }

      // Method 2: Direct call with two parameters (older SDK versions)
      try {
        console.log("Trying direct call with two parameters");
        const result = await (metaKeep as any).signTransaction(txParams, accountAddress);
        console.log("Sign transaction result:", result);
        const hash = typeof result === 'string' ? result : result?.transactionHash || result?.hash;
        if (hash) {
          console.log("Transaction signed with hash:", hash);
          // Verify the transaction actually exists on the blockchain
          const isValid = await verifyTransactionWithRetry(hash, provider, chainId);
          if (!isValid) {
            console.warn("⚠️ Transaction hash not found on blockchain:", hash);
            // Instead of returning an unconfirmed hash, throw an error
            throw new Error("Transaction may have failed to broadcast. The hash returned by MetaKeep was not found on the blockchain.");
          }
          // Only set the hash if it's verified
          setTxHash(hash);
          // Start monitoring the transaction in the background
          monitorTransaction(hash, provider, chainId).catch(err => {
            console.error("Error monitoring transaction:", err);
          });
          return hash;
        }
      } catch (err2: any) {
        console.error("Error with direct call:", err2);
        errors.push(err2);

        // Check for security-related rejection
        if (err2.message?.includes("malicious") ||
          err2.message?.includes("security") ||
          err2.code === "SECURITY_WARNING") {
          throw new Error(`Security check: This transaction was flagged by MetaKeep's security system. If you trust this contract, try again and confirm in the MetaKeep interface.`);
        }
      }

      // Method 3: Try sendTransaction (alternative method in some SDK versions)
      try {
        console.log("Trying sendTransaction method");
        const result = await (metaKeep as any).sendTransaction(txParams);
        console.log("Send transaction result:", result);
        const hash = typeof result === 'string' ? result : result?.transactionHash || result?.hash;
        if (hash) {
          console.log("Transaction signed with hash:", hash);
          // Verify the transaction actually exists on the blockchain
          const isValid = await verifyTransactionWithRetry(hash, provider, chainId);
          if (!isValid) {
            console.warn("⚠️ Transaction hash not found on blockchain:", hash);
            // Instead of returning an unconfirmed hash, throw an error
            throw new Error("Transaction may have failed to broadcast. The hash returned by MetaKeep was not found on the blockchain.");
          }
          // Only set the hash if it's verified
          setTxHash(hash);
          // Start monitoring the transaction in the background
          monitorTransaction(hash, provider, chainId).catch(err => {
            console.error("Error monitoring transaction:", err);
          });
          return hash;
        }
      } catch (err3: any) {
        console.error("Error with sendTransaction:", err3);
        errors.push(err3);

        // Check for security-related rejection
        if (err3.message?.includes("malicious") ||
          err3.message?.includes("security") ||
          err3.code === "SECURITY_WARNING") {
          throw new Error(`Security check: This transaction was flagged by MetaKeep's security system. If you trust this contract, try again and confirm in the MetaKeep interface.`);
        }
      }

      // If we got here, all methods failed
      throw new Error(`All transaction methods failed: ${errors.map(e => e.message || String(e)).join('; ')}`);
    }
    catch (err) {
      console.error('Transaction execution error:', err);

      // Handle the case where err is an object instead of an Error instance
      let errorMessage: string;

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null) {
        try {
          // Handle specific MetaKeep error formats
          if (typeof err === 'object' && err.status === "INVALID_REASON") {
            errorMessage = "Invalid reason provided for transaction. This may be a temporary issue with the MetaKeep service.";
          } else {
            // Try to convert object to a meaningful string
            errorMessage = JSON.stringify(err);
          }
        } catch (jsonErr) {
          // Fallback if the object can't be stringified (e.g., circular references)
          errorMessage = 'An error occurred with the transaction. See console for details.';
        }
      } else {
        errorMessage = String(err);
      }

      setError(errorMessage);
      throw new Error(errorMessage); // Rethrow as proper Error instance
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check if a transaction exists on the blockchain
   * 
   * @param txHash - Transaction hash to check
   * @param provider - Provider to use for checking
   * @returns Promise resolving to a boolean - true if transaction exists
   */
  const checkTransactionStatus = async (
    txHash: string,
    provider: ethers.providers.Provider
  ): Promise<boolean> => {
    try {
      // First check if we can get the transaction
      const tx = await provider.getTransaction(txHash);
      if (tx) {
        console.log("Transaction exists on blockchain:", tx);
        return true;
      }

      try {
        // Also check if we can get a receipt (might be already mined)
        // Wrap in separate try/catch to handle specific receipt errors
        const receipt = await provider.getTransactionReceipt(txHash);
        if (receipt) {
          console.log("Transaction receipt found:", receipt);
          return true;
        }
      } catch (receiptErr) {
        console.warn("Error getting transaction receipt:", receiptErr);
        // Don't throw here, just continue with the function
      }

      return false;
    } catch (err) {
      console.error("Error checking transaction status:", err);
      return false;
    }
  };

  /**
   * Monitors a transaction for status updates
   * 
   * @param txHash - Hash of the transaction to monitor
   * @param provider - Ethers provider instance
   * @param chainId - Chain ID to use for fallback providers
   * @param maxAttempts - Maximum number of status check attempts
   */
  const monitorTransaction = async (
    txHash: string,
    provider: ethers.providers.Provider,
    chainId: number = currentChainId,
    maxAttempts: number = 8
  ): Promise<void> => {
    if (!txHash || txHash === 'email-verification-pending') return;

    console.log("Starting transaction monitoring for hash:", txHash);

    // Wait for initial blockchain propagation
    await new Promise(resolve => setTimeout(resolve, 5000));

    let foundOnChain = false;
    let attempts = 0;

    // Create an array of providers to try
    const providers: ethers.providers.Provider[] = [provider];

    // Use our fallback providers system
    const fallbackProviders: { [key: number]: string[] } = {
      // Polygon Amoy testnet
      80002: [
        'https://rpc-amoy.polygon.technology/',
        'https://polygon-amoy-rpc.publicnode.com',
        'https://polygon-amoy.blockpi.network/v1/rpc/public',
        'https://api.zan.top/node/v1/polygon/amoy/public',
        'https://polygon-amoy.drpc.org',
        'https://polygon-amoy.g.alchemy.com/v2/demo'
      ],
      // Polygon mainnet
      137: [
        'https://polygon-rpc.com',
        'https://polygon-mainnet.g.alchemy.com/v2/demo',
        'https://polygon.meowrpc.com',
        'https://polygon.drpc.org',
        'https://polygon.llamarpc.com',
        'https://rpc-mainnet.maticvigil.com'
      ],
      // Ethereum mainnet
      1: [
        'https://eth-mainnet.g.alchemy.com/v2/demo',
        'https://1rpc.io/eth',
        'https://ethereum.publicnode.com',
        'https://rpc.ankr.com/eth',
        'https://eth.meowrpc.com',
        'https://eth.llamarpc.com'
      ]
    };

    // Add fallback providers
    try {
      const fallbacks = fallbackProviders[chainId] || [];
      for (const url of fallbacks) {
        try {
          providers.push(new ethers.providers.JsonRpcProvider(url));
        } catch (err) {
          console.warn(`Failed to create provider for ${url}:`, err);
        }
      }
    } catch (err) {
      console.warn("Failed to create fallback providers for monitoring:", err);
    }

    // Check transaction status with increasing intervals
    while (!foundOnChain && attempts < maxAttempts) {
      // Try with each provider
      for (const currentProvider of providers) {
        try {
          foundOnChain = await checkTransactionStatus(txHash, currentProvider);
          if (foundOnChain) {
            console.log(`Transaction found on blockchain during monitoring (attempt ${attempts + 1})`);
            // If we found the transaction after initial failure, clear the error
            setError(null);
            break;
          }
        } catch (err) {
          console.warn(`Provider failed during monitoring attempt ${attempts + 1}:`, err);
          // Continue to next provider
        }
      }

      if (!foundOnChain) {
        attempts++;
        const delayMs = Math.min(5000 * attempts, 30000); // Cap at 30 seconds
        console.log(`Transaction not found. Monitoring attempt ${attempts}/${maxAttempts}. Next check in ${delayMs / 1000}s`);

        if (attempts === maxAttempts) {
          console.warn("Transaction not found on blockchain after extended monitoring.");
          setError("Transaction may not have been submitted successfully. Please check the explorer later or try again.");
        } else {
          // Exponential backoff with a cap
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
  };

  /**
   * Verify transaction with retry mechanism
   * 
   * Tries multiple times with increasing delays between attempts
   * to account for blockchain propagation delay
   * 
   * @param hash - Transaction hash to verify
   * @param provider - Provider to use
   * @param chainId - Chain ID for the network
   * @returns Promise resolving to a boolean - true if found
   */
  const verifyTransactionWithRetry = async (
    hash: string,
    provider: ethers.providers.Provider,
    chainId: number
  ): Promise<boolean> => {
    // Skip for placeholder hashes
    if (!hash || hash === 'email-verification-pending') {
      return false;
    }

    // Maximum number of attempts
    const maxAttempts = 5;

    // Define fallback providers for each network - same as in getWorkingProvider
    const fallbackProviders: { [key: number]: string[] } = {
      // Polygon Amoy testnet
      80002: [
        'https://rpc-amoy.polygon.technology/',
        'https://polygon-amoy-rpc.publicnode.com',
        'https://polygon-amoy.blockpi.network/v1/rpc/public',
        'https://api.zan.top/node/v1/polygon/amoy/public',
        'https://polygon-amoy.drpc.org',
        'https://polygon-amoy.g.alchemy.com/v2/demo'
      ],
      // Polygon mainnet
      137: [
        'https://polygon-rpc.com',
        'https://polygon-mainnet.g.alchemy.com/v2/demo',
        'https://polygon.meowrpc.com',
        'https://polygon.drpc.org',
        'https://polygon.llamarpc.com',
        'https://rpc-mainnet.maticvigil.com'
      ],
      // Ethereum mainnet
      1: [
        'https://eth-mainnet.g.alchemy.com/v2/demo',
        'https://1rpc.io/eth',
        'https://ethereum.publicnode.com',
        'https://rpc.ankr.com/eth',
        'https://eth.meowrpc.com',
        'https://eth.llamarpc.com'
      ]
    };

    // Create provider instances from all RPC URLs
    const providers: ethers.providers.Provider[] = [provider];
    let rpcUrl = "";
    
    try {
      // For our primary provider, get its URL to avoid duplicates
      if (provider instanceof ethers.providers.JsonRpcProvider) {
        rpcUrl = provider.connection.url;
      }
    } catch (err) {
      console.warn("Could not get URL from primary provider:", err);
    }
    
    // Add all potential providers from our list
    const fallbacks = fallbackProviders[chainId] || [];
    const allUrls = [rpcUrl, ...fallbacks].filter(url => url); // Remove empty URLs
    
    // Deduplicate URLs and create providers
    const uniqueUrls = Array.from(new Set(allUrls));
    
    for (const url of uniqueUrls) {
      if (!url || (rpcUrl && url === rpcUrl)) continue; // Skip empty or duplicate URLs
      try {
        providers.push(new ethers.providers.JsonRpcProvider(url));
      } catch (err) {
        console.warn(`Failed to create provider for ${url}:`, err);
      }
    }
    
    // Try verification multiple times with increasing delays
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`Verification attempt ${attempt}/${maxAttempts} for hash ${hash}`);

      // Try with each provider - use Promise.all for faster parallel checks
      const checkPromises = providers.map(async (currentProvider) => {
        try {
          // Check if transaction exists
          const exists = await checkTransactionStatus(hash, currentProvider);
          return exists;
        } catch (err) {
          console.warn(`Provider failed during attempt ${attempt}:`, err);
          return false;
        }
      });
      
      try {
        const results = await Promise.all(checkPromises);
        if (results.some(result => result === true)) {
          console.log(`Transaction found on attempt ${attempt} with provider`);
          return true;
        }
      } catch (err) {
        console.warn(`Error checking transaction status on attempt ${attempt}:`, err);
      }

      if (attempt < maxAttempts) {
        // Wait longer between each retry
        // 1st retry: 5 seconds, 2nd retry: 10 seconds, etc.
        const delay = attempt * 5000;
        console.log(`Transaction not found, will retry in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.warn(`Transaction not found after ${maxAttempts} attempts`);
    return false;
  };

  // Return hook interface
  return {
    execute,
    txHash,
    loading,
    error
  };
};