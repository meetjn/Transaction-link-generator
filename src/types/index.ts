/**
 * Type definitions for the MetaKeep transaction link application
 * These interfaces define the core data structures used throughout the application
 */

/**
 * Represents a function in a smart contract ABI
 * 
 * Contains all the metadata needed to interact with a smart contract function,
 * including its name, inputs, outputs, and state mutability.
 */
export interface AbiFunction {
  name: string;              // Name of the function
  type: string;              // Type ("function", "constructor", etc.)
  stateMutability?: string;  // "pure", "view", "nonpayable", "payable"
  constant?: boolean;        // Legacy compatibility for older ABIs
  inputs: AbiParameter[];    // Array of function input parameters
  outputs?: AbiParameter[];  // Array of function output parameters
}

/**
 * Represents a parameter in a smart contract function
 * 
 * Used for both inputs and outputs in function calls.
 */
export interface AbiParameter {
  name: string;                // Parameter name
  type: string;                // Solidity type (uint256, address, bool, etc.)
  components?: AbiParameter[]; // For complex types like structs
}

/**
 * Configuration for interacting with a smart contract
 * 
 * Contains all the information needed to connect to a contract.
 */
export interface ContractConfig {
  address: string;       // Contract address on the blockchain
  abi: AbiFunction[];    // Contract ABI (only function entries)
  chainId: number;       // Network chain ID (e.g., 1 for Ethereum, 137 for Polygon)
  rpcUrl: string;        // RPC endpoint URL for the blockchain
}

/**
 * Complete details needed to execute a smart contract transaction
 * 
 * Extends ContractConfig with specific function details.
 */
export interface TransactionDetails {
  contractAddress: string;  // Contract address on the blockchain
  abi: AbiFunction[];       // Contract ABI (only function entries)
  chainId: number;          // Network chain ID
  rpcUrl: string;           // RPC endpoint URL
  functionName: string;     // Name of the function to call
  functionParams: any[];    // Parameters to pass to the function
  value?: string;           // ETH value to send with the transaction (for payable functions)
  email?: string;           // User email for transaction verification
  purpose?: string;         // Human-readable purpose of the transaction
  reason?: string;          // Reason for transaction (needed by MetaKeep API)
  bypassSecurity?: boolean; // Flag to bypass security warnings
}

/**
 * Represents a saved transaction that can be shared and executed later
 * 
 * This is the data structure that gets stored and shared via links.
 */
export interface SavedTransaction {
  id: string;                         // Unique transaction identifier
  transactionDetails: TransactionDetails; // Complete transaction details
  createdAt: string;                  // ISO timestamp of creation
  createdBy?: string;                 // Address of the creator
  description?: string;               // Human-readable description
}