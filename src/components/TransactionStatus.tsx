import React, { useState, useEffect } from "react";
import {
  Box,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Link,
  Spinner,
  Center,
  Text,
  VStack,
} from "@chakra-ui/react";
import { ethers } from "ethers";

interface TransactionStatusProps {
  txHash: string | null;
  chainId: number;
  loading?: boolean;
  error?: string | null;
  submittedButNotFound?: boolean;
}

// Helper function to get block explorer URL
const getExplorerUrl = (chainId: number, hash: string) => {
  const explorers: { [key: number]: string } = {
    1: "https://etherscan.io/tx/",
    137: "https://polygonscan.com/tx/",
    56: "https://bscscan.com/tx/",
    43114: "https://snowtrace.io/tx/",
    42161: "https://arbiscan.io/tx/",
    10: "https://optimistic.etherscan.io/tx/",
    80001: "https://mumbai.polygonscan.com/tx/", // Mumbai testnet
    80002: "https://amoy.polygonscan.com/tx/", // Amoy testnet
  };

  const baseUrl = explorers[chainId] || "https://etherscan.io/tx/";
  return `${baseUrl}${hash}`;
};

const TransactionStatus: React.FC<TransactionStatusProps> = ({
  txHash,
  chainId,
  loading = false,
  error = null,
  submittedButNotFound = false,
}) => {
  const [confirmationChecks, setConfirmationChecks] = useState<number>(0);
  const [transactionFoundOnChain, setTransactionFoundOnChain] = useState<
    boolean | null
  >(null);
  const [provider, setProvider] = useState<ethers.providers.Provider | null>(
    null
  );

  // Initialize provider based on chainId
  useEffect(() => {
    const getProvider = () => {
      try {
        let rpcUrl = "";
        // Set RPC URLs for different networks
        switch (chainId) {
          case 137:
            rpcUrl = "https://polygon-rpc.com";
            break;
          case 80001:
            rpcUrl = "https://rpc-mumbai.maticvigil.com";
            break;
          case 1:
            rpcUrl = "https://mainnet.infura.io/v3/your-project-id"; // Placeholder
            break;
          default:
            rpcUrl = "https://polygon-rpc.com"; // Default to Polygon
        }
        return new ethers.providers.JsonRpcProvider(rpcUrl);
      } catch (err) {
        console.error("Error creating provider:", err);
        return null;
      }
    };

    setProvider(getProvider());
  }, [chainId]);

  // Check if transaction exists on the blockchain
  useEffect(() => {
    if (!txHash || !provider || txHash === "email-verification-pending") return;

    const checkTransactionStatus = async () => {
      try {
        // Try to get the transaction
        const tx = await provider.getTransaction(txHash);

        // If we found the transaction, it exists on chain
        if (tx) {
          console.log("Transaction found on blockchain:", tx);
          setTransactionFoundOnChain(true);
          return;
        }

        // Try to get the receipt (might be already mined)
        const receipt = await provider.getTransactionReceipt(txHash);
        if (receipt) {
          console.log("Transaction receipt found:", receipt);
          setTransactionFoundOnChain(true);
          return;
        }

        // Transaction not found
        setTransactionFoundOnChain(false);
        setConfirmationChecks((prev) => prev + 1);
      } catch (err) {
        console.error("Error checking transaction status:", err);
        setTransactionFoundOnChain(false);
        setConfirmationChecks((prev) => prev + 1);
      }
    };

    // Check initially
    checkTransactionStatus();

    // Then check every 5 seconds for up to 30 seconds
    const interval = setInterval(() => {
      if (transactionFoundOnChain || confirmationChecks >= 6) {
        clearInterval(interval);
        return;
      }
      checkTransactionStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [txHash, provider]);

  if (loading) {
    return (
      <Center py={6}>
        <VStack spacing={4}>
          <Spinner size="xl" />
          <Text>Processing transaction...</Text>
        </VStack>
      </Center>
    );
  }

  if (error) {
    // Ensure error is displayed properly even if it's an object
    let errorMessage: string;

    if (typeof error === "string") {
      // Check for JSON string that might contain status codes
      if (error.includes('{"status":')) {
        try {
          const errorObj = JSON.parse(error);
          if (errorObj.status === "INVALID_REASON") {
            errorMessage =
              "Invalid reason provided for transaction. Please try again or contact support.";
          } else {
            errorMessage = `Error with status: ${errorObj.status}`;
          }
        } catch {
          errorMessage = error;
        }
      } else {
        errorMessage = error;
      }
    } else if (typeof error === "object" && error !== null) {
      // Use type assertion to properly handle Error objects
      const errorObj = error as any;

      // Check for status code errors
      if (errorObj.status === "INVALID_REASON") {
        errorMessage =
          "Invalid reason provided for transaction. Please try again or contact support.";
      } else if (errorObj.message && typeof errorObj.message === "string") {
        errorMessage = errorObj.message;
      } else {
        try {
          errorMessage = JSON.stringify(error);
        } catch (e) {
          errorMessage = "Unknown error occurred. Check console for details.";
        }
      }
    } else {
      errorMessage = String(error);
    }

    return (
      <Alert status="error" borderRadius="md">
        <AlertIcon />
        <Box>
          <AlertTitle>Transaction Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Box>
      </Alert>
    );
  }

  // Special case for email verification
  if (txHash === "email-verification-pending") {
    return (
      <Alert status="info" borderRadius="md">
        <AlertIcon />
        <Box>
          <AlertTitle>Email Verification Required</AlertTitle>
          <AlertDescription>
            A verification email has been sent to your email address. Please
            check your inbox and click the verification link to authorize and
            complete this transaction.
            <Text mt={2} fontStyle="italic">
              Once verified, the transaction will be submitted to the
              blockchain.
            </Text>
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  if (txHash && txHash !== "email-verification-pending") {
    return (
      <Box mt={4}>
        <Alert
          status={transactionFoundOnChain === false ? "warning" : "success"}
          borderRadius="md"
        >
          <AlertIcon />
          <Box>
            <AlertTitle>
              {transactionFoundOnChain === false
                ? "Transaction Submitted - Pending Confirmation"
                : "Transaction Submitted"}
            </AlertTitle>
            <AlertDescription>
              {transactionFoundOnChain === false && confirmationChecks >= 3 ? (
                <Box>
                  <Text mb={2}>
                    Your transaction was submitted, but hasn't been found on the
                    blockchain yet. This might be due to network congestion or
                    insufficient gas fees.
                  </Text>
                  <Text fontSize="sm" mb={2}>
                    Transaction Hash: {txHash}
                  </Text>
                </Box>
              ) : (
                <Box>
                  <Text mb={2}>
                    Your transaction has been submitted to the blockchain.
                    {transactionFoundOnChain === true
                      ? " It has been detected on the blockchain."
                      : " Waiting for blockchain confirmation..."}
                  </Text>
                  <Link
                    href={getExplorerUrl(chainId, txHash)}
                    isExternal
                    color="blue.500"
                  >
                    View on Block Explorer
                  </Link>
                </Box>
              )}
            </AlertDescription>
          </Box>
        </Alert>
      </Box>
    );
  }

  // When we have no transaction hash yet and no loading or error state
  if (!loading && !error) {
    return (
      <Alert status="info" borderRadius="md">
        <AlertIcon />
        <Box>
          <AlertTitle>Ready to Execute</AlertTitle>
          <AlertDescription>
            Click the Execute Transaction button to submit this transaction to
            the blockchain. You'll need to provide your email for verification.
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  return null;
};

export default TransactionStatus;
