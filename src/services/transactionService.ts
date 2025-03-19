import { TransactionDetails, SavedTransaction } from '../types';

// For simplicity, we'll use localStorage, but in production this would be a backend service
export const saveTransaction = (transactionDetails: TransactionDetails, description?: string): string => {
  const id = generateTransactionId();
  const transaction: SavedTransaction = {
    id,
    transactionDetails,
    createdAt: new Date().toISOString(),
    description
  };
  
  // Get existing transactions or initialize empty array
  const savedTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
  savedTransactions.push(transaction);
  localStorage.setItem('transactions', JSON.stringify(savedTransactions));
  
  return id;
};

export const getTransaction = (id: string): SavedTransaction | null => {
  const savedTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
  const transaction = savedTransactions.find((tx: SavedTransaction) => tx.id === id);
  return transaction || null;
};

export const getShareableLink = (id: string): string => {
  return `${window.location.origin}/execute/${id}`;
};

export const generateTransactionId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// In a real implementation, this would interact with a backend API
export const storeTransactionOnServer = async (transaction: SavedTransaction): Promise<void> => {
  // This is a placeholder for a real API call
  console.log('Storing transaction on server:', transaction);
  
  // Mock implementation for demo purposes
  localStorage.setItem(`tx_${transaction.id}`, JSON.stringify(transaction));
};

export const retrieveTransactionFromServer = async (id: string): Promise<SavedTransaction | null> => {
  // This is a placeholder for a real API call
  console.log('Retrieving transaction from server:', id);
  
  // Mock implementation for demo purposes
  const data = localStorage.getItem(`tx_${id}`);
  return data ? JSON.parse(data) : null;
};