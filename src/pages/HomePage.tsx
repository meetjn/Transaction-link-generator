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

const HomePage: React.FC = () => {
  const { connected, accountAddress, connect, loading } = useMetaKeep();
  const bgColor = useColorModeValue("gray.50", "gray.800");
  const cardBgColor = useColorModeValue("white", "gray.700");

  return (
    <Container maxW="container.xl" py={10}>
      <Box textAlign="center" mb={10}>
        <Heading as="h1" size="2xl" mb={4}>
          MetaKeep Transaction Link Generator
        </Heading>
        <Text fontSize="xl" mb={6}>
          Create and share one-off transaction links with embedded wallets
        </Text>

        {!connected ? (
          <Button
            colorScheme="blue"
            size="lg"
            onClick={connect}
            isLoading={loading}
            mb={6}
          >
            Connect Wallet
          </Button>
        ) : (
          <VStack spacing={4} mb={6}>
            <Text>Connected Address: {accountAddress}</Text>
            <Button as={RouterLink} to="/create" colorScheme="green" size="lg">
              Create Transaction Link
            </Button>
          </VStack>
        )}
      </Box>

      <Box bg={bgColor} p={6} borderRadius="lg">
        <Heading as="h2" size="lg" mb={6} textAlign="center">
          How It Works
        </Heading>

        <Flex
          direction={{ base: "column", md: "row" }}
          justify="center"
          gap={6}
        >
          <Box
            p={6}
            bg={cardBgColor}
            borderRadius="md"
            boxShadow="md"
            flex="1"
            textAlign="center"
          >
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

          <Box
            p={6}
            bg={cardBgColor}
            borderRadius="md"
            boxShadow="md"
            flex="1"
            textAlign="center"
          >
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
