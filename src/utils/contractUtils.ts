import { ethers } from 'ethers';
import { AbiFunction, AbiParameter, TransactionDetails } from '../types';

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

export const getFunctionState = (func: AbiFunction): string => {
  if (func.stateMutability) {
    return func.stateMutability;
  }
  if (func.constant === true) {
    return 'view';
  }
  return 'nonpayable';
};

export const createContractInterface = (transactionDetails: TransactionDetails) => {
  const { contractAddress, abi, rpcUrl } = transactionDetails;
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, abi, provider);
  return { provider, contract };
};

export const createTransactionData = (
  functionName: string, 
  abi: AbiFunction[], 
  params: any[]
): string => {
  const iface = new ethers.utils.Interface(abi);
  return iface.encodeFunctionData(functionName, params);
};

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

export const parseParamValue = (type: string, value: string): any => {
  if (type.includes('int')) {
    return value.includes('.') ? ethers.utils.parseUnits(value, 18) : ethers.BigNumber.from(value);
  } else if (type === 'address') {
    if (!ethers.utils.isAddress(value)) throw new Error(`Invalid address: ${value}`);
    return value;
  } else if (type === 'bool') {
    return value.toLowerCase() === 'true';
  } else if (type.includes('bytes')) {
    return ethers.utils.arrayify(value);
  } else if (type.includes('string')) {
    return value;
  } else if (type.includes('[]')) {
    try {
      return JSON.parse(value);
    } catch {
      throw new Error(`Invalid array format for param: ${value}`);
    }
  }
  return value;
};