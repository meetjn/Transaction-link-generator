import React from "react";
import {
  ChakraProvider,
  Box,
  Flex,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from "@chakra-ui/react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import CreateTransactionPage from "./pages/CreateTransactionPages";
import ExecuteTransactionPage from "./pages/ExecuteTransactionPage";
import { MetaKeepProvider, useMetaKeep } from "./context/MetakeepContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import MetaKeepExtensionCheck from "./components/MetaKeepExtensionCheck";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import TransactionStatus from "./components/TransactionStatus";

// Wrapper component to display errors
const MetaKeepErrorHandler: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { error, loading } = useMetaKeep();

  if (loading) {
    return (
      <Box p={6}>
        <Alert status="info">
          <AlertIcon />
          <AlertTitle>Initializing MetaKeep SDK</AlertTitle>
          <AlertDescription>
            Please wait while we connect to the MetaKeep service...
          </AlertDescription>
        </Alert>
      </Box>
    );
  }

  if (error) {
    // First check if it's a MetaKeep SDK loading error
    // which will be handled by the MetaKeepExtensionCheck component
    const isSDKLoadingError =
      error.includes("MetaKeep not found") ||
      error.includes("MetaKeep still not available") ||
      error.includes("Failed to load") ||
      error.includes("MetaKeep SDK") ||
      error.includes("initialize MetaKeep");

    return (
      <Box p={6}>
        <MetaKeepExtensionCheck />
        {!isSDKLoadingError && (
          <Alert status="error">
            <AlertIcon />
            <AlertTitle>MetaKeep Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </Box>
    );
  }

  return <>{children}</>;
};

function App() {
  return (
    <ChakraProvider>
      <MetaKeepProvider>
        <Router>
          <Flex flexDirection="column" minH="100vh">
            <Navbar />
            <Box as="main" pt={6} flex="1">
              <MetaKeepErrorHandler>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/create" element={<CreateTransactionPage />} />
                  <Route
                    path="/execute/:transactionId"
                    element={<ExecuteTransactionPage />}
                  />
                </Routes>
              </MetaKeepErrorHandler>
            </Box>
            <Footer />
          </Flex>
        </Router>
      </MetaKeepProvider>
    </ChakraProvider>
  );
}

export default App;
