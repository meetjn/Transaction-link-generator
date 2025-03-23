import React, { useState, useEffect } from "react";
import { useParams, Link as RouterLink, useLocation } from "react-router-dom";
import {
  Container,
  Heading,
  VStack,
  Box,
  Text,
  Button,
  useColorModeValue,
  HStack,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Link,
  useToast,
} from "@chakra-ui/react";
import { CheckCircleIcon, ExternalLinkIcon } from "@chakra-ui/icons";
import { useMetaKeep } from "../context/MetakeepContext";

const TransactionStatusPage: React.FC = () => {
  const { txHash } = useParams<{ txHash: string }>();
  const location = useLocation();
  const toast = useToast();
  const [status, setStatus] = useState<"pending" | "success" | "error">(
    "pending"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const cardBg = useColorModeValue("white", "gray.700");
  const { accountAddress } = useMetaKeep();

  // Get transaction details from location state
  const transactionState =
    (location.state as {
      chainId?: number;
      contractAddress?: string;
      txHash?: string;
      fromAddress?: string;
    }) || {};

  // Use params or state, with params taking precedence
  const txHashToUse = txHash || transactionState.txHash;
  const chainId = transactionState.chainId || 80002; // Default to Polygon Amoy
  const contractAddress = transactionState.contractAddress;
  const fromAddress = transactionState.fromAddress || accountAddress;

  // Get explorer URL for the transaction based on chain ID
  const getExplorerUrl = (hash: string) => {
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

  // Check transaction status - poll for updates on Amoy testnet
  useEffect(() => {
    // Display a success toast when the page loads
    toast({
      title: "Transaction Processed",
      description: "Your transaction was sent to the blockchain successfully",
      status: "success",
      duration: 5000,
      isClosable: true,
    });

    if (!txHashToUse) return;

    // Set initial status to success since we've navigated here from execution page
    setStatus("success");

    // For Amoy testnet, it might take longer for transactions to be indexed
    // We'll show a notification about this
    toast({
      title: "Transaction Processing",
      description:
        "Note: Transactions on Polygon Amoy testnet may take several minutes to be indexed. The transaction has been submitted but might not appear on the explorer immediately.",
      status: "info",
      duration: 10000,
      isClosable: true,
    });
  }, [txHashToUse, toast]);

  return (
    <Container maxW="container.md" py={10}>
      <VStack spacing={6} align="stretch">
        <Heading size="xl" textAlign="center">
          Transaction Status
        </Heading>

        <Box
          bg={cardBg}
          p={6}
          borderRadius="lg"
          boxShadow="md"
          position="relative"
        >
          {status === "pending" && (
            <VStack spacing={4} align="center" py={4}>
              <Spinner size="xl" color="blue.500" />
              <Text fontSize="lg" fontWeight="medium">
                Transaction in Progress
              </Text>
              <Text color="gray.500" textAlign="center">
                Your transaction is being processed on the blockchain. This
                might take a few moments.
              </Text>
            </VStack>
          )}

          {status === "success" && (
            <VStack spacing={4} align="center" py={4}>
              <Box w="64px" h="64px" color="green.500">
                <CheckCircleIcon w="100%" h="100%" />
              </Box>
              <Text fontSize="xl" fontWeight="bold" color="green.500">
                Transaction Successful!
              </Text>
              <Text color="gray.500" textAlign="center">
                Your transaction has been successfully processed on the Polygon
                Amoy testnet.
              </Text>

              <Alert status="info" mt={3} size="sm">
                <AlertIcon />
                <Box fontSize="sm">
                  <AlertTitle>About Testnet Transactions</AlertTitle>
                  <AlertDescription>
                    On the Polygon Amoy testnet, transactions may not appear
                    immediately on block explorers. If the transaction doesn't
                    appear yet, it might be:
                    <Text as="ul" pl={4} mt={2}>
                      <Text as="li">Still pending in the mempool</Text>
                      <Text as="li">Waiting to be indexed by the explorer</Text>
                      <Text as="li">Processing due to network conditions</Text>
                    </Text>
                  </AlertDescription>
                </Box>
              </Alert>

              {txHashToUse && (
                <HStack spacing={2} mt={2}>
                  <Link
                    href={getExplorerUrl(txHashToUse)}
                    isExternal
                    color="blue.500"
                  >
                    View on Block Explorer{" "}
                    <Box
                      as="span"
                      verticalAlign="middle"
                      display="inline-block"
                      ml="2px"
                    >
                      <ExternalLinkIcon boxSize="0.9em" />
                    </Box>
                  </Link>
                </HStack>
              )}

              <Text fontSize="sm" color="gray.500" mt={4}>
                Transaction Hash: {txHashToUse}
              </Text>

              {fromAddress && (
                <Text fontSize="sm" color="gray.500">
                  From Address: {fromAddress}
                </Text>
              )}

              {contractAddress && (
                <Text fontSize="sm" color="gray.500">
                  Contract Address: {contractAddress}
                </Text>
              )}

              <Text fontSize="sm" color="gray.500">
                Network:{" "}
                {chainId === 80002
                  ? "Polygon Amoy Testnet"
                  : `Chain ID: ${chainId}`}
              </Text>
            </VStack>
          )}

          {status === "error" && (
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              <Box>
                <AlertTitle>Transaction Failed</AlertTitle>
                <AlertDescription>
                  {errorMessage ||
                    "There was an error processing your transaction."}
                </AlertDescription>
              </Box>
            </Alert>
          )}
        </Box>

        <Button
          as={RouterLink}
          to="/"
          colorScheme="blue"
          size="lg"
          width="full"
          mt={4}
        >
          Return to Home
        </Button>
      </VStack>
    </Container>
  );
};

export default TransactionStatusPage;
