export type TableCategory = 'Core Property & Ratepayer' | 'Billing & Payments';

export type ColumnType = 'text' | 'number' | 'currency' | 'date' | 'boolean';
export type ColumnAlign = 'left' | 'right' | 'center';

export interface ColumnDefinition {
  key: string;
  label: string;
  type: ColumnType;
  align: ColumnAlign;
  width?: string;
}

export interface DatabaseTableDefinition {
  id: string;
  name: string;
  label: string;
  category: TableCategory;
  description: string;
  primaryKey: string;
  recordCount?: number;
  defaultSort: {
    column: string;
    ascending: boolean;
  };
  searchColumns: string[];
  columns: ColumnDefinition[];
}

export const DATABASE_TABLE_DEFINITIONS: Record<string, DatabaseTableDefinition> = {
  // =========================================================================
  // 1. CORE PROPERTY & RATEPAYER TABLES (10)
  // =========================================================================
  Property: {
    id: 'Property',
    name: 'Property',
    label: 'Property Roll & Portfolios',
    category: 'Core Property & Ratepayer',
    description: 'Master municipal property cadastre and valuation roll.',
    primaryKey: 'id',
    recordCount: 16020,
    defaultSort: { column: 'account_no', ascending: true },
    searchColumns: ['account_no', 'name', 'telephone', 'houseNo', 'electoral_area'],
    columns: [
      { key: 'account_no', label: 'Account No', type: 'text', align: 'left', width: '140px' },
      { key: 'name', label: 'Ratepayer Name', type: 'text', align: 'left', width: '220px' },
      { key: 'telephone', label: 'Telephone', type: 'text', align: 'left', width: '130px' },
      { key: 'houseNo', label: 'House No', type: 'text', align: 'left', width: '110px' },
      { key: 'electoral_area', label: 'Electoral Area', type: 'text', align: 'left', width: '150px' },
      { key: 'property_cat', label: 'Category', type: 'text', align: 'left', width: '110px' },
      { key: 'rateableValue', label: 'Rateable Value', type: 'currency', align: 'right', width: '140px' },
      { key: 'current_bill', label: 'Current Bill', type: 'currency', align: 'right', width: '130px' },
      { key: 'amount_paid', label: 'Amount Paid', type: 'currency', align: 'right', width: '130px' },
      { key: 'current_arrears', label: 'Arrears', type: 'currency', align: 'right', width: '130px' },
      { key: 'outstanding_amt', label: 'Total Due', type: 'currency', align: 'right', width: '140px' },
    ],
  },

  PropertyOwner: {
    id: 'PropertyOwner',
    name: 'PropertyOwner',
    label: 'Registered Property Owners',
    category: 'Core Property & Ratepayer',
    description: 'Registered ratepayer profiles, phone contacts, and physical addresses.',
    primaryKey: 'ownerId',
    recordCount: 34418,
    defaultSort: { column: 'name', ascending: true },
    searchColumns: ['name', 'mobileNumber', 'tel', 'address', 'email', 'ownerId'],
    columns: [
      { key: 'ownerId', label: 'Owner ID', type: 'text', align: 'left', width: '120px' },
      { key: 'name', label: 'Ratepayer Name', type: 'text', align: 'left', width: '240px' },
      { key: 'mobileNumber', label: 'Mobile Number', type: 'text', align: 'left', width: '140px' },
      { key: 'tel', label: 'Telephone', type: 'text', align: 'left', width: '130px' },
      { key: 'address', label: 'Postal Address', type: 'text', align: 'left', width: '220px' },
      { key: 'streetAddress', label: 'Street Address', type: 'text', align: 'left', width: '200px' },
      { key: 'email', label: 'Email Address', type: 'text', align: 'left', width: '180px' },
      { key: 'corporationPartnership', label: 'Company / Organization', type: 'text', align: 'left', width: '180px' },
    ],
  },

  PropertyTypes: {
    id: 'PropertyTypes',
    name: 'PropertyTypes',
    label: 'Property Type Classifications',
    category: 'Core Property & Ratepayer',
    description: 'Standard classification codes and descriptions for land and property usages.',
    primaryKey: 'code',
    recordCount: 254,
    defaultSort: { column: 'code', ascending: true },
    searchColumns: ['code', 'type', 'gcatId', 'budgetCode'],
    columns: [
      { key: 'code', label: 'Type Code', type: 'text', align: 'left', width: '120px' },
      { key: 'type', label: 'Property Type Description', type: 'text', align: 'left', width: '300px' },
      { key: 'gcatId', label: 'Category Group ID', type: 'text', align: 'left', width: '150px' },
      { key: 'budgetCode', label: 'Budget Code', type: 'text', align: 'left', width: '140px' },
    ],
  },

  PropertyCategorys: {
    id: 'PropertyCategorys',
    name: 'PropertyCategorys',
    label: 'Property Rate Categories',
    category: 'Core Property & Ratepayer',
    description: 'Municipal rating assessment category bands and minimum fee thresholds.',
    primaryKey: 'code',
    recordCount: 5,
    defaultSort: { column: 'code', ascending: true },
    searchColumns: ['code', 'category', 'propertyTypeCode', 'gcatId'],
    columns: [
      { key: 'code', label: 'Category Code', type: 'text', align: 'left', width: '130px' },
      { key: 'ccode', label: 'Class Code', type: 'text', align: 'left', width: '120px' },
      { key: 'category', label: 'Category Description', type: 'text', align: 'left', width: '260px' },
      { key: 'propertyTypeCode', label: 'Property Type Code', type: 'text', align: 'left', width: '160px' },
      { key: 'minCharge', label: 'Minimum Charge', type: 'currency', align: 'right', width: '150px' },
      { key: 'gcatId', label: 'Group ID', type: 'text', align: 'left', width: '130px' },
    ],
  },

  Property11: {
    id: 'Property11',
    name: 'Property11',
    label: 'Division 11 Cadastre Properties',
    category: 'Core Property & Ratepayer',
    description: 'Division 11 specialized property cadastre entries and valuation metrics.',
    primaryKey: 'accountNumber',
    recordCount: 0,
    defaultSort: { column: 'accountNumber', ascending: true },
    searchColumns: ['accountNumber', 'ownerId', 'houseNo', 'division'],
    columns: [
      { key: 'accountNumber', label: 'Account No', type: 'text', align: 'left', width: '140px' },
      { key: 'ownerId', label: 'Owner ID', type: 'text', align: 'left', width: '130px' },
      { key: 'houseNo', label: 'House No', type: 'text', align: 'left', width: '120px' },
      { key: 'division', label: 'Division', type: 'text', align: 'left', width: '120px' },
      { key: 'propertyTypeCode', label: 'Type Code', type: 'text', align: 'left', width: '130px' },
      { key: 'propertyCategoryCode', label: 'Category Code', type: 'text', align: 'left', width: '140px' },
      { key: 'rateableValue', label: 'Rateable Value', type: 'currency', align: 'right', width: '150px' },
      { key: 'dateAdded', label: 'Date Added', type: 'date', align: 'left', width: '140px' },
    ],
  },

  Division_11_P: {
    id: 'Division_11_P',
    name: 'Division_11_P',
    label: 'Division 11 Spatial Addresses',
    category: 'Core Property & Ratepayer',
    description: 'Spatial addresses, GhanaPost GPS codes, house numbers, and street references.',
    primaryKey: 'valuation_',
    recordCount: 2138,
    defaultSort: { column: 'valuation_', ascending: true },
    searchColumns: ['valuation_', 'DigitalAdd', 'DisplayNam', 'HouseNo', 'St_Name'],
    columns: [
      { key: 'valuation_', label: 'Valuation Code', type: 'text', align: 'left', width: '150px' },
      { key: 'DigitalAdd', label: 'Digital Address (GPS)', type: 'text', align: 'left', width: '170px' },
      { key: 'DisplayNam', label: 'Display Landmark Name', type: 'text', align: 'left', width: '220px' },
      { key: 'HouseNo', label: 'House No', type: 'text', align: 'left', width: '120px' },
      { key: 'St_Name', label: 'Street Name', type: 'text', align: 'left', width: '180px' },
      { key: 'stcode', label: 'Street Code', type: 'number', align: 'left', width: '110px' },
      { key: 'Longitude', label: 'Longitude', type: 'number', align: 'right', width: '130px' },
      { key: 'Latitude', label: 'Latitude', type: 'text', align: 'right', width: '130px' },
    ],
  },

  tPremise: {
    id: 'tPremise',
    name: 'tPremise',
    label: 'Premise Types',
    category: 'Core Property & Ratepayer',
    description: 'Building premise and occupancy categorization taxonomy.',
    primaryKey: 'id',
    recordCount: 6,
    defaultSort: { column: 'id', ascending: true },
    searchColumns: ['id', 'premiseType'],
    columns: [
      { key: 'id', label: 'Premise ID', type: 'text', align: 'left', width: '120px' },
      { key: 'premiseType', label: 'Premise Classification', type: 'text', align: 'left', width: '320px' },
    ],
  },

  tOccupants: {
    id: 'tOccupants',
    name: 'tOccupants',
    label: 'Occupant Registry',
    category: 'Core Property & Ratepayer',
    description: 'Registered tenancy and occupant designations.',
    primaryKey: 'id',
    recordCount: 1,
    defaultSort: { column: 'id', ascending: true },
    searchColumns: ['id', 'occupants'],
    columns: [
      { key: 'id', label: 'Occupant ID', type: 'text', align: 'left', width: '120px' },
      { key: 'occupants', label: 'Occupant Designation', type: 'text', align: 'left', width: '320px' },
    ],
  },

  tConstructionMaterial: {
    id: 'tConstructionMaterial',
    name: 'tConstructionMaterial',
    label: 'Construction Materials',
    category: 'Core Property & Ratepayer',
    description: 'Structural and engineering construction material types.',
    primaryKey: 'id',
    recordCount: 0,
    defaultSort: { column: 'id', ascending: true },
    searchColumns: ['id', 'material'],
    columns: [
      { key: 'id', label: 'Material ID', type: 'text', align: 'left', width: '120px' },
      { key: 'material', label: 'Construction Material Description', type: 'text', align: 'left', width: '320px' },
    ],
  },

  'OWNER$': {
    id: 'OWNER$',
    name: 'OWNER$',
    label: 'Legacy Owner Archive (OWNER$)',
    category: 'Core Property & Ratepayer',
    description: 'Historical owner records and legacy contact information from legacy system.',
    primaryKey: 'id',
    recordCount: 628,
    defaultSort: { column: 'name', ascending: true },
    searchColumns: ['id', 'name', 'mobileNumber', 'tel', 'address', 'email'],
    columns: [
      { key: 'id', label: 'Legacy ID', type: 'text', align: 'left', width: '120px' },
      { key: 'name', label: 'Owner Name', type: 'text', align: 'left', width: '240px' },
      { key: 'mobileNumber', label: 'Mobile Number', type: 'text', align: 'left', width: '140px' },
      { key: 'tel', label: 'Telephone', type: 'text', align: 'left', width: '130px' },
      { key: 'address', label: 'Postal Address', type: 'text', align: 'left', width: '220px' },
      { key: 'streetAddress', label: 'Street Address', type: 'text', align: 'left', width: '180px' },
      { key: 'email', label: 'Email', type: 'text', align: 'left', width: '160px' },
      { key: 'corporationPartnership', label: 'Company / Partner', type: 'text', align: 'left', width: '180px' },
    ],
  },

  // =========================================================================
  // 2. BILLING & PAYMENTS TABLES (10)
  // =========================================================================
  Bill: {
    id: 'Bill',
    name: 'Bill',
    label: 'Account Multi-Year Bills & Registry',
    category: 'Billing & Payments',
    description: 'Search accounts by GPS, account no, or name to view all assessment bills across all recorded years.',
    primaryKey: 'id',
    recordCount: 61263,
    defaultSort: { column: 'accountNo', ascending: true },
    searchColumns: ['accountNo', 'billYear', 'gcatId', 'preparedBy'],
    columns: [
      { key: 'accountNo', label: 'Account No', type: 'text', align: 'left', width: '140px' },
      { key: 'billYear', label: 'Bill Year', type: 'number', align: 'center', width: '100px' },
      { key: 'rateableValue', label: 'Rateable Value', type: 'currency', align: 'right', width: '140px' },
      { key: 'ratePA', label: 'Rate PA', type: 'number', align: 'right', width: '110px' },
      { key: 'balanceBF', label: 'Balance B/F', type: 'currency', align: 'right', width: '130px' },
      { key: 'accountBalance', label: 'Account Balance', type: 'currency', align: 'right', width: '140px' },
      { key: 'billDate', label: 'Bill Date', type: 'date', align: 'left', width: '120px' },
      { key: 'printed', label: 'Printed', type: 'boolean', align: 'center', width: '90px' },
      { key: 'preparedBy', label: 'Prepared By', type: 'text', align: 'left', width: '140px' },
      { key: 'gcatId', label: 'Group ID', type: 'text', align: 'left', width: '110px' },
    ],
  },

  BillSettings: {
    id: 'BillSettings',
    name: 'BillSettings',
    label: 'Billing Settings & Parameters',
    category: 'Billing & Payments',
    description: 'Global municipal billing configuration, decimal rules, and coordinator parameters.',
    primaryKey: 'id',
    recordCount: 4,
    defaultSort: { column: 'id', ascending: true },
    searchColumns: ['coordinatorsNumber', 'collectorLocation', 'gcatId'],
    columns: [
      { key: 'id', label: 'Setting ID', type: 'text', align: 'left', width: '120px' },
      { key: 'coordinatorsNumber', label: 'Coordinator Contact', type: 'text', align: 'left', width: '180px' },
      { key: 'collectorLocation', label: 'Collector Location', type: 'text', align: 'left', width: '170px' },
      { key: 'ratePADecimalPlaces', label: 'Decimal Places', type: 'number', align: 'center', width: '130px' },
      { key: 'autogenerateCode', label: 'Auto-Generate Code', type: 'boolean', align: 'center', width: '150px' },
      { key: 'pmtDate', label: 'Payment Due Date', type: 'date', align: 'left', width: '150px' },
      { key: 'gcatId', label: 'Group ID', type: 'text', align: 'left', width: '120px' },
    ],
  },

  tmpbill: {
    id: 'tmpbill',
    name: 'tmpbill',
    label: 'Provisional Billing Staging (tmpbill)',
    category: 'Billing & Payments',
    description: 'Staged provisional rate bills prior to final ledger publication.',
    primaryKey: 'id',
    recordCount: 140,
    defaultSort: { column: 'accountNo', ascending: true },
    searchColumns: ['accountNo', 'billYear', 'preparedBy', 'gcatId'],
    columns: [
      { key: 'accountNo', label: 'Account No', type: 'text', align: 'left', width: '140px' },
      { key: 'billYear', label: 'Bill Year', type: 'number', align: 'center', width: '100px' },
      { key: 'rateableValue', label: 'Rateable Value', type: 'currency', align: 'right', width: '140px' },
      { key: 'ratePA', label: 'Rate PA', type: 'number', align: 'right', width: '110px' },
      { key: 'imposeRate', label: 'Imposed Rate', type: 'currency', align: 'right', width: '130px' },
      { key: 'balanceBF', label: 'Balance B/F', type: 'currency', align: 'right', width: '130px' },
      { key: 'accountBalance', label: 'Account Balance', type: 'currency', align: 'right', width: '140px' },
      { key: 'totalPaid', label: 'Total Paid', type: 'currency', align: 'right', width: '130px' },
      { key: 'billDate', label: 'Bill Date', type: 'date', align: 'left', width: '120px' },
      { key: 'preparedBy', label: 'Prepared By', type: 'text', align: 'left', width: '140px' },
    ],
  },

  FeePayments: {
    id: 'FeePayments',
    name: 'FeePayments',
    label: 'Revenue Collections & Receipts',
    category: 'Billing & Payments',
    description: 'Payment receipts, cashier allocations, GCR numbers, and settlement archives.',
    primaryKey: 'id',
    recordCount: 830,
    defaultSort: { column: 'datePaid', ascending: false },
    searchColumns: ['accountNo', 'gcrNr', 'collectorsCollectorId', 'cashiersCashierId', 'pmtMode'],
    columns: [
      { key: 'accountNo', label: 'Account No', type: 'text', align: 'left', width: '140px' },
      { key: 'gcrNr', label: 'GCR Receipt No', type: 'text', align: 'left', width: '160px' },
      { key: 'amtPaid', label: 'Amount Paid', type: 'currency', align: 'right', width: '140px' },
      { key: 'arrearsPd', label: 'Arrears Portion', type: 'currency', align: 'right', width: '130px' },
      { key: 'curAmtPd', label: 'Current Bill Portion', type: 'currency', align: 'right', width: '140px' },
      { key: 'pmtMode', label: 'Payment Mode', type: 'text', align: 'left', width: '130px' },
      { key: 'datePaid', label: 'Date Paid', type: 'date', align: 'left', width: '130px' },
      { key: 'collectorsCollectorId', label: 'Collector ID', type: 'text', align: 'left', width: '140px' },
      { key: 'cashiersCashierId', label: 'Cashier ID', type: 'text', align: 'left', width: '130px' },
    ],
  },

  FixedFees: {
    id: 'FixedFees',
    name: 'FixedFees',
    label: 'Fixed Fees & Tariff Schedules',
    category: 'Billing & Payments',
    description: 'Established municipal tariff rates, license fees, and standard rate parameters.',
    primaryKey: 'id',
    recordCount: 2993,
    defaultSort: { column: 'propertyCatCode', ascending: true },
    searchColumns: ['propertyCatCode', 'propertyTypeCode', 'gcatId'],
    columns: [
      { key: 'id', label: 'Fee ID', type: 'text', align: 'left', width: '120px' },
      { key: 'yYear', label: 'Year', type: 'number', align: 'center', width: '90px' },
      { key: 'propertyCatCode', label: 'Category Code', type: 'text', align: 'left', width: '140px' },
      { key: 'propertyTypeCode', label: 'Type Code', type: 'text', align: 'left', width: '130px' },
      { key: 'ratePA', label: 'Rate PA', type: 'number', align: 'right', width: '120px' },
      { key: 'minCharge', label: 'Minimum Charge', type: 'currency', align: 'right', width: '140px' },
      { key: 'gcatId', label: 'Group ID', type: 'text', align: 'left', width: '110px' },
    ],
  },

  FixedFees11: {
    id: 'FixedFees11',
    name: 'FixedFees11',
    label: 'Division 11 Fixed Fees',
    category: 'Billing & Payments',
    description: 'Division 11 specialized fixed fee schedule tables and tariffs.',
    primaryKey: 'id',
    recordCount: 0,
    defaultSort: { column: 'propertyCatCode', ascending: true },
    searchColumns: ['propertyCatCode', 'propertyTypeCode', 'gcatId'],
    columns: [
      { key: 'id', label: 'Fee ID', type: 'text', align: 'left', width: '120px' },
      { key: 'yYear', label: 'Year', type: 'number', align: 'center', width: '90px' },
      { key: 'propertyCatCode', label: 'Category Code', type: 'text', align: 'left', width: '140px' },
      { key: 'propertyTypeCode', label: 'Type Code', type: 'text', align: 'left', width: '130px' },
      { key: 'ratePA', label: 'Rate PA', type: 'number', align: 'right', width: '120px' },
      { key: 'minCharge', label: 'Minimum Charge', type: 'currency', align: 'right', width: '140px' },
      { key: 'gcatId', label: 'Group ID', type: 'text', align: 'left', width: '110px' },
    ],
  },

  Ff2020: {
    id: 'Ff2020',
    name: 'Ff2020',
    label: '2020 Fixed Fee Tariffs (Ff2020)',
    category: 'Billing & Payments',
    description: 'Historical fixed fee rates and tariff schedule baseline from 2020.',
    primaryKey: 'id',
    recordCount: 1024,
    defaultSort: { column: 'propertyCatCode', ascending: true },
    searchColumns: ['propertyCatCode', 'propertyTypeCode', 'gcatId'],
    columns: [
      { key: 'id', label: 'Fee ID', type: 'text', align: 'left', width: '120px' },
      { key: 'yYear', label: 'Year', type: 'number', align: 'center', width: '90px' },
      { key: 'propertyCatCode', label: 'Category Code', type: 'text', align: 'left', width: '140px' },
      { key: 'propertyTypeCode', label: 'Type Code', type: 'text', align: 'left', width: '130px' },
      { key: 'ratePA', label: 'Rate PA', type: 'number', align: 'right', width: '120px' },
      { key: 'minCharge', label: 'Minimum Charge', type: 'currency', align: 'right', width: '140px' },
      { key: 'gcatId', label: 'Group ID', type: 'text', align: 'left', width: '110px' },
    ],
  },

  AdjustArrears: {
    id: 'AdjustArrears',
    name: 'AdjustArrears',
    label: 'Arrears Ledger Adjustments',
    category: 'Billing & Payments',
    description: 'Authorized adjustments, waivers, and corrections applied to arrears balances.',
    primaryKey: 'id',
    recordCount: 137,
    defaultSort: { column: 'date', ascending: false },
    searchColumns: ['accountNo', 'adjustedBy', 'gcatId'],
    columns: [
      { key: 'accountNo', label: 'Account No', type: 'text', align: 'left', width: '150px' },
      { key: 'billYear', label: 'Bill Year', type: 'number', align: 'center', width: '100px' },
      { key: 'amount', label: 'Adjustment Amount', type: 'currency', align: 'right', width: '150px' },
      { key: 'date', label: 'Adjustment Date', type: 'date', align: 'left', width: '140px' },
      { key: 'adjustedBy', label: 'Authorized Officer', type: 'text', align: 'left', width: '160px' },
      { key: 'gcatId', label: 'Group ID', type: 'text', align: 'left', width: '120px' },
    ],
  },

  DefaultersList: {
    id: 'DefaultersList',
    name: 'DefaultersList',
    label: 'Defaulters & Arrears Roll',
    category: 'Billing & Payments',
    description: 'Comprehensive municipal ledger of delinquent accounts and outstanding arrears.',
    primaryKey: 'id',
    recordCount: 206683,
    defaultSort: { column: 'accountNo', ascending: true },
    searchColumns: ['accountNo', 'gcatId'],
    columns: [
      { key: 'accountNo', label: 'Account No', type: 'text', align: 'left', width: '160px' },
      { key: 'billYear', label: 'Bill Year', type: 'number', align: 'center', width: '110px' },
      { key: 'accountBalance', label: 'Account Balance', type: 'currency', align: 'right', width: '160px' },
      { key: 'currentBalance', label: 'Current Arrears Balance', type: 'currency', align: 'right', width: '180px' },
      { key: 'gcatId', label: 'Category Group ID', type: 'text', align: 'left', width: '140px' },
    ],
  },

  tAssessmentType: {
    id: 'tAssessmentType',
    name: 'tAssessmentType',
    label: 'Assessment Types Classification',
    category: 'Billing & Payments',
    description: 'Municipal valuation assessment classification taxonomy.',
    primaryKey: 'id',
    recordCount: 0,
    defaultSort: { column: 'id', ascending: true },
    searchColumns: ['id', 'assessmentType'],
    columns: [
      { key: 'id', label: 'Assessment ID', type: 'text', align: 'left', width: '140px' },
      { key: 'assessmentType', label: 'Assessment Classification', type: 'text', align: 'left', width: '320px' },
    ],
  },
};

