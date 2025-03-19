import React, { useState } from "react";
import {
  Box,
  Container,
  Stepper,
  Step,
  StepIndicator,
  StepStatus,
  StepIcon,
  StepNumber,
  StepTitle,
  StepDescription,
  StepSeparator,
  Heading,
  useDisclosure,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  useToast,
  Text,
  Input,
  InputGroup,
  InputRightElement,
  Flex,
  useColorModeValue,
  Spinner,
  VStack,
  Divider,
  Textarea,
  FormControl,
  FormLabel,
} from "@chakra-ui/react";
import { AbiFunction, TransactionDetails } from "../types";
import ContractForm from "../components/ContractForm";
import FunctionSelector from "../components/FunctionSelector";
import { useMetaKeep } from "../context/MetakeepContext";
import { v4 as uuidv4 } from "uuid";

const CreateTransactionPage: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [contractInfo, setContractInfo] = useState<{
    address: string;
    abi: AbiFunction[];
    chainId: number;
    rpcUrl: string;
  } | null>(null);
  const [transactionDetails, setTransactionDetails] =
    useState<TransactionDetails | null>(null);
  const [transactionId, setTransactionId] = useState<string>("");
  const [transactionDescription, setTransactionDescription] =
    useState<string>("");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [transactionLink, setTransactionLink] = useState<string>("");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const { connected, connect, loading: connectLoading } = useMetaKeep();
  const bgColor = useColorModeValue("white", "gray.700");

  const steps = [
    { title: "Smart Contract", description: "Contract Details" },
    { title: "Function", description: "Select Function & Parameters" },
    { title: "Share", description: "Generate Shareable Link" },
  ];

  const handleContractSubmit = (info: {
    address: string;
    abi: AbiFunction[];
    chainId: number;
    rpcUrl: string;
  }) => {
    setContractInfo(info);
    setActiveStep(1);
  };

  const handleFunctionSubmit = (details: TransactionDetails) => {
    setTransactionDetails(details);
    setTransactionId(uuidv4());
    setActiveStep(2);
  };

  const handleGenerateLink = async () => {
    if (!connected) {
      try {
        await connect();
        // Return here and let the UI update with the connected state
        // The user can press the button again after connecting
        return;
      } catch (err) {
        console.error("Error connecting wallet:", err);
        toast({
          title: "Connection Error",
          description: "Failed to connect wallet. Check console for details.",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
        return;
      }
    }

    if (!transactionDetails || !transactionId) {
      toast({
        title: "Error",
        description: "Transaction details or ID missing",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setGeneratingLink(true);

    try {
      // Save transaction details to storage
      const savedTransaction = {
        id: transactionId,
        transactionDetails: transactionDetails,
        createdAt: new Date().toISOString(),
        description: transactionDescription,
      };

      // In a real app, you'd send this to your backend
      // For now, we'll store it in localStorage as a demo
      const savedTransactions = JSON.parse(
        localStorage.getItem("savedTransactions") || "[]"
      );
      savedTransactions.push(savedTransaction);
      localStorage.setItem(
        "savedTransactions",
        JSON.stringify(savedTransactions)
      );

      // Generate shareable link
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/execute/${transactionId}`;
      setTransactionLink(link);
      onOpen();
    } catch (error) {
      console.error("Error generating link:", error);
      toast({
        title: "Error",
        description: "Failed to generate transaction link",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(transactionLink);
    toast({
      title: "Copied!",
      description: "Link copied to clipboard",
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  };

  const goBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  // Render button based on connection status
  const renderActionButton = () => {
    if (!connected) {
      return (
        <Button
          colorScheme="blue"
          size="lg"
          onClick={async () => {
            console.log("Connect button clicked");
            try {
              await connect();
              console.log("Connect function completed");
            } catch (err) {
              console.error("Connect error:", err);
              toast({
                title: "Connection Error",
                description:
                  "Failed to connect wallet. Check console for details.",
                status: "error",
                duration: 3000,
                isClosable: true,
              });
            }
          }}
          isLoading={connectLoading}
          loadingText="Connecting..."
          mt={4}
        >
          Connect Wallet
        </Button>
      );
    }

    return (
      <Button
        colorScheme="green"
        size="lg"
        onClick={handleGenerateLink}
        isLoading={generatingLink}
        loadingText="Generating..."
        mt={4}
      >
        Generate Link
      </Button>
    );
  };

  return (
    <Container maxW="container.md" py={8}>
      <Heading as="h1" size="xl" mb={8} textAlign="center">
        Create Transaction Link
      </Heading>

      <Stepper index={activeStep} colorScheme="blue" mb={8} size="lg">
        {steps.map((step, index) => (
          <Step key={index}>
            <StepIndicator>
              <StepStatus
                complete={<StepIcon />}
                incomplete={<StepNumber />}
                active={<StepNumber />}
              />
            </StepIndicator>
            <Box flexShrink={0}>
              <StepTitle>{step.title}</StepTitle>
              <StepDescription>{step.description}</StepDescription>
            </Box>
            <StepSeparator />
          </Step>
        ))}
      </Stepper>

      <Box bg={bgColor} p={6} borderRadius="lg" boxShadow="md" mb={6}>
        {activeStep === 0 && (
          <ContractForm onContractSubmit={handleContractSubmit} />
        )}

        {activeStep === 1 && contractInfo && (
          <FunctionSelector
            contractAddress={contractInfo.address}
            abi={contractInfo.abi}
            chainId={contractInfo.chainId}
            rpcUrl={contractInfo.rpcUrl}
            onFunctionSubmit={handleFunctionSubmit}
          />
        )}

        {activeStep === 2 && (
          <VStack spacing={6} align="stretch">
            <Heading size="md">Transaction Details</Heading>

            <Text fontWeight="bold">Contract Address:</Text>
            <Text wordBreak="break-all">
              {transactionDetails?.contractAddress}
            </Text>

            <Text fontWeight="bold">Function:</Text>
            <Text>{transactionDetails?.functionName}</Text>

            <Text fontWeight="bold">Parameters:</Text>
            <Text wordBreak="break-all">
              {JSON.stringify(transactionDetails?.functionParams || [])}
            </Text>

            <Divider />

            <FormControl>
              <FormLabel>Transaction Description (Optional)</FormLabel>
              <Textarea
                value={transactionDescription}
                onChange={(e) => setTransactionDescription(e.target.value)}
                placeholder="Add a description for this transaction to help users understand its purpose..."
              />
            </FormControl>

            {renderActionButton()}
          </VStack>
        )}
      </Box>

      {activeStep > 0 && (
        <Button variant="outline" onClick={goBack} mt={4}>
          Back
        </Button>
      )}

      <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Your Transaction Link</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb={4}>
              Share this link with users to execute this transaction:
            </Text>
            <InputGroup size="md" mb={4}>
              <Input value={transactionLink} isReadOnly pr="4.5rem" />
              <InputRightElement width="4.5rem">
                <Button h="1.75rem" size="sm" onClick={copyToClipboard}>
                  Copy
                </Button>
              </InputRightElement>
            </InputGroup>

            {transactionDescription && (
              <Box mt={4}>
                <Text fontWeight="bold">Description:</Text>
                <Text>{transactionDescription}</Text>
              </Box>
            )}

            <Box mt={4}>
              <Text fontWeight="bold">Transaction ID:</Text>
              <Text wordBreak="break-all">{transactionId}</Text>
            </Box>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
};

export default CreateTransactionPage;
