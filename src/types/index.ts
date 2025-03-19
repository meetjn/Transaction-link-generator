export interface AbiFunction {
  name: string;
  type: string;
  stateMutability?: string;
  constant?: boolean;
  inputs: AbiParameter[];
  outputs?: AbiParameter[];
}

export interface AbiParameter {
  name: string;
  type: string;
  components?: AbiParameter[];
}

export interface ContractConfig {
  address: string;
  abi: AbiFunction[];
  chainId: number;
  rpcUrl: string;
}

export interface TransactionDetails {
  contractAddress: string;
  abi: AbiFunction[];
  chainId: number;
  rpcUrl: string;
  functionName: string;
  functionParams: any[];
  value?: string;
}

export interface SavedTransaction {
  id: string;
  transactionDetails: TransactionDetails;
  createdAt: string;
  createdBy?: string;
  description?: string;
}