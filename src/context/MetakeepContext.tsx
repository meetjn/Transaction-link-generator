import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { defaultRateLimiter } from "../utils/rateLimiting";
import {
  handleConsentFlow,
  isConsentRequiredError,
} from "../utils/metakeepHelpers";

// Define window extensions for MetaKeep
declare global {
  interface Window {
    metaKeep?: any;
    ethereum?: any;
    MetaKeep?: any; // Constructor for MetaKeep
  }
}

/**
 * ExtendedMetaKeep Interface
 *
 * Defines the shape of the MetaKeep SDK instance with optional methods
 * to handle API differences between SDK versions. This approach allows
 * our application to work with different versions of the MetaKeep SDK.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ExtendedMetaKeep {
  isConnected?: () => Promise<boolean>;
  getAccounts?: () => Promise<string[]>;
  getAddress?: () => Promise<string>;
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
  switchChain?: (chainId: number) => Promise<void>;
  signTransaction: (
    options:
      | {
          transactionObject: any;
          reason: string;
        }
      | any,
    from?: string
  ) => Promise<
    | {
        signature: string;
        signedRawTransaction: string;
        transactionHash: string;
      }
    | string
  >;
  signMessage?: (options: {
    message: string;
    reason: string;
  }) => Promise<any> | ((message: string, reason: string) => Promise<any>);
  chainId: number;
  defaultAccount?: string;
  address?: string;
}

/**
 * MetaKeepContextType Interface
 *
 * Defines the shape of the context value that will be provided
 * to components using the useMetaKeep hook.
 */
export interface MetaKeepContextType {
  sdk: any | null;
  metaKeep: any | null; // Alias for compatibility
  loading: boolean;
  error: string | null;
  connecting: boolean;
  connected: boolean;
  accountAddress: string | null;
  connect: (userEmail?: string) => Promise<void>;
  disconnect: () => void;
  processConsent: (consentToken: string) => Promise<any>;
  signMessage: (
    messageOrOptions: string | { message: string; [key: string]: any }
  ) => Promise<any>;
}

/**
 * Create the MetaKeep context with default values
 */
const MetaKeepContext = createContext<MetaKeepContextType>({
  sdk: null,
  metaKeep: null, // Alias for compatibility
  loading: false,
  error: null,
  connecting: false,
  connected: false,
  accountAddress: null,
  connect: async () => {},
  disconnect: () => {},
  processConsent: async () => {},
  signMessage: async () => {},
});

/**
 * Custom hook to access the MetaKeep context
 * @returns The MetaKeep context value
 */
export const useMetaKeep = () => useContext(MetaKeepContext);

/**
 * Props for the MetaKeepProvider component
 */
interface MetaKeepProviderProps {
  children: ReactNode;
}

/**
 * MetaKeepProvider Component
 *
 * Provides MetaKeep wallet functionality to the application.
 * Initializes the MetaKeep SDK, handles wallet connection/disconnection,
 * and manages wallet state.
 */
