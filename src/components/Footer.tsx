import React from "react";
import {
  Box,
  Container,
  Stack,
  Text,
  Link,
  useColorModeValue,
} from "@chakra-ui/react";

const Footer: React.FC = () => {
  return (
    <Box
      bg={useColorModeValue("gray.50", "gray.900")}
      color={useColorModeValue("gray.700", "gray.200")}
      mt="auto"
      py={4}
    >
      <Container
        as={Stack}
        maxW="container.xl"
        direction={{ base: "column", md: "row" }}
        spacing={4}
        justify={{ base: "center", md: "space-between" }}
        align={{ base: "center", md: "center" }}
      >
        <Text>
          Built with{" "}
          <Link href="https://docs.metakeep.xyz" isExternal color="blue.500">
            MetaKeep SDK
          </Link>
        </Text>
        <Text>
          App ID:{" "}
          {process.env.REACT_APP_APP_ID ||
            "3122c75e-8650-4a47-8376-d1dda7ef8c58"}
        </Text>
      </Container>
    </Box>
  );
};

export default Footer;
