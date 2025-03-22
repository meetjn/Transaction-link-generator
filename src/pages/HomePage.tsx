import React from "react";
import {
  Box,
  Button,
  Container,
  Heading,
  Text,
  Flex,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { useMetaKeep } from "../context/MetakeepContext";
import { FaWallet, FaExchangeAlt } from "react-icons/fa";

/**
 * HomePage Component
 *
 * Renders the landing page of the application with:
 * - A header section explaining the app's purpose
 * - Wallet connection functionality
 * - Navigation to transaction creation when connected
 * - An explanatory section showing how the app works for developers and users
 */
const HomePage: React.FC = () => {
  // Get MetaKeep context values for wallet connection
  const { connected, accountAddress, connect, loading } = useMetaKeep();

  // Chakra UI color mode values for light/dark theme support
  const bgColor = useColorModeValue("gray.50", "gray.800");
  const cardBgColor = useColorModeValue("white", "gray.700");

  return (
    <Container maxW="container.xl" py={10}>
      {/* Hero section with app title and wallet connection */}
      <Box textAlign="center" mb={10}>
        <Heading as="h1" size="2xl" mb={4}>
          MetaKeep Transaction Link Generator
        </Heading>
        <Text fontSize="xl" mb={6}>
          Create and share one-off transaction links with embedded wallets
        </Text>

        {/* Conditional rendering based on wallet connection state */}
        {!connected ? (
          // Show connect wallet button when not connected
          <Button
            colorScheme="blue"
            size="lg"
            onClick={(e) => {
              e.preventDefault();
              connect();
            }}
            isLoading={loading}
            mb={6}
          >
            Connect Wallet
          </Button>
        ) : (
          // Show connected address and create transaction button when connected
          <VStack spacing={4} mb={6}>
            <Text>Connected Address: {accountAddress}</Text>
            <Button as={RouterLink} to="/create" colorScheme="green" size="lg">
              Create Transaction Link
            </Button>
          </VStack>
        )}
      </Box>

      {/* How It Works section with cards explaining the process */}
      <Box bg={bgColor} p={6} borderRadius="lg">
        <Heading as="h2" size="lg" mb={6} textAlign="center">
          How It Works
        </Heading>

        {/* Responsive layout that switches from row to column on small screens */}
        <Flex
          direction={{ base: "column", md: "row" }}
          justify="center"
          gap={6}
        >
          {/* Developer card explaining transaction creation */}
          <Box
            p={6}
            bg={cardBgColor}
            borderRadius="md"
            boxShadow="md"
            flex="1"
            textAlign="center"
          >
            {/* Wallet icon rendered as a function to avoid TypeScript errors */}
            <Box
              fontSize="4xl"
              color="blue.500"
              mb={4}
              style={{ textAlign: "center" }}
            >
              {FaWallet({ size: 40 })}
            </Box>
            <Heading as="h3" size="md" mb={2}>
              Developer
            </Heading>
            <Text>
              Create a transaction by providing contract details and parameters.
              Generate a shareable link that users can open to execute the
              transaction.
            </Text>
          </Box>

          {/* User card explaining transaction execution */}
          <Box
            p={6}
            bg={cardBgColor}
            borderRadius="md"
            boxShadow="md"
            flex="1"
            textAlign="center"
          >
            {/* Exchange icon rendered as a function to avoid TypeScript errors */}
            <Box
              fontSize="4xl"
              color="green.500"
              mb={4}
              style={{ textAlign: "center" }}
            >
              {FaExchangeAlt({ size: 40 })}
            </Box>
            <Heading as="h3" size="md" mb={2}>
              User
            </Heading>
            <Text>
              Open the shared link, connect your MetaKeep wallet, review the
              transaction details, and execute with a single click.
            </Text>
          </Box>
        </Flex>
      </Box>
    </Container>
  );
};

export default HomePage;
