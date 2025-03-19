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
  txHash: string;
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
    return (
      <Alert status="error" borderRadius="md">
        <AlertIcon />
        <Box>
          <AlertTitle>Transaction Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Box>
      </Alert>
    );
  }

  if (txHash) {
    return (
      <Alert status="success" borderRadius="md">
        <AlertIcon />
        <Box>
          <AlertTitle>Transaction Successful!</AlertTitle>
          <AlertDescription>
            Your transaction has been submitted to the blockchain.
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
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  return null;
};

export default TransactionStatus;
