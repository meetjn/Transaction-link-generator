import React, { useState, useEffect } from "react";
import {
  Box,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Button,
  Text,
  VStack,
  Link,
  HStack,
  useToast,
} from "@chakra-ui/react";
import { useMetaKeep } from "../context/MetakeepContext";

/**
 * Displays helpful messages when there are MetaKeep SDK loading issues
 */
const MetaKeepExtensionCheck: React.FC = () => {
  const { error, sdk } = useMetaKeep();
  const [sdkAvailable, setSdkAvailable] = useState<boolean | null>(null);
  const [checkingSdk, setCheckingSdk] = useState(true);
  const toast = useToast();

  // Check if MetaKeep SDK is available
  useEffect(() => {
    const checkMetaKeepSdk = async () => {
      setCheckingSdk(true);

      // Check if we have a valid SDK instance
      const hasSdkInstance = sdk !== null;

      setSdkAvailable(hasSdkInstance);
      setCheckingSdk(false);
    };

    // Wait a moment to let everything initialize
    const timer = setTimeout(checkMetaKeepSdk, 1500);
    return () => clearTimeout(timer);
  }, [sdk]);

  const reloadPage = () => {
    window.location.reload();
  };

  // If we're still checking or there's no error and SDK is available, don't show anything
  if (checkingSdk || (sdkAvailable && !error)) {
    return null;
  }

  // Show SDK missing message if SDK is not available
  if (sdkAvailable === false) {
    return (
      <Box p={4}>
        <Alert
          status="warning"
          variant="subtle"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          textAlign="center"
          borderRadius="md"
          py={6}
        >
          <AlertIcon boxSize="40px" mr={0} />
          <AlertTitle mt={4} mb={1} fontSize="lg">
            MetaKeep SDK Not Available
          </AlertTitle>
          <AlertDescription maxWidth="md">
            <VStack spacing={4} mt={4}>
              <Text>
                MetaKeep SDK is required to connect your wallet and execute
                transactions. The application is unable to load the SDK. Please
                try refreshing the page.
              </Text>
              <Button onClick={reloadPage} colorScheme="blue">
                Refresh Page
              </Button>
            </VStack>
          </AlertDescription>
        </Alert>
      </Box>
    );
  }

  // For SDK loading errors or connection cancellation errors
  if (error) {
    const isCancellation =
      error.includes("cancelled") ||
      error.includes("canceled") ||
      error.includes("denied") ||
      error.includes("OPERATION_CANCELLED") ||
      error.includes("rejected");

    const isLoadingError =
      error.includes("MetaKeep not found") ||
      error.includes("MetaKeep still not available") ||
      error.includes("MetaKeep SDK") ||
      error.includes("Failed to load");

    // Only show loading errors or don't show for cancellations
    if (!isLoadingError && isCancellation) {
      return null;
    }

    return (
      <Box p={4}>
        <Alert
          status="warning"
          variant="subtle"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          textAlign="center"
          borderRadius="md"
          py={6}
        >
          <AlertIcon boxSize="40px" mr={0} />
          <AlertTitle mt={4} mb={1} fontSize="lg">
            {isLoadingError ? "MetaKeep SDK Loading Error" : "Connection Issue"}
          </AlertTitle>
          <AlertDescription maxWidth="md">
            <VStack spacing={4} mt={4}>
              <Text>
                {isLoadingError
                  ? "There was an issue loading the MetaKeep SDK. This might be due to network connectivity or a temporary service disruption."
                  : "There was an issue connecting to the MetaKeep service. Please try again or refresh the page."}
              </Text>
              <HStack spacing={4}>
                <Button onClick={reloadPage} colorScheme="blue">
                  Reload Page
                </Button>
                {!isLoadingError && (
                  <Link href="https://docs.metakeep.xyz/docs" isExternal>
                    <Button colorScheme="gray">MetaKeep Help</Button>
                  </Link>
                )}
              </HStack>
            </VStack>
          </AlertDescription>
        </Alert>
      </Box>
    );
  }

  return null;
};

// Add window type definitions
declare global {
  interface Window {
    metaKeep?: any;
    ethereum?: any;
    MetaKeep?: any;
  }
}

export default MetaKeepExtensionCheck;
