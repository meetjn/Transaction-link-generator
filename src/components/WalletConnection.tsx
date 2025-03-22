import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Text,
  VStack,
  HStack,
  Code,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useToast,
  Link,
} from "@chakra-ui/react";
import { useMetaKeep } from "../context/MetakeepContext";
import MetaKeepExtensionCheck from "./MetaKeepExtensionCheck";

interface WalletConnectionProps {
  onConnect?: () => void;
}

const WalletConnection: React.FC<WalletConnectionProps> = ({ onConnect }) => {
  const { connected, accountAddress, connect, disconnect, loading, error } =
    useMetaKeep();
  const toast = useToast();
  const [retryCount, setRetryCount] = useState(0);
  const [hasAttemptedConnect, setHasAttemptedConnect] = useState(false);

  // Debug log for wallet state
  useEffect(() => {
    console.log("WalletConnection state:", { connected, accountAddress });
  }, [connected, accountAddress]);

  // Reset retry count when component re-mounts or error state changes
  useEffect(() => {
    if (!hasAttemptedConnect) {
      setRetryCount(0);
    }
  }, [hasAttemptedConnect]);

  const handleConnect = async () => {
    try {
      setRetryCount((prev) => prev + 1);
      setHasAttemptedConnect(true);

      // Connect using the wallet API
      await connect();

      // Only show success if we actually have an address
      if (accountAddress) {
        toast({
          title: "Success",
          description: "Wallet connected successfully!",
          status: "success",
          duration: 3000,
          isClosable: true,
        });

        if (onConnect) onConnect();
      } else {
        // We're connected but don't have an address - this is unusual
        console.warn("Connected but no wallet address returned");
        toast({
          title: "Partial Connection",
          description:
            "Connected but no wallet address was returned. Try again or reload the page.",
          status: "warning",
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (err) {
      console.error("Connection error in component:", err);

      let errorMessage = "Failed to connect wallet";
      if (err instanceof Error) {
        errorMessage = err.message;

        // Check for specific error messages and provide better guidance
        if (
          errorMessage.includes("wallet address") ||
          errorMessage.includes("getWallet")
        ) {
          errorMessage =
            "Could not get wallet. Make sure MetaKeep extension is installed and unlocked.";
        } else if (errorMessage.includes("consent")) {
          errorMessage =
            "User consent required. Please try again and accept the connection request.";
        }
      }

      toast({
        title: "Connection Error",
        description: errorMessage,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <Box p={6} borderWidth="1px" borderRadius="lg">
      {/* Check if MetaKeep extension is available */}
      <MetaKeepExtensionCheck />

      {error && (
        <Alert status="error" mb={4} borderRadius="md">
          <AlertIcon />
          <Box>
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>
              {error}
              {retryCount >= 2 && (
                <Box mt={2}>
                  <Text fontWeight="bold">Troubleshooting:</Text>
                  <Text fontSize="sm">
                    1. Make sure your MetaKeep wallet is installed and unlocked
                  </Text>
                  <Text fontSize="sm">
                    2. Try refreshing the page and connecting again
                  </Text>
                  <Text fontSize="sm">
                    3. Check if you're using the correct MetaKeep account
                  </Text>
                  <Text fontSize="sm">
                    4. Make sure you're using a supported browser (Chrome,
                    Firefox, Edge)
                  </Text>
                  <Link
                    href="https://docs.metakeep.xyz/reference/sdk-get-wallet"
                    isExternal
                    color="blue.500"
                    fontSize="sm"
                  >
                    MetaKeep Wallet Documentation
                  </Link>
                </Box>
              )}
            </AlertDescription>
          </Box>
        </Alert>
      )}

      {!accountAddress ? (
        <VStack spacing={4}>
          <Text>Connect your wallet to continue</Text>
          <Button
            colorScheme="blue"
            onClick={handleConnect}
            isLoading={loading}
            loadingText="Connecting"
            size="lg"
            width="full"
          >
            Connect with MetaKeep
          </Button>
          <Text fontSize="sm" color="gray.500">
            Make sure the MetaKeep extension is installed and enabled in your
            browser
          </Text>
        </VStack>
      ) : (
        <VStack spacing={4} align="stretch">
          <Alert status="success" borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>Wallet Connected</AlertTitle>
              <AlertDescription>
                Your MetaKeep wallet is connected and ready to use.
              </AlertDescription>
            </Box>
          </Alert>

          <HStack>
            <Text>Connected Address:</Text>
            <Code overflowX="auto" maxW="350px">
              {accountAddress}
            </Code>
          </HStack>

          <Button variant="outline" size="sm" onClick={disconnect}>
            Disconnect
          </Button>
        </VStack>
      )}
    </Box>
  );
};

export default WalletConnection;
