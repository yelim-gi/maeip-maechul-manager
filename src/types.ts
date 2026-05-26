/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TransactionSource = 'card' | 'bank' | 'smartstore' | 'manual';

export interface OCRItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  translatedName?: string;
}

export interface OCRResult {
  partner: string;
  date: string;
  amount: number;
  tax: number;
  shippingFee: number;
  customsFee: number;
  items: OCRItem[];
  recommendedCategory: string;
  originalLanguage?: string;
  rawSummary?: string;
}

export interface Evidence {
  id: string;
  fileName: string;
  fileType: string; // 'pdf' | 'png' | 'jpg' | 'jpeg'
  fileSize: number;
  uploadedAt: string;
  ocrData: OCRResult | null;
  ocrStatus: 'pending' | 'success' | 'failed';
  isMatched: boolean;
  matchedTransactionId: string | null;
  fileDataUrl?: string; // base64 preview or mock preview
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  partner: string;
  amount: number;
  tax: number;
  shippingFee: number;
  customsFee: number;
  category: string;
  source: TransactionSource;
  memo: string;
  evidenceId: string | null; // linked evidence
}

export interface Rule {
  id: string;
  keyword: string;
  category: string;
}

export interface MonthlyStats {
  month: string; // YYYY-MM
  sales: number;
  expenses: number;
  netProfit: number;
  unmatchedTransactions: number;
  documentsCount: number;
}
