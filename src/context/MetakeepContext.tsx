import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { MetaKeep } from "metakeep";
import { defaultRateLimiter } from "../utils/rateLimiting";

/**
 * ExtendedMetaKeep Interface
 *
 * Defines the shape of the MetaKeep SDK instance with optional methods
 * to handle API differences between SDK versions. This approach allows
 * our application to work with different versions of the MetaKeep SDK.
 */
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
interface MetaKeepContextType {
  metaKeep: MetaKeep | null; // The MetaKeep SDK instance
  loading: boolean; // Loading state during initialization
  error: string | null; // Error message if something goes wrong
  connecting: boolean; // Indicates wallet connection in progress
  connected: boolean; // Indicates if wallet is connected
  accountAddress: string | null; // Connected wallet address
  connect: () => Promise<void>; // Function to connect wallet
  disconnect: () => Promise<void>; // Function to disconnect wallet
}

/**
 * Create the MetaKeep context with default values
 */
const MetaKeepContext = createContext<MetaKeepContextType>({
  metaKeep: null,
  loading: false,
  error: null,
  connecting: false,
  connected: false,
  accountAddress: null,
  connect: async () => {},
  disconnect: async () => {},
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
  const [metaKeep, setMetaKeep] = useState<MetaKeep | null>(null);
  // Loading state during initialization
  const [loading, setLoading] = useState<boolean>(true);
  // Error state for any errors that occur
  const [error, setError] = useState<string | null>(null);
  // State for connection in progress
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

        // Create a new MetaKeep instance with configuration
        const metaKeepInstance = new MetaKeep({
          appId,
          chainId: Number(process.env.REACT_APP_CHAIN_ID || "137"),
          rpcNodeUrls: {
            137:
              process.env.REACT_APP_NETWORK_RPC_URL ||
              "https://polygon-rpc.com",
          },
        });

        console.log("MetaKeep instance created:", metaKeepInstance);
        setMetaKeep(metaKeepInstance);

        // Check if the user is already connected using multiple fallback methods
        let isConnected = false;
        try {
          if (typeof (metaKeepInstance as any).isConnected === "function") {
            // Preferred method if available
            isConnected = await (metaKeepInstance as any).isConnected();
          } else if (
            typeof (metaKeepInstance as any).getAddress === "function"
          ) {
            // Fallback: Try to get address, if successful, we're connected
            const address = await (metaKeepInstance as any).getAddress();
            isConnected = !!address;
          } else if (
            (metaKeepInstance as any).address ||
            (metaKeepInstance as any).defaultAccount
          ) {
            // Fallback: Check if address or defaultAccount properties exist
            isConnected = true;
          }
        } catch (e) {
          console.error("Error checking connection:", e);
        }

        console.log("MetaKeep isConnected:", isConnected);
        setConnected(isConnected);

        // If connected, get the account address using multiple fallback methods
        if (isConnected) {
          try {
            let accounts: string[] = [];
            if (typeof (metaKeepInstance as any).getAccounts === "function") {
              // Preferred method if available
              accounts = await (metaKeepInstance as any).getAccounts();
            } else if (
              typeof (metaKeepInstance as any).getAddress === "function"
            ) {
              // Fallback: Try to get address directly
              const address = await (metaKeepInstance as any).getAddress();
              accounts = address ? [address] : [];
            } else {
              // Fallback: Get from metaKeep.address or defaultAccount properties
              const address =
                (metaKeepInstance as any).address ||
                (metaKeepInstance as any).defaultAccount;
              accounts = address ? [address] : [];
            }

            console.log("MetaKeep accounts:", accounts);
            if (accounts && accounts.length > 0) {
              setAccountAddress(accounts[0]);
            }
          } catch (accountErr) {
            console.error("Error getting accounts:", accountErr);
          }
        }
      } catch (err) {
        console.error("Failed to initialize MetaKeep:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Unknown error initializing MetaKeep"
        );
      } finally {
        setLoading(false);
      }
    };

    initializeMetaKeep();
  }, []);

  /**
   * Connect to the MetaKeep wallet
   * Uses multiple fallback methods to handle different SDK versions
   */
  const connect = async () => {
    if (!metaKeep) return;

    try {
      // Check rate limit before connecting
      if (!defaultRateLimiter.checkRateLimit()) {
        throw new Error(`Rate limit exceeded. Please try again later.`);
      }

      console.log("MetaKeep connect: Attempting to connect wallet");
      setConnecting(true);

      // Try different connection methods based on what's available
      if (typeof (metaKeep as any).connect === "function") {
        // Preferred method if available
        await (metaKeep as any).connect();
        console.log("MetaKeep connect: Connection successful via connect()");
      } else {
        // Alternative approach if connect() is not available
        console.log(
          "MetaKeep connect: connect() not found, trying alternative approach"
        );

        // Try to trigger a transaction to prompt wallet connection
        if (typeof (metaKeep as any).signMessage === "function") {
          try {
            // First try the object form of signMessage
            await (metaKeep as any).signMessage({
              message: "Connect to application",
              reason: "Wallet connection",
            });
          } catch (signErr) {
            console.error("Error with object form signMessage:", signErr);
            // Try the parameter form if object form fails
            await (metaKeep as any).signMessage(
              "Connect to application",
              "Wallet connection"
            );
          }
        }

        console.log("MetaKeep connect: Connection triggered via signMessage");
      }

      setConnected(true);

      // Get the account address after connection using multiple fallback methods
      try {
        let accounts: string[] = [];
        if (typeof (metaKeep as any).getAccounts === "function") {
          // Preferred method if available
          accounts = await (metaKeep as any).getAccounts();
        } else if (typeof (metaKeep as any).getAddress === "function") {
          // Fallback: Try to get address directly
          const address = await (metaKeep as any).getAddress();
          accounts = address ? [address] : [];
        } else {
          // Fallback: Get from metaKeep.address or defaultAccount properties
          const address =
            (metaKeep as any).address || (metaKeep as any).defaultAccount;
          accounts = address ? [address] : [];
        }

        console.log("MetaKeep connect: Retrieved accounts", accounts);
        if (accounts && accounts.length > 0) {
          setAccountAddress(accounts[0]);
        }
      } catch (accountErr) {
        console.error("MetaKeep connect: Error getting accounts:", accountErr);
      }
    } catch (err) {
      console.error("Connection error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unknown error connecting to MetaKeep"
      );
      throw err;
    } finally {
      setConnecting(false);
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

  // Provide the MetaKeep context to children components
  return (
    <MetaKeepContext.Provider
      value={{
        metaKeep,
        loading,
        error,
        connecting,
        connected,
        accountAddress,
        connect,
        disconnect,
      }}
    >
      {children}
    </MetaKeepContext.Provider>
  );
};
