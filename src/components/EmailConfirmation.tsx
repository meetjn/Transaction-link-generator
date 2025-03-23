import React, { useState } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  FormErrorMessage,
  FormHelperText,
  Input,
  VStack,
  Checkbox,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Box,
  Text,
} from "@chakra-ui/react";

interface EmailConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (email: string) => void;
  isLoading?: boolean;
}

/**
 * EmailConfirmation Component
 *
 * Modal component that collects user email for transaction verification
 * and obtains explicit consent before proceeding with a transaction.
 *
 * Features:
 * - Email validation
 * - Consent checkbox
 * - Clear error states
 * - Loading state handling
 */
const EmailConfirmation: React.FC<EmailConfirmationProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}) => {
  // State for email input and validation
  const [email, setEmail] = useState<string>("meetjaiin@gmail.com");
  const [emailError, setEmailError] = useState<string | null>(null);

  // State for consent checkbox
  const [consent, setConsent] = useState<boolean>(true);
  const [consentError, setConsentError] = useState<boolean>(false);

  // Email validation regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  // Handle email change with validation
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);

    // Clear error when user starts typing
    if (emailError) {
      setEmailError(null);
    }
  };

  // Handle consent checkbox change
  const handleConsentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConsent(e.target.checked);

    // Clear error when user checks the box
    if (consentError) {
      setConsentError(false);
    }
  };

  // Reset form state when modal is closed
  const handleClose = () => {
    setEmail("meetjaiin@gmail.com");
    setEmailError(null);
    setConsent(true);
    setConsentError(false);
    onClose();
  };

  // Validate and submit the form
  const handleSubmit = () => {
    let valid = true;

    // Validate email
    if (!email.trim()) {
      setEmailError("Email is required");
      valid = false;
    } else if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address");
      valid = false;
    }

    // Validate consent
    if (!consent) {
      setConsentError(true);
      valid = false;
    }

    // If validation passes, call the onConfirm function
    if (valid) {
      onConfirm(email);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Confirm Transaction</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Alert status="info" borderRadius="md">
              <AlertIcon />
              <Box>
                <AlertTitle>Email Verification Required</AlertTitle>
                <AlertDescription>
                  For security, MetaKeep requires email verification before
                  executing this transaction.
                </AlertDescription>
              </Box>
            </Alert>

            <FormControl isInvalid={!!emailError}>
              <FormLabel>Email Address</FormLabel>
              <Input
                type="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="Enter your email address"
              />
              {emailError ? (
                <FormErrorMessage>{emailError}</FormErrorMessage>
              ) : (
                <FormHelperText>
                  You'll receive a verification email to confirm this
                  transaction.
                </FormHelperText>
              )}
            </FormControl>

            <FormControl isInvalid={consentError}>
              <Checkbox
                isChecked={consent}
                onChange={handleConsentChange}
                colorScheme="blue"
              >
                I consent to using my email for transaction verification
              </Checkbox>
              {consentError && (
                <FormErrorMessage>You must consent to proceed</FormErrorMessage>
              )}
            </FormControl>

            <Box mt={2}>
              <Text fontSize="sm" color="gray.600">
                By proceeding, you agree to receive an email with a verification
                link. You'll need to click this link to authorize the
                transaction on the blockchain.
              </Text>
            </Box>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" mr={3} onClick={handleClose}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleSubmit}
            isLoading={isLoading}
            loadingText="Processing"
          >
            Confirm & Send Verification
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default EmailConfirmation;