export const ORDERED_TABLE_GROUPS: { category: TableCategory; tables: DatabaseTableDefinition[] }[] = [
  {
    category: 'Core Property & Ratepayer',
    tables: [
      DATABASE_TABLE_DEFINITIONS.Property,
      DATABASE_TABLE_DEFINITIONS.PropertyOwner,
      DATABASE_TABLE_DEFINITIONS.PropertyTypes,
      DATABASE_TABLE_DEFINITIONS.PropertyCategorys,
      DATABASE_TABLE_DEFINITIONS.Property11,
      DATABASE_TABLE_DEFINITIONS.Division_11_P,
      DATABASE_TABLE_DEFINITIONS.tPremise,
      DATABASE_TABLE_DEFINITIONS.tOccupants,
      DATABASE_TABLE_DEFINITIONS.tConstructionMaterial,
      DATABASE_TABLE_DEFINITIONS['OWNER$'],
    ],
  },
  {
    category: 'Billing & Payments',
    tables: [
      DATABASE_TABLE_DEFINITIONS.Bill,
      DATABASE_TABLE_DEFINITIONS.BillSettings,
      DATABASE_TABLE_DEFINITIONS.tmpbill,
      DATABASE_TABLE_DEFINITIONS.FeePayments,
      DATABASE_TABLE_DEFINITIONS.FixedFees,
      DATABASE_TABLE_DEFINITIONS.FixedFees11,
      DATABASE_TABLE_DEFINITIONS.Ff2020,
      DATABASE_TABLE_DEFINITIONS.AdjustArrears,
      DATABASE_TABLE_DEFINITIONS.DefaultersList,
      DATABASE_TABLE_DEFINITIONS.tAssessmentType,
    ],
  },
];
