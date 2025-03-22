import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useMetaKeep } from '../context/MetakeepContext';

interface UseWalletBalanceReturn {
  balance: string | null;
  formattedBalance: string;
  loading: boolean;
  error: string | null;
  sufficientForGas: boolean;
  fetchBalance: () => Promise<void>;
  checkBalanceForGas: (gasEstimate: string) => boolean;
}

/**
 * Tests if an RPC provider is working properly
 * @param url The RPC URL to test
 * @returns Promise resolving to a boolean - true if provider is working
 */
const testRpcProvider = async (url: string): Promise<boolean> => {
  try {
    const provider = new ethers.providers.JsonRpcProvider(url);
    // Try a simple call that should work on any provider
    const blockNumber = await provider.getBlockNumber();
    console.log(`[Balance Check] Provider ${url} is working, current block: ${blockNumber}`);
    return true;
  } catch (err) {
    console.warn(`[Balance Check] Provider ${url} failed: ${err.message}`);
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
      'https://polygon-amoy.g.alchemy.com/v2/demo'
    ],
    // Polygon mainnet
    137: [
      'https://polygon-rpc.com',
      'https://polygon-mainnet.g.alchemy.com/v2/demo',
      'https://polygon.llamarpc.com',
      'https://polygon.rpc.blxrbdn.com'
    ],
    // Ethereum mainnet
    1: [
      'https://eth-mainnet.g.alchemy.com/v2/demo',
      'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
      'https://eth.llamarpc.com',
      'https://ethereum.publicnode.com'
    ]
  };

  // Always try the provided URL first
  try {
    if (await testRpcProvider(rpcUrl)) {
      return new ethers.providers.JsonRpcProvider(rpcUrl);
    }
  } catch (err) {
    console.warn(`[Balance Check] Primary provider failed: ${err.message}`);
  }

  // Try fallbacks for this chain
  const fallbacks = fallbackProviders[chainId] || [];

  // Test each provider in sequence
  for (const url of fallbacks) {
    try {
      if (await testRpcProvider(url)) {
        return new ethers.providers.JsonRpcProvider(url);
      }
    } catch (err) {
      console.warn(`[Balance Check] Fallback provider ${url} failed: ${err.message}`);
      // Continue to next provider
    }
  }

  // If we get here, all providers failed
  console.error("[Balance Check] All RPC providers failed. Network detection not possible.");
  return undefined;
};

/**
 * Custom hook for checking wallet balance
 * @param rpcUrl RPC URL to use for the provider
 * @param chainId Chain ID of the network
 * @returns Balance information and functions
 */
