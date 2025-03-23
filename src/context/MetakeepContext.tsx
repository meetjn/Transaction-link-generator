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
          // Specify we want to use Polygon Amoy testnet by default
          chainId: 80002, // Polygon Amoy testnet
          chainConfig: {
            "80002": {
              chainId: "0x13882", // 80002 in hex
              chainName: "Polygon Amoy Testnet",
              nativeCurrency: {
                name: "MATIC",
                symbol: "MATIC",
                decimals: 18,
              },
              rpcUrls: [
                "https://polygon-amoy.g.alchemy.com/v2/dKz6QD3l7WEbD7xKNOhvHQNhjEQrh4gr",
                "https://polygon-amoy.blockpi.network/v1/rpc/public",
                "https://polygon-amoy.g.alchemy.com/v2/demo",
                "https://rpc-amoy.polygon.technology",
                "https://polygon-amoy-sequencer.optimism.io",
              ],
              blockExplorerUrls: ["https://www.oklink.com/amoy"],
            },
          },
        });

        // Enable Web3 provider features if supported
        try {
          if (sdk.enableAsProvider) {
            console.log("Enabling MetaKeep as Web3 provider...");
            sdk.enableAsProvider();
          }
        } catch (providerErr) {
          console.warn("Error enabling MetaKeep as provider:", providerErr);
          // Continue anyway - this is optional functionality
        }

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

    setConnecting(true);
    setError(null);

    try {
      // Re-initialize SDK with the email if provided
      if (userEmail && userEmail !== "meetjaiin@gmail.com") {
        console.log("Re-initializing SDK with provided email:", userEmail);
        const appId =
          process.env.REACT_APP_APP_ID ||
          "3122c75e-8650-4a47-8376-d1dda7ef8c58";

        const updatedSdk = new window.MetaKeep({
          appId: appId,
          user: {
            email: userEmail,
          },
        });

        setMetaKeep(updatedSdk);
        // Brief delay to let SDK initialize
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      console.log("Getting wallet directly as per documentation...");
      try {
        // According to the docs, we should directly call getWallet without parameters
        // This will trigger the user verification process if needed
        const walletResponse = await metaKeep.getWallet();
        console.log("getWallet response:", walletResponse);

        // Check if we received a proper wallet response with an address
        if (
          walletResponse &&
          walletResponse.status === "SUCCESS" &&
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
          console.log("Wallet response format unexpected:", walletResponse);
          // If successful but no wallet, the user might need to complete verification
          if (walletResponse && walletResponse.status === "SUCCESS") {
            throw new Error(
              "Wallet verification may be required. Please check your email."
            );
          } else {
            throw new Error("Could not retrieve wallet. Please try again.");
          }
        }
      } catch (err) {
        console.error("Error in getWallet flow:", err);

        // Specific MetaKeep error handling
        if (typeof err === "object" && err !== null) {
          // If we have a status field, handle specific MetaKeep error codes
          if (err.status) {
            switch (err.status) {
              case "USER_CONSENT_DENIED":
                throw new Error("User denied wallet access request.");
              case "EXPIRED_TOKEN":
                throw new Error(
                  "Authentication token expired. Please try again."
                );
              case "INVALID_REQUEST":
                throw new Error(
                  "Invalid wallet request. Please try with a different email."
                );
              default:
                throw err; // Rethrow other status errors
            }
          }

          // Generic error handling if no status
          if (err.message) {
            throw new Error(err.message);
          }
        }

        // Fallback error handling
        throw err;
      }
    } catch (err) {
      console.error("Wallet connection error:", err);

      // Format error for UI
      let errorMessage: string;
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "object" && err !== null) {
        try {
          errorMessage = JSON.stringify(err);
        } catch (e) {
          errorMessage = "Unknown error format";
        }
      } else {
        errorMessage = String(err);
      }

      setError(errorMessage);
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
      let reason = "Message Signing";

      // Handle both string messages and object formats
      if (typeof messageOrOptions === "string") {
        message = messageOrOptions;
        console.log("Signing message:", message);
      } else if (messageOrOptions && typeof messageOrOptions === "object") {
        message = messageOrOptions.message;
        reason = messageOrOptions.reason || reason;
        console.log("Signing message from object:", message);
      } else {
        throw new Error(
          "Invalid message format: must be a string or an object with a message property"
        );
      }

      // Following the documentation pattern for signMessage
      const response = await metaKeep.signMessage(message, reason);

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
