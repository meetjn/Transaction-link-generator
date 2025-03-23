import React from "react";
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

interface TransactionStatusProps {
  txHash: string | null;
  chainId: number;
  loading?: boolean;
  error?: string | null;
}

const TransactionStatus: React.FC<TransactionStatusProps> = ({
  txHash,
  chainId,
  loading = false,
  error = null,
}) => {
  // Get explorer URL for the transaction
  const getExplorerUrl = (chainId: number, hash: string) => {
    const explorers: { [key: number]: string } = {
      1: "https://etherscan.io/tx/",
      137: "https://polygonscan.com/tx/",
      56: "https://bscscan.com/tx/",
      43114: "https://snowtrace.io/tx/",
      42161: "https://arbiscan.io/tx/",
      10: "https://optimistic.etherscan.io/tx/",
      80002: "https://amoy.polygonscan.com/tx/", // Polygon Amoy testnet
    };

    const baseUrl = explorers[chainId] || "https://etherscan.io/tx/";
    return `${baseUrl}${hash}`;
  };

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

  if (txHash) {
    return (
      <Alert status="success" borderRadius="md">
        <AlertIcon />
        <Box>
          <AlertTitle>Transaction Submitted!</AlertTitle>
          <AlertDescription>
            Your transaction has been submitted to the blockchain.
            {txHash !== "email-verification-pending" && (
              <Link
                href={getExplorerUrl(chainId, txHash)}
                isExternal
                display="flex"
                alignItems="center"
                mt={2}
                color="blue.500"
              >
                View on Block Explorer
              </Link>
            )}
          </AlertDescription>
        </Box>
      </Alert>
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
