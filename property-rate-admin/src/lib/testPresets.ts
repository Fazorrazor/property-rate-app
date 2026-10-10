// Test account configurations and presets for Sandbox verification
export interface TestPropertyItem {
  accountNumber: string;
  digitalAddress: string;
  defaultArrears: number;
  defaultCurrentBill: number;
  classification: string;
}

export interface TestAccountConfig {
  id: string;
  name: string;
  phone: string;
  category: 'SINGLE' | 'MULTI' | 'MOMO_KYC';
  categoryLabel: string;
  description: string;
  badgeDescription: string;
  properties: TestPropertyItem[];
}

export const TEST_ACCOUNTS: TestAccountConfig[] = [
  {
    id: 'pablo-single',
    name: 'Pablo',
    phone: '0206882328',
    category: 'SINGLE',
    categoryLabel: 'Single Property Account',
    description: 'Baseline residential ratepayer cadastre for individual checkout & bill simulation.',
    badgeDescription: '1 Cadastre',
    properties: [
      {
        accountNumber: 'KKDA03991002',
        digitalAddress: 'GK-0020-8714',
        defaultArrears: 0.50,
        defaultCurrentBill: 0.50,
        classification: 'RESIDENTIAL',
      },
    ],
  },
  {
    id: 'heinz-multi',
    name: 'Heinz',
    phone: '0209067556',
    category: 'MULTI',
    categoryLabel: 'Multi-Property Portfolio',
    description: 'Portfolio holding 5 linked municipal properties for multi-account checkout & portfolio switching.',
    badgeDescription: '5 Linked Properties',
    properties: [
      {
        accountNumber: 'KKDA03001001',
        digitalAddress: 'GK-0021-6459',
        defaultArrears: 450.00,
        defaultCurrentBill: 150.00,
        classification: 'RESIDENTIAL',
      },
      {
        accountNumber: 'KKDA03001002',
        digitalAddress: 'GK-0021-9472',
        defaultArrears: 450.00,
        defaultCurrentBill: 150.00,
        classification: 'RESIDENTIAL',
      },
      {
        accountNumber: 'KKDA03001005',
        digitalAddress: 'GK-0021-9066',
        defaultArrears: 450.00,
        defaultCurrentBill: 150.00,
        classification: 'RESIDENTIAL',
      },
      {
        accountNumber: 'KKDA03001015',
        digitalAddress: 'GK-0021-8575',
        defaultArrears: 450.00,
        defaultCurrentBill: 150.00,
        classification: 'RESIDENTIAL',
      },
      {
        accountNumber: 'KKDA03991001',
        digitalAddress: 'GK-0020-8713',
        defaultArrears: 0.00,
        defaultCurrentBill: 0.00,
        classification: 'RESIDENTIAL',
      },
    ],
  },
  {
    id: 'mesuna-kyc',
    name: 'Mesuna Sumaila (Kelan Inusah)',
    phone: '0242679721',
    category: 'MOMO_KYC',
    categoryLabel: 'Live MoMo KYC Account',
    description: 'Live mobile subscriber SIM verified via Paystack Account Resolution API for real transaction tests.',
    badgeDescription: 'Paystack MoMo Verified',
    properties: [
      {
        accountNumber: 'KKDA03043018',
        digitalAddress: 'GK-0020-8710',
        defaultArrears: 750.00,
        defaultCurrentBill: 250.00,
        classification: 'COMMERCIAL',
      },
    ],
  },
];

// Backward-compatible preset type
export interface TestAccountPreset {
  label: string;
  scenarioName: string;
  description: string;
  accountNumber: string;
  ownerName: string;
  arrears: number;
  currentBill: number;
  outstandingAmt: number;
}

export const TEST_ACCOUNT_PRESETS: TestAccountPreset[] = [
  {
    label: 'Pablo — Arrears + Current Bill',
    scenarioName: 'Full Assessment',
    description: 'Carried arrears plus active current fiscal fee',
    accountNumber: 'KKDA03991002',
    ownerName: 'Pablo',
    arrears: 0.50,
    currentBill: 0.50,
    outstandingAmt: 1.00,
  },
  {
    label: 'Pablo — Arrears Only',
    scenarioName: 'Arrears Debt Only',
    description: 'Outstanding arrears debt with zero current bill',
    accountNumber: 'KKDA03991002',
    ownerName: 'Pablo',
    arrears: 0.50,
    currentBill: 0.00,
    outstandingAmt: 0.50,
  },
  {
    label: 'Pablo — Current Bill Only',
    scenarioName: 'Current Assessment Only',
    description: 'Clean slate with current annual rate fee only',
    accountNumber: 'KKDA03991002',
    ownerName: 'Pablo',
    arrears: 0.00,
    currentBill: 0.50,
    outstandingAmt: 0.50,
  },
  {
    label: 'Pablo — Fully Cleared (GH₵ 0.00)',
    scenarioName: 'Zero Balance / Cleared',
    description: 'Fully reconciled account with no outstanding balance',
    accountNumber: 'KKDA03991002',
    ownerName: 'Pablo',
    arrears: 0.00,
    currentBill: 0.00,
    outstandingAmt: 0.00,
  },
];
