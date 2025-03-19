import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Box,
  Container,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Spinner,
  Center,
  Badge,
  Divider,
  useToast,
  useColorModeValue,
} from "@chakra-ui/react";
import { useMetaKeep } from "../context/MetakeepContext";
import { SavedTransaction, TransactionDetails } from "../types";
import { useMetaKeepTransaction } from "../hooks/useMetaKeepTransaction";
import TransactionStatus from "../components/TransactionStatus";

const ExecuteTransactionPage: React.FC = () => {
  const { transactionId } = useParams<{ transactionId: string }>();
  const [transaction, setTransaction] = useState<SavedTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { connected, connect, accountAddress } = useMetaKeep();
  const toast = useToast();
  const {
    execute,
    txHash,
    loading: txLoading,
    error: txError,
  } = useMetaKeepTransaction();
  const cardBg = useColorModeValue("white", "gray.700");

  // Load transaction details from storage
  useEffect(() => {
    if (!transactionId) {
      setError("No transaction ID provided");
      setLoading(false);
      return;
    }

    try {
      // In a real app, you'd fetch this from your backend
      const savedTransactions = JSON.parse(
        localStorage.getItem("savedTransactions") || "[]"
      );

      const transaction = savedTransactions.find(
        (tx: SavedTransaction) => tx.id === transactionId
      );

      if (transaction) {
        setTransaction(transaction);
      } else {
        setError("Transaction not found");
      }
    } catch (err) {
      console.error("Error loading transaction:", err);
      setError("Failed to load transaction details");
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  const handleConnectWallet = async () => {
    try {
      await connect();
    } catch (err) {
      console.error("Error connecting wallet:", err);
      toast({
        title: "Connection Error",
        description: "Failed to connect wallet",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleExecuteTransaction = async () => {
    if (!transaction) return;

    try {
      const hash = await execute(transaction.transactionDetails);

      toast({
        title: "Transaction Submitted",
        description:
          "Your transaction has been successfully submitted to the blockchain",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (err) {
      console.error("Transaction execution error:", err);
      // Error is handled by the hook and shown in the UI
    }
  };

  // Function to format parameters for display
  const formatParams = (details: TransactionDetails) => {
    if (!details.functionParams || details.functionParams.length === 0) {
      return "None";
    }

    return JSON.stringify(details.functionParams, null, 2);
  };

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
      <Container maxW="container.md" py={10}>
        <Center h="300px">
          <VStack spacing={4}>
            <Spinner size="xl" thickness="4px" />
            <Text>Loading transaction details...</Text>
          </VStack>
        </Center>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxW="container.md" py={10}>
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <Box>
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Box>
        </Alert>
      </Container>
    );
  }

  if (!transaction) {
    return (
      <Container maxW="container.md" py={10}>
        <Alert status="warning" borderRadius="md">
          <AlertIcon />
          <Box>
            <AlertTitle>Transaction Not Found</AlertTitle>
            <AlertDescription>
              The transaction you're looking for doesn't exist or has been
              removed.
            </AlertDescription>
          </Box>
        </Alert>
      </Container>
    );
  }

  const { transactionDetails, description, createdAt } = transaction;

  return (
    <Container maxW="container.md" py={10}>
      <VStack spacing={6} align="stretch">
        <Heading size="xl" textAlign="center">
          Execute Transaction
        </Heading>

        {description && (
          <Alert status="info" borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>Transaction Purpose</AlertTitle>
              <AlertDescription>{description}</AlertDescription>
            </Box>
          </Alert>
        )}

        <Card bg={cardBg} borderRadius="md" boxShadow="md">
          <CardHeader>
            <Heading size="md">Transaction Details</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <Box>
                <Text fontWeight="bold">Contract:</Text>
                <Text wordBreak="break-all">
                  {transactionDetails.contractAddress}
                </Text>
              </Box>

              <Box>
                <Text fontWeight="bold">Function:</Text>
                <Text>{transactionDetails.functionName}</Text>
              </Box>

              <Box>
                <Text fontWeight="bold">Parameters:</Text>
                <Text
                  as="pre"
                  fontSize="sm"
                  fontFamily="monospace"
                  p={2}
                  bg="gray.100"
                  borderRadius="md"
                  overflow="auto"
                >
                  {formatParams(transactionDetails)}
                </Text>
              </Box>

              {transactionDetails.value && (
                <Box>
                  <Text fontWeight="bold">Value:</Text>
                  <Text>{transactionDetails.value} ETH</Text>
                </Box>
              )}

              <Box>
                <Text fontWeight="bold">Network:</Text>
                <Badge colorScheme="blue">
                  {transactionDetails.chainId === 1
                    ? "Ethereum Mainnet"
                    : transactionDetails.chainId === 137
                    ? "Polygon"
                    : transactionDetails.chainId === 56
                    ? "BSC"
                    : transactionDetails.chainId === 43114
                    ? "Avalanche"
                    : transactionDetails.chainId === 42161
                    ? "Arbitrum"
                    : transactionDetails.chainId === 10
                    ? "Optimism"
                    : `Chain ID: ${transactionDetails.chainId}`}
                </Badge>
              </Box>

              {createdAt && (
                <Box>
                  <Text fontWeight="bold">Created:</Text>
                  <Text>{new Date(createdAt).toLocaleString()}</Text>
                </Box>
              )}
            </VStack>
          </CardBody>
          <Divider />
          <CardFooter>
            {!connected ? (
              <Button
                colorScheme="blue"
                size="lg"
                width="full"
                onClick={handleConnectWallet}
              >
                Connect Wallet to Execute
              </Button>
            ) : (
              <Button
                colorScheme="green"
                size="lg"
                width="full"
                onClick={handleExecuteTransaction}
                isLoading={txLoading}
                loadingText="Submitting Transaction"
                isDisabled={!!txHash}
              >
                {txHash ? "Transaction Submitted" : "Execute Transaction"}
              </Button>
            )}
          </CardFooter>
        </Card>

        {txError && (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>Transaction Error</AlertTitle>
              <AlertDescription>{txError}</AlertDescription>
            </Box>
          </Alert>
        )}

        {txHash && (
          <TransactionStatus
            txHash={txHash}
            chainId={transactionDetails.chainId}
          />
        )}

        {connected && (
          <Box mt={2}>
            <Text textAlign="center">Connected Address: {accountAddress}</Text>
          </Box>
        )}
      </VStack>
    </Container>
  );
};

export default ExecuteTransactionPage;