export const useWalletBalance = (
  rpcUrl: string,
  chainId: number
): UseWalletBalanceReturn => {
  const { accountAddress } = useMetaKeep();
  const [balance, setBalance] = useState<string | null>(null);
  const [formattedBalance, setFormattedBalance] = useState<string>('Loading...');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sufficientForGas, setSufficientForGas] = useState<boolean>(true);

  // Make a standalone function to allow balance checks without React dependencies
  const setMockBalance = async () => {
    // Simulate a small delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Set up mock values based on the network
    let mockAmount = '0.05';
    let currency = 'ETH';
    
    // Adjust currency based on chain ID
    if (chainId === 80002) {
      currency = 'AMOY';
    } else if (chainId === 137) {
      currency = 'MATIC';
    } else if (chainId === 56) {
      currency = 'BNB';
    }
    
    const mockBalance = `${mockAmount} ${currency}`;
    console.log('[Balance Check] Using mock balance:', mockBalance);
    
    // Convert to wei (same value for all networks in this mock case)
    setBalance('50000000000000000'); // 0.05 ETH in wei
    setFormattedBalance(mockBalance);
    setSufficientForGas(true);
    setLoading(false);
    setError(null);
    return true;
  };

  // Fetch the balance using the provided RPC URL
  const fetchBalance = useCallback(async (): Promise<void> => {
    // Don't fetch if we don't have an address
    if (!accountAddress) {
      setLoading(false);
      setError('No wallet address available');
      return;
    }

    // Check if we're using mock balance for development
    const useMockBalance = window.localStorage.getItem('MOCK_BALANCE');
    if (useMockBalance) {
      console.log('[Balance Check] Using mock balance for development');
      setMockBalance();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create a timeout promise - important for handling network issues gracefully
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Balance check timed out after 15 seconds')), 15000);
      });

      // Create a function to try getting the balance
      const getBalancePromise = async (): Promise<void> => {
        // Try to get a working provider
        const provider = await getWorkingProvider(rpcUrl, chainId);
        if (!provider) {
          throw new Error('Could not connect to any blockchain provider to check balance');
        }

        // Fetch balance
        const balanceWei = await provider.getBalance(accountAddress);
        console.log(`[Balance Check] Fetched balance for ${accountAddress}: ${balanceWei.toString()}`);

        // Format for display based on network - Amoy testnet is AMOY, others will be appropriate
        let currency = 'ETH';
        if (chainId === 80002) {
          currency = 'AMOY';
        } else if (chainId === 137) {
          currency = 'MATIC';
        } else if (chainId === 56) {
          currency = 'BNB';
        }

        // Store raw balance
        setBalance(balanceWei.toString());

        // Format to a reasonable number of decimals
        const formattedAmount = parseFloat(ethers.utils.formatEther(balanceWei)).toFixed(5);
        setFormattedBalance(`${formattedAmount} ${currency}`);

        // Check if balance is sufficient for typical gas fees
        const minBalanceForGas = ethers.utils.parseEther('0.01'); // Minimum balance needed
        setSufficientForGas(balanceWei.gte(minBalanceForGas));

        setLoading(false);
      };

      // Race between timeout and actual balance fetch
      await Promise.race([getBalancePromise(), timeoutPromise]);
    } catch (err) {
      console.error('[Balance Check] Error fetching balance:', err);
      setError(err.message || 'Failed to fetch balance');

      // Check if this is likely to be a CORS or network issue
      if (err.message?.includes('CORS') ||
        err.message?.includes('Failed to fetch') ||
        err.message?.includes('network') ||
        err.message?.includes('timed out')) {
        console.log('[Balance Check] Network issue detected, falling back to mock balance');
        // Fall back to mock balance on network/CORS issues in development
        if (process.env.NODE_ENV === 'development') {
          await setMockBalance();
        }
      } else {
        setLoading(false);
      }
    }
  }, [accountAddress, rpcUrl, chainId]);

  // Check if balance is sufficient for a specific gas estimate
  const checkBalanceForGas = useCallback((gasEstimate: string): boolean => {
    if (!balance) return false;

    try {
      const balanceWei = ethers.BigNumber.from(balance);
      
      // If gas estimate is provided, use it for calculation
      if (gasEstimate && gasEstimate !== '0') {
        const estimateWei = ethers.BigNumber.from(gasEstimate);
        // Get current gas price or use a reasonable default
        const gasPrice = ethers.utils.parseUnits('30', 'gwei'); // Fallback gas price
        
        const gasCost = estimateWei.mul(gasPrice);
        console.log(`[Balance Check] Gas cost: ${ethers.utils.formatEther(gasCost)} ETH, Balance: ${ethers.utils.formatEther(balanceWei)} ETH`);
        
        // Gas cost should be at least 10% less than total balance for safety
        const result = balanceWei.gt(gasCost.mul(110).div(100));
        setSufficientForGas(result);
        return result;
      } else {
        // No specific gas estimate - check if we have at least minimum balance for basic transactions
        const minBalance = ethers.utils.parseEther('0.005'); // Reduced minimum for Amoy testnet
        const result = balanceWei.gt(minBalance);
        setSufficientForGas(result);
        return result;
      }
    } catch (err) {
      console.error('[Balance Check] Error calculating gas cost:', err);
      return false;
    }
  }, [balance]);

  // Fetch balance on mount and when accountAddress, rpcUrl, or chainId changes
  useEffect(() => {
    if (accountAddress) {
      fetchBalance();
    } else {
      setLoading(false);
      setBalance(null);
      setFormattedBalance('Connect wallet to see balance');
    }
  }, [accountAddress, rpcUrl, chainId, fetchBalance]);

  return {
    balance,
    formattedBalance,
    loading,
    error,
    sufficientForGas,
    fetchBalance,
    checkBalanceForGas
  };
}; 