import React from "react";
import {
  Box,
  Flex,
  Button,
  Text,
  HStack,
  Link,
  Heading,
  Badge,
  useColorModeValue,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { useMetaKeep } from "../context/MetakeepContext";

const Navbar: React.FC = () => {
  const { connected, connecting, connect, disconnect, accountAddress } =
    useMetaKeep();
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");

  return (
    <Box
      as="nav"
      bg={bgColor}
      borderBottom="1px"
      borderColor={borderColor}
      py={3}
      px={4}
    >
      <Flex
        maxW="container.xl"
        mx="auto"
        align="center"
        justify="space-between"
        wrap="wrap"
      >
        <Flex align="center">
          <Heading
            as={RouterLink}
            to="/"
            size="md"
            color="blue.500"
            letterSpacing="tight"
          >
            MetaKeep Transactions
          </Heading>
        </Flex>

        <HStack spacing={8} display={{ base: "none", md: "flex" }}>
          <Link as={RouterLink} to="/" fontWeight="medium">
            Home
          </Link>
          <Link as={RouterLink} to="/create" fontWeight="medium">
            Create Transaction
          </Link>
        </HStack>

        <Box>
          {!connected ? (
            <Button
              colorScheme="blue"
              size="sm"
              onClick={connect}
              isLoading={connecting}
              loadingText="Connecting"
            >
              Connect Wallet
            </Button>
          ) : (
            <Menu>
              <MenuButton as={Button} size="sm" colorScheme="blue">
                <HStack>
                  <Text>
                    {accountAddress &&
                      `${accountAddress.slice(0, 6)}...${accountAddress.slice(
                        -4
                      )}`}
                  </Text>
                  <Badge colorScheme="green">Connected</Badge>
                </HStack>
              </MenuButton>
              <MenuList>
                <MenuItem onClick={disconnect}>Disconnect</MenuItem>
              </MenuList>
            </Menu>
          )}
        </Box>
      </Flex>
    </Box>
  );
};

export default Navbar;
