import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { MetaKeep } from "metakeep";
import { defaultRateLimiter } from "../utils/rateLimiting";

// Define interface without extending MetaKeep to avoid conflicts
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

interface MetaKeepContextType {
  metaKeep: MetaKeep | null;
  loading: boolean;
  error: string | null;
  connecting: boolean;
  connected: boolean;
  accountAddress: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

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

export const useMetaKeep = () => useContext(MetaKeepContext);

interface MetaKeepProviderProps {
  children: ReactNode;
}

export const MetaKeepProvider: React.FC<MetaKeepProviderProps> = ({
  children,
}) => {
  const [metaKeep, setMetaKeep] = useState<MetaKeep | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [connected, setConnected] = useState<boolean>(false);
  const [accountAddress, setAccountAddress] = useState<string | null>(null);
  const [transactionTimestamps, setTransactionTimestamps] = useState<number[]>(
    []
  );

  // Rate limiting constants
  const MAX_TRANSACTIONS_PER_MINUTE = 10;
  const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

  // Rate limiting check function
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

        // Check if the user is already connected
        let isConnected = false;
        try {
          if (typeof (metaKeepInstance as any).isConnected === "function") {
            isConnected = await (metaKeepInstance as any).isConnected();
          } else if (
            typeof (metaKeepInstance as any).getAddress === "function"
          ) {
            const address = await (metaKeepInstance as any).getAddress();
            isConnected = !!address;
          } else if (
            (metaKeepInstance as any).address ||
            (metaKeepInstance as any).defaultAccount
          ) {
            isConnected = true;
          }
        } catch (e) {
          console.error("Error checking connection:", e);
        }

        console.log("MetaKeep isConnected:", isConnected);
        setConnected(isConnected);

        if (isConnected) {
          try {
            let accounts: string[] = [];
            if (typeof (metaKeepInstance as any).getAccounts === "function") {
              accounts = await (metaKeepInstance as any).getAccounts();
            } else if (
              typeof (metaKeepInstance as any).getAddress === "function"
            ) {
              // Try alternative method
              const address = await (metaKeepInstance as any).getAddress();
              accounts = address ? [address] : [];
            } else {
              // Get from metaKeep.address if it exists
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

  const connect = async () => {
    if (!metaKeep) return;

    try {
      // Check rate limit before connecting
      if (!defaultRateLimiter.checkRateLimit()) {
        throw new Error(`Rate limit exceeded. Please try again later.`);
      }

      console.log("MetaKeep connect: Attempting to connect wallet");
      setConnecting(true);

      // Check if connect method exists
      if (typeof (metaKeep as any).connect === "function") {
        await (metaKeep as any).connect();
        console.log("MetaKeep connect: Connection successful via connect()");
      } else {
        // Alternative approach based on documentation
        console.log(
          "MetaKeep connect: connect() not found, trying alternative approach"
        );

        // Try to trigger a transaction to prompt wallet connection
        if (typeof (metaKeep as any).signMessage === "function") {
          try {
            // First try the object form
            await (metaKeep as any).signMessage({
              message: "Connect to application",
              reason: "Wallet connection",
            });
          } catch (signErr) {
            console.error("Error with object form signMessage:", signErr);
            // Try the parameter form
            await (metaKeep as any).signMessage(
              "Connect to application",
              "Wallet connection"
            );
          }
        }

        console.log("MetaKeep connect: Connection triggered via signMessage");
      }

      setConnected(true);

      // If we got here, we can try to get accounts
      try {
        let accounts: string[] = [];
        if (typeof (metaKeep as any).getAccounts === "function") {
          accounts = await (metaKeep as any).getAccounts();
        } else if (typeof (metaKeep as any).getAddress === "function") {
          // Try alternative method
          const address = await (metaKeep as any).getAddress();
          accounts = address ? [address] : [];
        } else {
          // Get from metaKeep.address if it exists
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

  const disconnect = async () => {
    if (!metaKeep) return;

    try {
      // Check if disconnect method exists
      if (typeof (metaKeep as any).disconnect === "function") {
        await (metaKeep as any).disconnect();
        console.log("MetaKeep: Disconnected via disconnect()");
      } else {
        // If there's no explicit disconnect, we'll just clear the state
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
