import React from "react";
import {
  Box,
  Heading,
  Text,
  Table,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Code,
  VStack,
} from "@chakra-ui/react";
import { SavedTransaction } from "../types";

interface TransactionDetailsProps {
  transaction: SavedTransaction;
}

const TransactionDetails: React.FC<TransactionDetailsProps> = ({
  transaction,
}) => {
  return (
    <Box p={6} borderWidth="1px" borderRadius="lg">
      <Heading as="h2" size="md" mb={4}>
        Transaction Details
      </Heading>

      <Table variant="simple" size="sm">
        <Tbody>
          <Tr>
            <Th>Contract Address</Th>
            <Td>
              <Code>{transaction.transactionDetails.contractAddress}</Code>
            </Td>
          </Tr>
          <Tr>
            <Th>Function</Th>
            <Td>
              <Code>{transaction.transactionDetails.functionName}</Code>
            </Td>
          </Tr>
          <Tr>
            <Th>Network</Th>
            <Td>
              <Badge colorScheme="blue">
                Chain ID: {transaction.transactionDetails.chainId}
              </Badge>
            </Td>
          </Tr>
          {transaction.transactionDetails.value && (
            <Tr>
              <Th>Value</Th>
              <Td>{transaction.transactionDetails.value} ETH</Td>
            </Tr>
          )}
          <Tr>
            <Th>Parameters</Th>
            <Td>
              <VStack align="stretch" spacing={1}>
                {transaction.transactionDetails.functionParams.map(
                  (param, index) => (
                    <Text key={index} fontSize="sm">
                      {param?.toString() || "Empty"}
                    </Text>
                  )
                )}
              </VStack>
            </Td>
          </Tr>
          <Tr>
            <Th>Created At</Th>
            <Td>{new Date(transaction.createdAt).toLocaleString()}</Td>
          </Tr>
        </Tbody>
      </Table>
    </Box>
  );
};

export default TransactionDetails;
