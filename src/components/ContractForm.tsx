import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  VStack,
  Heading,
  FormErrorMessage,
  useToast,
  Text,
} from "@chakra-ui/react";
import { AbiFunction } from "../types";

interface ContractFormProps {
  onContractSubmit: (contractInfo: {
    address: string;
    abi: AbiFunction[];
    chainId: number;
    rpcUrl: string;
  }) => void;
}

const ContractForm: React.FC<ContractFormProps> = ({ onContractSubmit }) => {
  const [address, setAddress] = useState("");
  const [abiString, setAbiString] = useState("");
  const [chainId, setChainId] = useState<number>(80002); // Default to Polygon Amoy Testnet
  const [rpcUrl, setRpcUrl] = useState<string>(
    "https://polygon-amoy.g.alchemy.com/v2/dKz6QD3l7WEbD7xKNOhvHQNhjEQrh4gr"
  );
  const [errors, setErrors] = useState<{
    address?: string;
    abi?: string;
    chainId?: string;
    rpcUrl?: string;
  }>({});
  const toast = useToast();

  // Predefined networks
  const networks = [
    {
      id: 1,
      name: "Ethereum Mainnet",
      rpc: "https://mainnet.infura.io/v3/your-project-id",
    },
    { id: 137, name: "Polygon", rpc: "https://polygon-rpc.com" },
    {
      id: 43114,
      name: "Avalanche",
      rpc: "https://api.avax.network/ext/bc/C/rpc",
    },
    { id: 56, name: "BSC", rpc: "https://bsc-dataseed.binance.org" },
    { id: 42161, name: "Arbitrum One", rpc: "https://arb1.arbitrum.io/rpc" },
    { id: 10, name: "Optimism", rpc: "https://mainnet.optimism.io" },
    {
      id: 80002,
      name: "Polygon Amoy Testnet",
      rpc: "https://polygon-amoy.g.alchemy.com/v2/dKz6QD3l7WEbD7xKNOhvHQNhjEQrh4gr",
    },
  ];

  // Update RPC URL when network changes
  useEffect(() => {
    const network = networks.find((n) => n.id === chainId);
    if (network) {
      setRpcUrl(network.rpc);
    }
  }, [chainId]);

  const validateForm = (): boolean => {
    const newErrors: {
      address?: string;
      abi?: string;
      chainId?: string;
      rpcUrl?: string;
    } = {};

    if (!address) {
      newErrors.address = "Contract address is required";
    } else if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      newErrors.address = "Invalid contract address format";
    }

    if (!abiString) {
      newErrors.abi = "ABI is required";
    } else {
      try {
        JSON.parse(abiString);
      } catch (e) {
        newErrors.abi = "Invalid ABI JSON format";
      }
    }

    if (!chainId) {
      newErrors.chainId = "Chain ID is required";
    }

    // We still validate rpcUrl even though the field is hidden
    if (!rpcUrl) {
      newErrors.rpcUrl = "RPC URL is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const parsedAbi = JSON.parse(abiString);

      // Filter for function entries only
      const functionAbi = parsedAbi.filter(
        (item: any) => item.type === "function"
      );

      if (functionAbi.length === 0) {
        toast({
          title: "ABI Error",
          description: "No function entries found in the ABI",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
        return;
      }

      onContractSubmit({
        address,
        abi: functionAbi,
        chainId,
        rpcUrl,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to parse ABI",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <Box as="form" onSubmit={handleSubmit} width="100%">
      <VStack spacing={6} align="stretch">
        <Heading size="md">Contract Details</Heading>

        <FormControl isRequired isInvalid={!!errors.address}>
          <FormLabel>Contract Address</FormLabel>
          <Input
            placeholder="0x..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <FormErrorMessage>{errors.address}</FormErrorMessage>
        </FormControl>

        <FormControl isRequired isInvalid={!!errors.abi}>
          <FormLabel>Contract ABI</FormLabel>
          <Textarea
            placeholder="Paste contract ABI JSON here..."
            value={abiString}
            onChange={(e) => setAbiString(e.target.value)}
            minHeight="200px"
          />
          <FormErrorMessage>{errors.abi}</FormErrorMessage>
        </FormControl>

        <FormControl isRequired isInvalid={!!errors.chainId}>
          <FormLabel>Network</FormLabel>
          <Select
            value={chainId}
            onChange={(e) => setChainId(Number(e.target.value))}
          >
            {networks.map((network) => (
              <option key={network.id} value={network.id}>
                {network.name} ({network.id})
              </option>
            ))}
          </Select>
          <FormErrorMessage>{errors.chainId}</FormErrorMessage>
        </FormControl>

        <Button type="submit" colorScheme="blue" size="lg">
          Continue
        </Button>

        <Text fontSize="sm" color="gray.500">
          Note: The ABI should be the full JSON array from the contract's ABI.
        </Text>
      </VStack>
    </Box>
  );
};

export default ContractForm;
