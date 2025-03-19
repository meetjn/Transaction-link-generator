import { ethers } from 'ethers';
import { AbiFunction, AbiParameter, TransactionDetails } from '../types';

/**
 * Parses an ABI string and extracts only the function entries
 * 
 * @param abiString - JSON string containing the contract ABI
 * @returns Array of AbiFunction objects containing only function entries
 * @throws Error if the ABI format is invalid
 */
export const parseAbi = (abiString: string): AbiFunction[] => {
  try {
    const abiJson = JSON.parse(abiString);
    
    // Filter for function types only
    return abiJson.filter((item: any) => 
      item.type === 'function'
    );
  } catch (error) {
    console.error('Error parsing ABI:', error);
    throw new Error('Invalid ABI format');
  }
};

/**
 * Generates a human-readable function signature from an ABI function entry
 * 
 * @param func - The ABI function object
 * @returns Formatted string representing the function signature (name, inputs, outputs)
 */
export const getReadableFunctionSignature = (func: AbiFunction): string => {
  const inputs = func.inputs.map((input: AbiParameter) => 
    `${input.type} ${input.name || ''}`
  ).join(', ');
  
  const outputs = func.outputs 
    ? func.outputs.map((output: AbiParameter) => 
        `${output.type} ${output.name || ''}`
      ).join(', ') 
    : 'void';

  return `${func.name}(${inputs}) returns (${outputs})`;
};

/**
 * Determines the state mutability of a function (view, pure, nonpayable, payable)
 * 
 * @param func - The ABI function object
 * @returns String representation of the function's state mutability
 */
export const getFunctionState = (func: AbiFunction): string => {
  if (func.stateMutability) {
    return func.stateMutability;
  }
  if (func.constant === true) {
    return 'view';
  }
  return 'nonpayable';
};

/**
 * Creates contract interface objects for interacting with a smart contract
 * 
 * @param transactionDetails - Transaction details containing contract info
 * @returns Object with provider and contract instances
 */
export const createContractInterface = (transactionDetails: TransactionDetails) => {
  const { contractAddress, abi, rpcUrl } = transactionDetails;
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, abi, provider);
  return { provider, contract };
};

/**
 * Creates encoded transaction data for a function call
 * 
 * @param functionName - Name of the function to call
 * @param abi - Array of ABI function objects
 * @param params - Array of parameters to pass to the function
 * @returns Hex string of the encoded function call data
 */
export const createTransactionData = (
  functionName: string, 
  abi: AbiFunction[], 
  params: any[]
): string => {
  const iface = new ethers.utils.Interface(abi);
  return iface.encodeFunctionData(functionName, params);
};

/**
 * Estimates the gas required for a transaction
 * 
 * Adds a 20% buffer to the estimate to account for potential fluctuations.
 * 
 * @param transactionDetails - Complete transaction details
 * @param walletAddress - Address of the wallet executing the transaction
 * @returns Promise resolving to the estimated gas amount as a string
 * @throws Error if gas estimation fails
 */
export const estimateGas = async (
  transactionDetails: TransactionDetails,
  walletAddress: string
): Promise<string> => {
  const { contractAddress, abi, functionName, functionParams, value, rpcUrl } = transactionDetails;
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, abi, provider);

  try {
    const gasEstimate = await provider.estimateGas({
      to: contractAddress,
      from: walletAddress,
      data: createTransactionData(functionName, abi as any, functionParams),
      value: value ? ethers.utils.parseEther(value) : undefined
    });
    
    // Add some buffer (20%) to the gas estimate
    return ethers.BigNumber.from(gasEstimate)
      .mul(120)
      .div(100)
      .toString();
  } catch (error) {
    console.error('Error estimating gas:', error);
    throw new Error('Failed to estimate gas for transaction');
  }
};

/**
 * Parses and converts string input values to their appropriate Solidity types
 * 
 * Handles various Solidity types including:
 * - Integers (int, uint) with proper decimal handling
 * - Addresses with validation
 * - Booleans
 * - Bytes
 * - Strings
 * - Arrays (via JSON parsing)
 * 
 * @param type - Solidity type string (e.g., "uint256", "address", "bool")
 * @param value - String value to be parsed
 * @returns The parsed value in the appropriate format for the given type
 * @throws Error if the value cannot be parsed to the specified type
 */
export const parseParamValue = (type: string, value: string): any => {
  if (type.includes('int')) {
    // Handle integers with or without decimals
    return value.includes('.') ? ethers.utils.parseUnits(value, 18) : ethers.BigNumber.from(value);
  } else if (type === 'address') {
    // Validate and return addresses
    if (!ethers.utils.isAddress(value)) throw new Error(`Invalid address: ${value}`);
    return value;
  } else if (type === 'bool') {
    // Convert string to boolean
    return value.toLowerCase() === 'true';
  } else if (type.includes('bytes')) {
    // Convert hex string to byte array
    return ethers.utils.arrayify(value);
  } else if (type.includes('string')) {
    // String values pass through as-is
    return value;
  } else if (type.includes('[]')) {
    // Parse arrays from JSON strings
    try {
      return JSON.parse(value);
    } catch {
      throw new Error(`Invalid array format for param: ${value}`);
    }
  }
  // Default fallback
  return value;
};