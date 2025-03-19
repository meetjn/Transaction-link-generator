import React, { useState } from "react";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  VStack,
  Heading,
  useToast,
  Text,
  Divider,
  NumberInput,
  NumberInputField,
  FormHelperText,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from "@chakra-ui/react";
import { AbiFunction, TransactionDetails } from "../types";

interface FunctionSelectorProps {
  contractAddress: string;
  abi: AbiFunction[];
  chainId: number;
  rpcUrl: string;
  onFunctionSubmit: (transactionDetails: TransactionDetails) => void;
}

const FunctionSelector: React.FC<FunctionSelectorProps> = ({
  contractAddress,
  abi,
  chainId,
  rpcUrl,
  onFunctionSubmit,
}) => {
  const [selectedFunction, setSelectedFunction] = useState<string>("");
  const [functionParams, setFunctionParams] = useState<any[]>([]);
  const [valueInEth, setValueInEth] = useState<string>("");
  const toast = useToast();

  // Filter functions that are callable (not pure/view)
  const writeFunctions = abi.filter(
    (func) =>
      func.stateMutability !== "pure" &&
      func.stateMutability !== "view" &&
      func.constant !== true
  );

  // Filter for read-only functions
  const readFunctions = abi.filter(
    (func) =>
      func.stateMutability === "pure" ||
      func.stateMutability === "view" ||
      func.constant === true
  );

  const handleFunctionChange = (functionName: string) => {
    setSelectedFunction(functionName);
    // Reset params when function changes
    const func = abi.find((f) => f.name === functionName);
    if (func) {
      setFunctionParams(Array(func.inputs.length).fill(""));
    } else {
      setFunctionParams([]);
    }

    // Reset value
    setValueInEth("");
  };

  const handleParamChange = (index: number, value: string) => {
    const newParams = [...functionParams];
    newParams[index] = value;
    setFunctionParams(newParams);
  };

  const convertParamToType = (param: string, type: string) => {
    if (type.includes("int")) {
      return param === "" ? 0 : Number(param);
    } else if (type === "bool") {
      return param === "true";
    } else if (type.includes("[]")) {
      try {
        return JSON.parse(param);
      } catch (e) {
        return [];
      }
    } else {
      return param;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFunction) {
      toast({
        title: "Error",
        description: "Please select a function",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const func = abi.find((f) => f.name === selectedFunction);
    if (!func) {
      toast({
        title: "Error",
        description: "Function not found in ABI",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    // Convert params to their appropriate types
    const typedParams = func.inputs.map((input, index) => {
      return convertParamToType(functionParams[index] || "", input.type);
    });

    const transactionDetails: TransactionDetails = {
      contractAddress,
      abi,
      chainId,
      rpcUrl,
      functionName: selectedFunction,
      functionParams: typedParams,
    };

    // Add value if it's provided and function is payable
    if (valueInEth && func.stateMutability === "payable") {
      transactionDetails.value = valueInEth;
    }

    onFunctionSubmit(transactionDetails);
  };

  return (
    <Box as="form" onSubmit={handleSubmit} width="100%">
      <VStack spacing={6} align="stretch">
        <Heading size="md">Select Contract Function</Heading>

        <FormControl isRequired>
          <FormLabel>Function</FormLabel>
          <Select
            placeholder="Select function"
            value={selectedFunction}
            onChange={(e) => handleFunctionChange(e.target.value)}
          >
            <optgroup label="Write Functions">
              {writeFunctions.map((func) => (
                <option key={func.name} value={func.name}>
                  {func.name}{" "}
                  {func.stateMutability === "payable" ? "(payable)" : ""}
                </option>
              ))}
            </optgroup>
            <optgroup label="Read Functions">
              {readFunctions.map((func) => (
                <option key={func.name} value={func.name}>
                  {func.name} (readonly)
                </option>
              ))}
            </optgroup>
          </Select>
        </FormControl>

        {selectedFunction && (
          <>
            <Divider />
            <Heading size="sm">Function Parameters</Heading>

            {abi
              .find((f) => f.name === selectedFunction)
              ?.inputs.map((input, index) => (
                <FormControl key={`${input.name}-${index}`}>
                  <FormLabel>
                    {input.name || `param${index}`} ({input.type})
                  </FormLabel>
                  <Input
                    placeholder={`Enter ${input.type}`}
                    value={functionParams[index] || ""}
                    onChange={(e) => handleParamChange(index, e.target.value)}
                  />
                  {input.type.includes("[]") && (
                    <FormHelperText>
                      Enter as JSON array: [1, 2, 3]
                    </FormHelperText>
                  )}
                </FormControl>
              ))}

            {abi.find((f) => f.name === selectedFunction)?.stateMutability ===
              "payable" && (
              <FormControl>
                <FormLabel>Amount to Send (ETH)</FormLabel>
                <NumberInput
                  value={valueInEth}
                  onChange={(valueString) => setValueInEth(valueString)}
                  min={0}
                  precision={18}
                >
                  <NumberInputField placeholder="0.0" />
                </NumberInput>
                <FormHelperText>
                  Optional: Amount of ETH to send with the transaction
                </FormHelperText>
              </FormControl>
            )}
          </>
        )}

        {selectedFunction && (
          <Accordion allowToggle>
            <AccordionItem>
              <h2>
                <AccordionButton>
                  <Box flex="1" textAlign="left">
                    <Text fontWeight="bold">Function Details</Text>
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
              </h2>
              <AccordionPanel pb={4}>
                {abi
                  .find((f) => f.name === selectedFunction)
                  ?.outputs?.map((output, index) => (
                    <Text key={index}>
                      Output {index}: {output.name} ({output.type})
                    </Text>
                  ))}
                <Text mt={2}>
                  State Mutability:{" "}
                  {
                    abi.find((f) => f.name === selectedFunction)
                      ?.stateMutability
                  }
                </Text>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        )}

        <Button
          type="submit"
          colorScheme="green"
          size="lg"
          isDisabled={!selectedFunction}
        >
          Generate Transaction Link
        </Button>
      </VStack>
    </Box>
  );
};

export default FunctionSelector;
