import React from "react";
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
} from "@chakra-ui/react";
import { useMetaKeep } from "../context/MetakeepContext";

interface WalletConnectionProps {
  onConnect?: () => void;
}

const WalletConnection: React.FC<WalletConnectionProps> = ({ onConnect }) => {
  const { connected, accountAddress, connect, disconnect, loading, error } =
    useMetaKeep();

  const handleConnect = async () => {
    await connect();
    if (onConnect) onConnect();
  };

  return (
    <Box p={6} borderWidth="1px" borderRadius="lg">
      {error && (
        <Alert status="error" mb={4} borderRadius="md">
          <AlertIcon />
          <Box>
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Box>
        </Alert>
      )}

      {!connected ? (
        <VStack spacing={4}>
          <Text>Connect your wallet to continue</Text>
          <Button
            colorScheme="blue"
            onClick={handleConnect}
            isLoading={loading}
            loadingText="Connecting"
          >
            Connect with MetaKeep
          </Button>
        </VStack>
      ) : (
        <VStack spacing={4} align="stretch">
          <HStack>
            <Text>Connected Address:</Text>
            <Code>{accountAddress}</Code>
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