export const MetaKeepProvider: React.FC<MetaKeepProviderProps> = ({
  children,
}) => {
  // State for the MetaKeep SDK instance
  const [metaKeep, setMetaKeep] = useState<any | null>(null);
  // Loading state during initialization
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [loading, setLoading] = useState<boolean>(true);
  // Error state for any errors that occur
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [error, setError] = useState<string | null>(null);
  // State for connection in progress
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [connecting, setConnecting] = useState<boolean>(false);
  // State for whether wallet is connected
  const [connected, setConnected] = useState<boolean>(false);
  // State for the connected wallet address
  const [accountAddress, setAccountAddress] = useState<string | null>(null);
  // State for tracking transaction timestamps for rate limiting
  const [transactionTimestamps, setTransactionTimestamps] = useState<number[]>(
    []
  );

  // Rate limiting constants
  const MAX_TRANSACTIONS_PER_MINUTE = 10;
  const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

  /**
   * Rate limiting function to prevent abuse
   * Throws an error if the rate limit is exceeded
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const checkRateLimit = () => {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;

    // Remove timestamps outside the current window
    const recentTransactions = transactionTimestamps.filter(
      (timestamp) => timestamp > windowStart
    );

    if (recentTransactions.length >= MAX_TRANSACTIONS_PER_MINUTE) {
      throw new Error(
        `Rate limit exceeded. Maximum ${MAX_TRANSACTIONS_PER_MINUTE} transactions per minute allowed.`
      );
    }

    // Add current timestamp and update state
    setTransactionTimestamps([...recentTransactions, now]);
  };

  /**
   * Initialize the MetaKeep SDK on component mount
   */
  useEffect(() => {
    const initializeMetaKeep = async () => {
      try {
        // Use the App ID from env or fallback to the test App ID
        const appId =
          process.env.REACT_APP_APP_ID ||
          "3122c75e-8650-4a47-8376-d1dda7ef8c58";

        console.log("Initializing MetaKeep with App ID:", appId);

        if (!appId) {
          throw new Error(
            "MetaKeep App ID is not defined in environment variables"
          );
        }

        // Load SDK from CDN if not already loaded
        if (typeof window.MetaKeep !== "function") {
          console.log(
            "MetaKeep constructor not found, loading SDK from CDN..."
          );

          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src =
              "https://cdn.jsdelivr.net/npm/metakeep@2.2.8/lib/index.js";
            script.async = true;
            script.onload = () => {
              console.log("MetaKeep SDK script loaded successfully");
              setTimeout(resolve, 500); // Give time for initialization
            };
            script.onerror = (error) => {
              console.error("Failed to load MetaKeep SDK:", error);
              reject(new Error("Failed to load MetaKeep SDK from CDN"));
            };
            document.body.appendChild(script);
          });
        }

        // Wait a little for script to initialize
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Check again if MetaKeep is available
        if (typeof window.MetaKeep !== "function") {
          throw new Error(
            "MetaKeep SDK could not be loaded. Please try refreshing the page."
          );
        }

        // Initialize with default user info to improve authentication experience
        console.log("Creating MetaKeep instance with AppID:", appId);
        const sdk = new window.MetaKeep({
          appId: appId,
          user: {
            email: "meetjaiin@gmail.com", // Default email for authentication
          },
        });

        console.log("MetaKeep SDK initialized successfully:", sdk);
        setMetaKeep(sdk);
        setLoading(false);
      } catch (err) {
        console.error("Failed to initialize MetaKeep:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Unknown error initializing MetaKeep"
        );
        setLoading(false);
      }
    };

    initializeMetaKeep();
  }, []);

  /**
   * Connect to the MetaKeep wallet
   * Uses multiple fallback methods to handle different SDK versions
   */
  const connect = async (userEmail?: string) => {
    if (!metaKeep) {
      console.error("MetaKeep SDK not initialized");
      throw new Error("MetaKeep SDK not initialized");
    }

    try {
      // Check rate limit before connecting
      if (!defaultRateLimiter.checkRateLimit()) {
        throw new Error(`Rate limit exceeded. Please try again later.`);
      }

      // First, check if we already have an account address
      if (accountAddress && connected) {
        console.log("Already connected with address:", accountAddress);
        return;
      }

      console.log("Connecting to MetaKeep wallet...");
      setConnecting(true);
      setError(null); // Clear any previous errors

      // Try to initialize with user email if provided
      if (userEmail && userEmail.trim() !== "") {
        console.log("Initializing MetaKeep with user email:", userEmail);
        // Re-initialize SDK with the provided email for better authentication
        try {
          const appId =
            process.env.REACT_APP_APP_ID ||
            "3122c75e-8650-4a47-8376-d1dda7ef8c58";
          const updatedSdk = new window.MetaKeep({
            appId: appId,
            user: {
              email: userEmail,
            },
          });
          console.log("SDK re-initialized with user email");
          setMetaKeep(updatedSdk);

          // Give SDK a moment to initialize
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.warn("Failed to reinitialize SDK with email:", error);
          // Continue with existing SDK instance
        }
      } else {
        // If no email was provided, use a default email
        console.log("Using default email for MetaKeep initialization");
        try {
          const appId =
            process.env.REACT_APP_APP_ID ||
            "3122c75e-8650-4a47-8376-d1dda7ef8c58";
          const updatedSdk = new window.MetaKeep({
            appId: appId,
            user: {
              email: "meetjaiin@gmail.com", // Default email
            },
          });
          console.log("SDK re-initialized with default email");
          setMetaKeep(updatedSdk);

          // Give SDK a moment to initialize
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.warn("Failed to reinitialize SDK with default email:", error);
        }
      }

      // Try getWallet first (primary method for SDK)
      if (typeof metaKeep.getWallet === "function") {
        try {
          console.log("Attempting to get wallet with SDK getWallet method");
          const walletResponse = await metaKeep.getWallet();
          console.log("Wallet response:", walletResponse);

          if (
            walletResponse &&
            walletResponse.wallet &&
            walletResponse.wallet.ethAddress
          ) {
            const address = walletResponse.wallet.ethAddress;
            console.log("Successfully obtained wallet address:", address);
            setAccountAddress(address);
            setConnected(true);
            setConnecting(false);
            return;
          } else {
            console.warn(
              "getWallet succeeded but no wallet address found in response"
            );
          }
        } catch (err) {
          console.error("Error using getWallet:", err);

          // Format error for easier detection of cancellations
          let errMsg = "";
          if (err instanceof Error) {
            errMsg = err.message;
          } else if (typeof err === "object" && err !== null) {
            try {
              errMsg = JSON.stringify(err);
            } catch {
              errMsg = "Unknown error object";
            }
          } else {
            errMsg = String(err);
          }

          // Handle user cancellation
          if (
            errMsg.includes("OPERATION_CANCELLED") ||
            errMsg.includes("cancelled") ||
            errMsg.includes("canceled") ||
            errMsg.includes("denied") ||
            errMsg.includes("rejected") ||
            errMsg.includes("User denied") ||
            errMsg.includes("user closed")
          ) {
            setError("Connection cancelled by user. Please try again.");
            setConnecting(false);
            throw new Error("User cancelled the wallet connection");
          }

          // For other errors, try alternative connection methods
          console.log("Will try alternative connection methods");
        }
      }

      // Try alternative SDK connection method
      if (typeof metaKeep.connect === "function") {
        try {
          console.log("Attempting connection with connect() method");
          await metaKeep.connect();
          console.log("Connect method succeeded, looking for address");

          // Now try to get the address in various ways
          let address = null;

          // Check various properties where address might be found
          if (metaKeep.address) {
            address = metaKeep.address;
          } else if (metaKeep.defaultAccount) {
            address = metaKeep.defaultAccount;
          } else if (typeof metaKeep.getAddress === "function") {
            address = await metaKeep.getAddress();
          } else if (typeof metaKeep.getAccounts === "function") {
            const accounts = await metaKeep.getAccounts();
            address = accounts && accounts.length > 0 ? accounts[0] : null;
          }

          if (address) {
            console.log(
              "Successfully obtained address via connect method:",
              address
            );
            setAccountAddress(address);
            setConnected(true);
            setConnecting(false);
            return;
          } else {
            console.warn("Connected but could not find wallet address");
          }
        } catch (err) {
          console.error("Error using connect method:", err);

          // Format error for easier detection of cancellations
          let errMsg = "";
          if (err instanceof Error) {
            errMsg = err.message;
          } else if (typeof err === "object" && err !== null) {
            try {
              errMsg = JSON.stringify(err);
            } catch {
              errMsg = "Unknown error object";
            }
          } else {
            errMsg = String(err);
          }

          // Handle user cancellation
          if (
            errMsg.includes("OPERATION_CANCELLED") ||
            errMsg.includes("cancelled") ||
            errMsg.includes("canceled") ||
            errMsg.includes("denied") ||
            errMsg.includes("rejected")
          ) {
            setError("Connection cancelled by user. Please try again.");
            setConnecting(false);
            throw new Error("User cancelled the wallet connection");
          }
        }
      }

      // Wait and try one more time to see if connection happened asynchronously
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (!accountAddress) {
        console.log("No address obtained, trying one more time");

        // Try all possible ways to get the address
        let finalAddress = null;

        if (metaKeep.address) {
          finalAddress = metaKeep.address;
        } else if (metaKeep.defaultAccount) {
          finalAddress = metaKeep.defaultAccount;
        } else if (typeof metaKeep.getAddress === "function") {
          try {
            finalAddress = await metaKeep.getAddress();
          } catch (e) {
            console.error("Error in final getAddress attempt:", e);
          }
        } else if (typeof metaKeep.getAccounts === "function") {
          try {
            const accounts = await metaKeep.getAccounts();
            finalAddress = accounts && accounts.length > 0 ? accounts[0] : null;
          } catch (e) {
            console.error("Error in final getAccounts attempt:", e);
          }
        } else if (typeof metaKeep.getWallet === "function") {
          try {
            const wallet = await metaKeep.getWallet();
            finalAddress =
              wallet && wallet.wallet ? wallet.wallet.ethAddress : null;
          } catch (e) {
            console.error("Error in final getWallet attempt:", e);
          }
        }

        if (finalAddress) {
          console.log("Finally obtained address:", finalAddress);
          setAccountAddress(finalAddress);
          setConnected(true);
          setConnecting(false);
          return;
        }
      }

      // If we reached here, we failed to get an address
      setConnecting(false);
      if (!accountAddress) {
        const errorMsg =
          "Failed to obtain wallet address. Please try again with your email address.";
        setError(errorMsg);
        throw new Error(errorMsg);
      }
    } catch (err) {
      console.error("Connection error:", err);

      // Handle specific errors
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unknown error connecting to MetaKeep");
      }

      setConnected(false);
      setConnecting(false);
      throw err;
    }
  };

  /**
   * Process a consent token from a backend API
   * This should be called separately after receiving a consentToken from the backend
   *
   * @param consentToken The consent token received from a backend API
   * @returns The response from the consent operation
   */
  const processConsent = async (consentToken: string) => {
    if (!metaKeep) {
      throw new Error("MetaKeep SDK not initialized");
    }

    if (!consentToken) {
      throw new Error("Consent token is required");
    }

    console.log("Processing consent token:", consentToken);

    try {
      if (typeof (metaKeep as any).getConsent === "function") {
        const consentResponse = await (metaKeep as any).getConsent(
          consentToken
        );
        console.log("Consent successful:", consentResponse);
        return consentResponse;
      } else {
        throw new Error("getConsent method not available in MetaKeep SDK");
      }
    } catch (err) {
      console.error("Error processing consent:", err);
      throw err;
    }
  };

  /**
   * Finalize the connection by setting state and getting the account address
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const finalizeConnection = async (metaKeepInstance: any) => {
    // Set connected state
    setConnected(true);

    // Get the account address using the SDK
    try {
      console.log("Finalizing connection with direct SDK approach");
      let address = null;

      // When working with the direct SDK API, we need to check if the address is available
      // after successful connection

      // Try getting address from properties first (most reliable with SDK)
      if (metaKeepInstance.address) {
        address = metaKeepInstance.address;
        console.log("Using SDK address property:", address);
      } else if (
        metaKeepInstance.accounts &&
        metaKeepInstance.accounts.length > 0
      ) {
        // Some SDK versions expose accounts array directly
        address = metaKeepInstance.accounts[0];
        console.log("Using SDK accounts array:", address);
      } else if (typeof metaKeepInstance.getAccounts === "function") {
        // Try getAccounts if available
        try {
          const accounts = await metaKeepInstance.getAccounts();
          address = accounts && accounts.length > 0 ? accounts[0] : null;
          console.log("Using SDK getAccounts() method:", address);
        } catch (err) {
          console.warn("Error with getAccounts():", err);
        }
      }

      // Set the account address if we found one
      if (address) {
        setAccountAddress(address);
      } else {
        console.warn(
          "Connected but could not find wallet address - this is normal with the SDK API"
        );
        console.warn(
          "The user must create a wallet or verify their identity with MetaKeep"
        );
      }
    } catch (accountErr) {
      console.error("Error getting account address:", accountErr);
      // Don't throw, just log the error and continue with connected=true
    }
  };

  /**
   * Disconnect from the MetaKeep wallet
   * Uses multiple fallback methods to handle different SDK versions
   */
  const disconnect = async () => {
    if (!metaKeep) return;

    try {
      // Try different disconnection methods based on what's available
      if (typeof (metaKeep as any).disconnect === "function") {
        // Preferred method if available
        await (metaKeep as any).disconnect();
        console.log("MetaKeep: Disconnected via disconnect()");
      } else {
        // If there's no explicit disconnect, just clear the state
        console.log(
          "MetaKeep: No disconnect method, clearing local state only"
        );
      }
      setConnected(false);
      setAccountAddress(null);
    } catch (err) {
      console.error("Failed to disconnect from MetaKeep:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unknown error disconnecting from MetaKeep"
      );
    }
  };

  /**
   * Sign a message with MetaKeep
   * @param messageOrOptions - Either a string message to sign, or an object containing message and other options
   * @returns Promise with the signature
   */
  const signMessage = async (
    messageOrOptions: string | { message: string; [key: string]: any }
  ) => {
    try {
      if (!metaKeep) {
        throw new Error("MetaKeep not initialized");
      }

      if (!connected) {
        await connect();
      }

      // Check that signMessage method exists
      if (typeof metaKeep.signMessage !== "function") {
        console.error(
          "metaKeep.signMessage method is not available!",
          metaKeep
        );
        throw new Error(
          "metaKeep.signMessage is not a function. The SDK might not be properly loaded."
        );
      }

      console.log("Signing message with MetaKeep...");

      let message: string;

      // Handle both string messages and object formats
      if (typeof messageOrOptions === "string") {
        message = messageOrOptions;
        console.log("Signing message:", message);
      } else if (messageOrOptions && typeof messageOrOptions === "object") {
        message = messageOrOptions.message;
        console.log("Signing message from object:", message);
      } else {
        throw new Error(
          "Invalid message format: must be a string or an object with a message property"
        );
      }

      // Following the documentation pattern
      const response = await metaKeep.signMessage(message);
      console.log("Sign message response:", response);

      // Return signature if the operation was successful
      if (response && response.status === "SUCCESS" && response.signature) {
        return response.signature;
      } else {
        throw new Error(
          `Invalid signature response: ${JSON.stringify(response)}`
        );
      }
    } catch (error) {
      console.error("Error signing message with MetaKeep:", error);
      throw error;
    }
  };

  // Provide the MetaKeep context to children components
  return (
    <MetaKeepContext.Provider
      value={{
        sdk: metaKeep,
        metaKeep, // Provide both for compatibility
        loading,
        error,
        connecting,
        connected,
        accountAddress,
        connect,
        disconnect,
        processConsent,
        signMessage,
      }}
    >
      {children}
    </MetaKeepContext.Provider>
  );
};
