import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
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
  Link,
} from "@chakra-ui/react";
import { useMetaKeep } from "../context/MetakeepContext";
import { SavedTransaction, TransactionDetails } from "../types";
import { useMetaKeepTransaction } from "../hooks/useMetaKeepTransaction";
import TransactionStatus from "../components/TransactionStatus";
import EmailConfirmation from "../components/EmailConfirmation";
import MetaKeepExtensionCheck from "../components/MetaKeepExtensionCheck";
import { useWalletBalance } from "../hooks/useWalletBalance";

const ExecuteTransactionPage: React.FC = () => {
  const { id: transactionId } = useParams<{ id: string }>();
  const location = useLocation();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cardBg = useColorModeValue("white", "gray.700");

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
  const [showManualConnect, setShowManualConnect] = useState<boolean>(false);
  const [connectionAttempts] = useState<number>(0);

  // Get wallet connection state
  const { connect, accountAddress, connecting } = useMetaKeep();

  // Add wallet balance hook
  const {
    formattedBalance,
    loading: balanceLoading,
    fetchBalance,
    error: balanceError,
    sufficientForGas,
  } = useWalletBalance(
    transaction?.transactionDetails?.rpcUrl || "https://polygon-rpc.com",
    transaction?.transactionDetails?.chainId || 137
  );

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

  // Refresh balance when account or transaction changes
  useEffect(() => {
    if (accountAddress && transaction) {
      fetchBalance();
    }
  }, [accountAddress, transaction, fetchBalance]);

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
    if (!email || email.trim() === "") {
      toast({
        title: "Email Required",
        description:
          "Please provide a valid email address to connect with MetaKeep",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setUserEmail(email);

    try {
      console.log("Connecting wallet with email:", email);

      // Close the dialog first to prevent UI confusion
      onClose();

      // Show loading toast
      const loadingToast = toast({
        title: "Connecting...",
        description:
          "Please check your email and approve the connection request",
        status: "loading",
        duration: null,
        isClosable: false,
      });

      // Try to connect with the email
      await connect(email);

      // Close the loading toast
      toast.close(loadingToast);

      if (accountAddress) {
        console.log("Successfully connected with address:", accountAddress);
        toast({
          title: "Wallet Connected",
          description: `Successfully connected with address: ${accountAddress.substring(
            0,
            6
          )}...${accountAddress.substring(accountAddress.length - 4)}`,
          status: "success",
          duration: 5000,
          isClosable: true,
        });

        // If we have a transaction, execute it automatically
        if (transaction) {
          setTimeout(() => executeTransaction(email, forceExecution), 1000);
        }
      } else {
        toast({
          title: "Connection Issue",
          description:
            "Connected but couldn't obtain wallet address. Please check your email and approve the request.",
          status: "warning",
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (err) {
      // Format error message
      let errorMsg = "";
      if (err instanceof Error) {
        errorMsg = err.message;
      } else if (typeof err === "object" && err !== null) {
        try {
          errorMsg = JSON.stringify(err);
        } catch {
          errorMsg = "Unknown error";
        }
      } else {
        errorMsg = String(err);
      }

      console.error("Wallet connection error:", errorMsg);

      // Only show error toast for non-cancellation errors
      if (
        !errorMsg.includes("cancelled") &&
        !errorMsg.includes("cancel") &&
        !errorMsg.includes("denied") &&
        !errorMsg.includes("OPERATION_CANCELLED")
      ) {
        toast({
          title: "Connection Error",
          description:
            errorMsg || "Could not connect to wallet. Please try again.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      } else {
        // For cancellation errors, show a milder notification
        toast({
          title: "Connection Cancelled",
          description:
            "You cancelled the wallet connection request. Please check your email and approve the authentication.",
          status: "info",
          duration: 5000,
          isClosable: true,
        });
      }
    }
  };

  const executeTransaction = async (email?: string, bypassSecurity = false) => {
    if (!transaction) return;

    // Use provided email or default to the state value
    const emailToUse = email || userEmail;

    try {
      console.log("Executing transaction with email:", emailToUse);
      setSecurityWarning(false);

      // Ensure we have a connected wallet with account address
      if (!accountAddress) {
        console.log("No wallet address available, attempting to connect first");
        toast({
          title: "Connecting Wallet",
          description:
            "We need to connect your wallet first. Please check your email.",
          status: "info",
          duration: 5000,
          isClosable: true,
        });

        try {
          // Try wallet connection with email
          await connect(emailToUse);

          // If connection succeeded but we still don't have an address, we can't proceed
          if (!accountAddress) {
            throw new Error(
              "Failed to obtain wallet address. Please make sure you've approved the connection request in your email."
            );
          }
        } catch (connectErr) {
          // Format the error properly
          let errorMsg = "";
          if (connectErr instanceof Error) {
            errorMsg = connectErr.message;
          } else if (typeof connectErr === "object" && connectErr !== null) {
            try {
              errorMsg = JSON.stringify(connectErr);
            } catch {
              errorMsg = "Unknown error";
            }
          } else {
            errorMsg = String(connectErr);
          }

          // Don't show error toast for user cancellations
          if (
            errorMsg.includes("cancelled") ||
            errorMsg.includes("denied") ||
            errorMsg.includes("OPERATION_CANCELLED")
          ) {
            throw new Error(
              "Transaction cancelled: Wallet connection was rejected. Please check your email and approve the request."
            );
          } else {
            throw new Error(`Unable to connect wallet: ${errorMsg}`);
          }
        }
      }

      // Add email to transaction context
      const transactionWithEmail = {
        ...transaction.transactionDetails,
        email: emailToUse, // This email will be used by the MetaKeep SDK for verification
        bypassSecurity: bypassSecurity, // Add flag to bypass security warnings if user forces execution
        reason: "Transfer", // Simplify to a basic reason that should be universally acceptable
      };

      console.log("Executing transaction:", transactionWithEmail);

      try {
        // Show loading toast while transaction is being processed
        const loadingToast = toast({
          title: "Processing Transaction",
          description:
            "Your transaction is being processed. You may receive an email for verification depending on your wallet security settings.",
          status: "loading",
          duration: null,
          isClosable: false,
        });

        const hash = await execute(transactionWithEmail);
        console.log("Transaction hash received:", hash);
        setTxHash(hash);

        // Close loading toast
        toast.close(loadingToast);

        // Check if this is a placeholder hash from email verification
        if (hash === "email-verification-pending") {
          toast({
            title: "Email Verification Required",
            description:
              "Please check your email for a verification request from MetaKeep. You must approve this to complete your transaction.",
            status: "info",
            duration: 15000,
            isClosable: true,
          });
        } else {
          toast({
            title: "Transaction Submitted",
            description: "Your transaction is being processed by the network.",
            status: "success",
            duration: 5000,
            isClosable: true,
          });
        }
      } catch (txErr) {
        // Format error message properly
        let errorMsg = "";
        if (txErr instanceof Error) {
          errorMsg = txErr.message;
        } else if (typeof txErr === "object" && txErr !== null) {
          try {
            // Check for specific MetaKeep error formats
            if ((txErr as any).status === "INVALID_REASON") {
              errorMsg =
                "Invalid reason provided for transaction. This may be a temporary issue. Please try again later.";
            } else if ((txErr as any).status === "MISSING_NONCE") {
              errorMsg =
                "Transaction nonce error. This could be due to a previous pending transaction. Please try again in a few minutes.";
            } else if (
              (txErr as any).message &&
              (txErr as any).message.includes("not found on blockchain")
            ) {
              errorMsg =
                "Your email verification was successful, but the transaction could not be verified on the blockchain. This could be due to network congestion or RPC issues.";
            } else {
              errorMsg = JSON.stringify(txErr);
            }
          } catch {
            errorMsg = "Unknown transaction error";
          }
        } else {
          errorMsg = String(txErr);
        }

        console.error("Transaction execution error:", errorMsg);

        // Check for cancellation errors
        if (
          errorMsg.includes("OPERATION_CANCELLED") ||
          errorMsg.includes("cancelled") ||
          errorMsg.includes("denied") ||
          errorMsg.includes("rejected")
        ) {
          throw new Error(
            "Transaction was cancelled by the user. Please check your email and approve the request."
          );
        }

        // Check for network/broadcast issues
        if (
          errorMsg.includes("failed to broadcast") ||
          errorMsg.includes("not found on blockchain") ||
          errorMsg.includes("may have failed")
        ) {
          throw new Error(
            "Email verification was successful, but the transaction could not be confirmed on the blockchain. This could be due to network congestion or RPC issues. Please check back later to see if your transaction was confirmed."
          );
        }

        // Throw the formatted error
        throw new Error(errorMsg);
      }
    } catch (err) {
      console.error("Transaction handling error:", err);

      // Extract error message safely, ensuring objects are properly stringified
      let errorMessage: string;

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "object" && err !== null) {
        try {
          // Check for specific MetaKeep error formats
          if ((err as any).status === "INVALID_REASON") {
            errorMessage =
              "Invalid reason provided for transaction. This may be a temporary issue. Please try again later.";
          } else {
            errorMessage = JSON.stringify(err);
          }
        } catch (jsonErr) {
          errorMessage = "Unknown transaction error. See console for details.";
        }
      } else {
        errorMessage = String(err);
      }

      // Handle security warnings specially
      if (
        errorMessage.includes("Security check") ||
        errorMessage.includes("malicious") ||
        errorMessage.includes("security warning")
      ) {
        setSecurityWarning(true);
        setError(errorMessage);

        // Show a special toast for security warnings
        toast({
          title: "Security Warning",
          description:
            "This transaction was flagged by security checks. Review before proceeding.",
          status: "warning",
          duration: 10000,
          isClosable: true,
        });
      }
      // Don't show error toast for user cancellations to avoid notification spam
      else if (
        errorMessage.includes("cancelled") ||
        errorMessage.includes("denied") ||
        errorMessage.includes("rejected")
      ) {
        // Just set the error without a toast
        setError(errorMessage);
      } else {
        // Show regular error toast for technical errors
        toast({
          title: "Transaction Failed",
          description: errorMessage,
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
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
                isDisabled={!!txHash || !sufficientForGas}
              >
                {txHash
                  ? "Transaction Submitted"
                  : !sufficientForGas
                  ? "Insufficient Balance"
                  : "Execute Transaction"}
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

        {/* Display block explorer link when transaction hash is available */}
        {txHash && txHash !== "email-verification-pending" && (
          <Alert status="info" borderRadius="md" mt={2}>
            <AlertIcon />
            <Box>
              <AlertTitle>Transaction Details</AlertTitle>
              <AlertDescription>
                <Text mb={2}>
                  Your transaction has been submitted to the blockchain.
                </Text>
                <Text fontSize="sm" mb={2}>
                  Transaction Hash: {txHash}
                </Text>
                <Link
                  href={getExplorerUrl(transactionDetails.chainId, txHash)}
                  isExternal
                  color="blue.500"
                  textDecoration="underline"
                >
                  View on Block Explorer
                </Link>
              </AlertDescription>
            </Box>
          </Alert>
        )}

        {/* Email verification reminder */}
        {txHash === "email-verification-pending" && (
          <Alert status="info" borderRadius="md" mt={4}>
            <AlertIcon />
            <Box>
              <AlertTitle>Email Verification Required</AlertTitle>
              <AlertDescription>
                <Text mb={2}>
                  MetaKeep has sent a verification email to {userEmail}. Please
                  check your inbox (and spam folder) and approve the transaction
                  to proceed.
                </Text>
                <Text fontSize="sm">
                  Note: If you don't receive an email within a minute, the
                  transaction may have been rejected by the MetaKeep service.
                  Try again or contact support if the issue persists.
                </Text>
              </AlertDescription>
            </Box>
          </Alert>
        )}

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

        {accountAddress && (
          <Box mt={4} mb={4}>
            <Alert
              status={!sufficientForGas ? "error" : "info"}
              borderRadius="md"
            >
              <AlertIcon />
              <Box>
                <AlertTitle>
                  {balanceLoading ? "Checking balance..." : "Wallet Balance"}
                </AlertTitle>
                <AlertDescription>
                  {balanceLoading ? (
                    <Box>
                      <HStack mb={2}>
                        <Spinner size="sm" mr={2} />
                        <Text>Checking wallet balance...</Text>
                      </HStack>
                      <Button
                        size="sm"
                        colorScheme="blue"
                        onClick={() => {
                          // Force-refresh balance manually
                          fetchBalance();
                        }}
                      >
                        Refresh Balance
                      </Button>
                    </Box>
                  ) : balanceError ? (
                    <Text>
                      Unable to load balance. You can proceed with your
                      transaction, but ensure you have enough AMOY for gas fees.
                    </Text>
                  ) : !sufficientForGas ? (
                    <Text color="red.500">
                      <strong>Insufficient balance for gas fees!</strong> Your
                      balance: {formattedBalance}
                    </Text>
                  ) : (
                    <Text>
                      Your balance: <strong>{formattedBalance}</strong>
                    </Text>
                  )}
                  {!sufficientForGas && (
                    <Box mt={2}>
                      <Text fontSize="sm">
                        You need more AMOY to complete this transaction. Please
                        fund your wallet with some testnet tokens.
                      </Text>
                      <Button
                        size="sm"
                        colorScheme="blue"
                        mt={2}
                        onClick={fetchBalance}
                      >
                        Refresh Balance
                      </Button>
                    </Box>
                  )}
                </AlertDescription>
              </Box>
            </Alert>
          </Box>
        )}

        {/* Add a button to mock balance in development mode */}
        {process.env.NODE_ENV === "development" && balanceLoading && (
          <Alert status="info" borderRadius="md" mt={2}>
            <AlertIcon />
            <Box>
              <AlertTitle>Development Mode</AlertTitle>
              <AlertDescription>
                <Text mb={2}>
                  Balance checking is taking longer than expected.
                </Text>
                <HStack spacing={2}>
                  <Button
                    size="sm"
                    colorScheme="blue"
                    onClick={() => {
                      // This is for development purposes only
                      // Execute transaction without waiting for balance check
                      handleExecuteTransaction();
                    }}
                  >
                    Dev: Skip Balance Check
                  </Button>
                  <Button
                    size="sm"
                    colorScheme="green"
                    onClick={() => {
                      // Manually set a mock balance by setting environment variable
                      window.localStorage.setItem("MOCK_BALANCE", "true");
                      window.location.reload();
                    }}
                  >
                    Dev: Use Mock Balance
                  </Button>
                </HStack>
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
