// Test account presets — NOT a server file, safe to import anywhere
export interface TestAccountPreset {
  label: string;
  accountNumber: string;
  ownerName: string;
  arrears: number;
  currentBill: number;
  outstandingAmt: number;
}

export const TEST_ACCOUNT_PRESETS: TestAccountPreset[] = [
  { label: 'Pablo — Arrears + Current Bill', accountNumber: 'KKDA03991002', ownerName: 'Pablo', arrears: 0.50, currentBill: 0.50, outstandingAmt: 1.00 },
  { label: 'Pablo — Arrears Only (no current bill)', accountNumber: 'KKDA03991002', ownerName: 'Pablo', arrears: 0.50, currentBill: 0.00, outstandingAmt: 0.50 },
  { label: 'Pablo — Current Bill Only (no arrears)', accountNumber: 'KKDA03991002', ownerName: 'Pablo', arrears: 0.00, currentBill: 0.50, outstandingAmt: 0.50 },
  { label: 'Pablo — Fully Cleared (GH₵ 0.00)', accountNumber: 'KKDA03991002', ownerName: 'Pablo', arrears: 0.00, currentBill: 0.00, outstandingAmt: 0.00 },
];
