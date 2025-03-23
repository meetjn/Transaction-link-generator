import React, { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Heading,
  Text,
  Button,
  VStack,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  useDisclosure,
} from "@chakra-ui/react";
import { useMetaKeep } from "../context/MetakeepContext";
import { SavedTransaction, TransactionDetails } from "../types";
import { useMetaKeepTransaction } from "../hooks/useMetaKeepTransaction";
import TransactionStatus from "../components/TransactionStatus";
import EmailConfirmation from "../components/EmailConfirmation";
import MetaKeepExtensionCheck from "../components/MetaKeepExtensionCheck";

const ExecuteTransactionPage: React.FC = () => {
  const { id: transactionId } = useParams<{ id: string }>();
  const location = useLocation();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cardBg = useColorModeValue("white", "gray.700");
  const navigate = useNavigate();

  // Get transaction management hooks
  const {
    execute,
    loading: txLoading,
    error: txError,
  } = useMetaKeepTransaction();

  // State for the transaction details
  const [transaction, setTransaction] = useState<SavedTransaction | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("meetjaiin@gmail.com");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [forceExecution, setForceExecution] = useState<boolean>(false);
  const [securityWarning, setSecurityWarning] = useState<boolean>(false);
  const [bypassNetworkError, setBypassNetworkError] = useState<boolean>(false);
  const [showManualConnect, setShowManualConnect] = useState<boolean>(false);
  const [connectionAttempts, setConnectionAttempts] = useState<number>(0);
  const [emailDialogOpen, setEmailDialogOpen] = useState<boolean>(false);

  // Get wallet connection state
  const { connected, connect, accountAddress, connecting } = useMetaKeep();

  // Parse transaction data from URL parameters instead of localStorage
  useEffect(() => {
    setLoading(true);

    try {
      // Get transaction data from URL query params
      const searchParams = new URLSearchParams(location.search);
      const encodedData = searchParams.get("data");

      if (encodedData) {
        // Decode and parse transaction data from URL
        const decodedData = decodeURIComponent(encodedData);
        const parsedTransaction = JSON.parse(decodedData);

        setTransaction(parsedTransaction);
      } else {
        // Fall back to legacy localStorage method if no URL data is found
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
      }
    } catch (err) {
      console.error("Error loading transaction:", err);
      setError("Failed to load transaction details");
    } finally {
      setLoading(false);
    }
  }, [transactionId, location.search]);

  // Update the useEffect for automatic connecting to not attempt without email
  useEffect(() => {
    // We won't attempt auto-connection without an email since we're using the SDK directly
    if (transaction && !accountAddress && !connecting) {
      console.log(
        "Transaction loaded, please connect wallet with your email to continue"
      );
      setShowManualConnect(true);
    }
  }, [transaction, accountAddress, connecting]);

  // Simplify the connect wallet handler to use the default email
  const handleConnectWallet = async () => {
    try {
      setError(null); // Clear any existing errors

      // Either use the default email or open the dialog for custom email input
      if (userEmail) {
        console.log("Connecting with default email:", userEmail);
        handleEmailConfirm(userEmail);
      } else {
        // Show email dialog to get user email
        onOpen();
      }
    } catch (err) {
      console.error("Error preparing wallet connection:", err);
    }
  };

  // Update email confirm handler to be more robust
  const handleEmailConfirm = async (email: string) => {
    setEmailDialogOpen(false);
    setLoading(true);
    setError(null);

    // Store the email for future use
    setUserEmail(email);

    try {
      console.log("Connecting wallet with email:", email);

      // Clear any previous toast notifications
      toast.closeAll();

      // Show connecting toast
      const connectingToast = toast({
        title: "Connecting wallet",
        description: "Please check your email for verification if prompted",
        status: "loading",
        duration: null,
        isClosable: false,
      });

      // Use the connect method from the context
      await connect(email);

      // Close loading toast
      toast.close(connectingToast);

      // Show success toast
      toast({
        title: "Wallet connected",
        description: `Successfully connected with email: ${email}`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });

      // If we have a transaction loaded, execute it after a short delay
      if (transaction) {
        console.log("Transaction loaded, executing after connection...");

        // Give a moment for the connection to stabilize
        setTimeout(async () => {
          try {
            await executeTransaction();
          } catch (error) {
            console.error("Transaction execution error:", error);
            setError(error instanceof Error ? error.message : String(error));
            toast({
              title: "Transaction Failed",
              description:
                error instanceof Error ? error.message : String(error),
              status: "error",
              duration: 5000,
              isClosable: true,
            });
          }
        }, 1000);
      }
    } catch (error) {
      console.error("Connection error:", error);

      // Format error for display
      let errorMessage: string;
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "object" && error !== null) {
        try {
          errorMessage = JSON.stringify(error);
        } catch (e) {
          errorMessage = "Unknown connection error";
        }
      } else {
        errorMessage = String(error);
      }

      setError(errorMessage);

      // Show error toast with specific guidance
      toast({
        title: "Connection failed",
        description: errorMessage,
        status: "error",
        duration: 5000,
        isClosable: true,
      });

      // If the error indicates verification is needed, show a helpful message
      if (
        errorMessage.includes("verification") ||
        errorMessage.includes("check your email") ||
        errorMessage.includes("consent")
      ) {
        toast({
          title: "Email verification needed",
          description:
            "Please check your email and complete the verification process",
          status: "info",
          duration: 10000,
          isClosable: true,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Function to execute the transaction
  const executeTransaction = async () => {
    if (!transaction) {
      setError("No transaction to execute");
      return;
    }

    if (!accountAddress) {
      setError("Wallet not connected. Please connect your wallet first.");
      setEmailDialogOpen(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("Executing transaction...");
      console.log(
        "Contract address:",
        transaction.transactionDetails.contractAddress
      );
      console.log("Function:", transaction.transactionDetails.functionName);
      console.log("Parameters:", transaction.transactionDetails.functionParams);
      console.log(
        "ABI:",
        JSON.stringify(transaction.transactionDetails.abi).substring(0, 200) +
          "..."
      );

      // RPC URLs for different networks
      const rpcUrls = {
        1: "https://eth-mainnet.g.alchemy.com/v2/demo", // Ethereum
        137: "https://polygon-rpc.com", // Polygon
        80002:
          "https://polygon-amoy.g.alchemy.com/v2/dKz6QD3l7WEbD7xKNOhvHQNhjEQrh4gr", // Polygon Amoy Testnet
        56: "https://bsc-dataseed.binance.org", // BSC
        43114: "https://api.avax.network/ext/bc/C/rpc", // Avalanche
        42161: "https://arb1.arbitrum.io/rpc", // Arbitrum
        10: "https://mainnet.optimism.io", // Optimism
      };

      // Add the user's email and reason to the transaction details, and force Polygon Amoy testnet
      const transactionWithEmail = {
        ...transaction.transactionDetails,
        email: userEmail,
        reason: "Contract Function Execution", // Required by MetaKeep
        chainId: 80002, // Force Polygon Amoy testnet
        rpcUrl: rpcUrls[80002], // Use Amoy testnet RPC URL from the mapping
        bypassSecurity: true, // Always bypass security checks on Amoy testnet
      };

      console.log("Executing transaction with details:", transactionWithEmail);
      console.log("Using Polygon Amoy testnet (chainId: 80002)");

      // Execute the transaction with the execute function from the hook
      const txHash = await execute(transactionWithEmail);
      console.log("Transaction executed with hash:", txHash);

      // Show success toast
      toast({
        title: "Transaction submitted to Polygon Amoy testnet",
        description: "Your transaction has been submitted successfully.",
        status: "success",
        duration: 5000,
        isClosable: true,
      });

      // Set transaction hash in state
      setTxHash(txHash);

      // Navigate to the transaction status page if we have a real hash
      if (txHash && txHash !== "email-verification-pending") {
        navigate(`/transaction/${txHash}`, {
          state: {
            chainId: transactionWithEmail.chainId,
            contractAddress: transactionWithEmail.contractAddress,
            txHash: txHash,
            fromAddress: accountAddress,
          },
        });
      }
    } catch (error) {
      console.error("Transaction execution error:", error);

      // Format error for display
      let errorMessage: string;
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "object" && error !== null) {
        try {
          errorMessage = JSON.stringify(error);
        } catch (e) {
          errorMessage = "Unknown error executing transaction";
        }
      } else {
        errorMessage = String(error);
      }

      setError(errorMessage);

      // Check if this is a network error that could be bypassed
      if (
        errorMessage.includes("network") ||
        errorMessage.includes("could not detect network")
      ) {
        // Show special UI for network errors
        setBypassNetworkError(false); // Reset in case it was previously set

        toast({
          title: "Network Error",
          description:
            "There was a problem detecting the network. You can try bypassing network validation.",
          status: "warning",
          duration: 8000,
          isClosable: true,
        });
      } else {
        // Show standard error toast
        toast({
          title: "Transaction failed",
          description: errorMessage,
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForceExecution = () => {
    setForceExecution(true);
    onOpen(); // Open email confirmation dialog again
  };

  const handleExecuteTransaction = async () => {
    if (!transaction) return;

    // Reset force execution flag on initial attempt
    setForceExecution(false);

    // Open email confirmation dialog
    onOpen();
  };

  // Function to format parameters for display
  const formatParams = (details: TransactionDetails) => {
    if (!details.functionParams || details.functionParams.length === 0) {
      return "None";
    }

    return JSON.stringify(details.functionParams, null, 2);
  };

  // Get explorer URL for the transaction
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

        {/* Add MetaKeep extension check */}
        <MetaKeepExtensionCheck />

        {description && (
          <Alert status="info" borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>Transaction Purpose</AlertTitle>
              <AlertDescription>{description}</AlertDescription>
            </Box>
          </Alert>
        )}

        {/* Add error handling for wallet connection - use accountAddress as the true indicator of connection */}
        {!accountAddress && (
          <Alert
            status={showManualConnect ? "error" : "warning"}
            borderRadius="md"
          >
            <AlertIcon />
            <Box>
              <AlertTitle>
                {showManualConnect
                  ? "Wallet Connection Failed"
                  : "Wallet Connection Required"}
              </AlertTitle>
              <AlertDescription>
                {showManualConnect
                  ? "We couldn't automatically connect to your MetaKeep wallet. Please check that MetaKeep is installed and unlocked, then try connecting manually."
                  : "Please connect your wallet to execute this transaction."}
                {connectionAttempts > 0 &&
                  !showManualConnect &&
                  " If you're having trouble connecting, please make sure MetaKeep is installed and unlocked."}
              </AlertDescription>
            </Box>
          </Alert>
        )}

        {/* Security warning section */}
        {securityWarning && (
          <Alert status="warning" borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>Security Warning</AlertTitle>
              <AlertDescription display="block">
                <Text mb={2}>
                  This transaction was flagged for security reasons. Only
                  proceed if you trust this contract.
                </Text>
                <Button
                  colorScheme="orange"
                  size="sm"
                  onClick={handleForceExecution}
                  mt={2}
                >
                  I Trust This Contract - Execute Anyway
                </Button>
              </AlertDescription>
            </Box>
          </Alert>
        )}

        {/* Network error bypass section */}
        {error &&
          (error.includes("network") ||
            error.includes("could not detect network")) && (
            <Alert status="warning" borderRadius="md">
              <AlertIcon />
              <Box>
                <AlertTitle>Network Detection Error</AlertTitle>
                <AlertDescription display="block">
                  <Text mb={2}>
                    We couldn't connect to the network to validate the contract.
                    This could be due to:
                  </Text>
                  <Text as="ul" pl={4} mb={2}>
                    <Text as="li">Network connectivity issues</Text>
                    <Text as="li">RPC provider outage or rate limiting</Text>
                    <Text as="li">Firewall or proxy restrictions</Text>
                  </Text>
                  <Text mb={3}>
                    You can try again later or bypass network validation to
                    proceed with the transaction.
                  </Text>
                  <Button
                    colorScheme="orange"
                    size="sm"
                    onClick={() => {
                      setBypassNetworkError(true);
                      // Try executing again with bypass enabled
                      executeTransaction();
                    }}
                    mt={2}
                  >
                    Bypass Network Validation
                  </Button>
                </AlertDescription>
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
                    : transactionDetails.chainId === 80002
                    ? "Polygon Amoy Testnet"
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
            {!accountAddress ? (
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

        <TransactionStatus
          txHash={txHash}
          chainId={transactionDetails.chainId}
          loading={txLoading}
          error={txError}
        />

        {accountAddress && (
          <Box mt={2}>
            <Text textAlign="center">Connected Address: {accountAddress}</Text>
          </Box>
        )}

        {showManualConnect && !accountAddress && (
          <Alert status="info" borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>Troubleshooting Tips</AlertTitle>
              <AlertDescription>
                <VStack align="start" spacing={2} mt={2}>
                  <Text>1. Make sure the MetaKeep extension is installed</Text>
                  <Text>2. Ensure your wallet is unlocked</Text>
                  <Text>3. Try refreshing the page</Text>
                  <Text>
                    4. Check if the extension has the right permissions
                  </Text>
                </VStack>
              </AlertDescription>
            </Box>
          </Alert>
        )}
      </VStack>

      {/* Email confirmation modal */}
      <EmailConfirmation
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={handleEmailConfirm}
        isLoading={txLoading}
      />
    </Container>
  );
};

export default ExecuteTransactionPage;
