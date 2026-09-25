/**
 * Corporate CSV & Excel Export Engine for Kpone-Katamanso Municipal Assembly (KKMA)
 * Adheres to MMDA / Corporate financial standards:
 * 1. UTF-8 Byte Order Mark (\uFEFF) for 100% native Microsoft Excel character compatibility (renders GH₵ cleanly).
 * 2. Corporate Metadata Header Banner (authority, date, officer, filter scope, financial summary).
 * 3. Excel-safe numeric & text formatting (preserves leading zero on phone numbers e.g. ="0244123456").
 * 4. RFC-4180 compliant CSV escaping.
 * 5. Full Linked Accounts Hierarchy (clustering multi-property owners by phone & name).
 */

import {
  AdminProperty,
  AdminRatepayerSummary,
  AdminTreasuryReceipt,
  AdminAuditLogItem,
  SmsRolloutLogItem,
  RatepayerHistoryDossier,
  AdminPaidUserRecord,
} from "@/app/actions";

export interface CsvReportMetadata {
  reportTitle: string;
  subtitle?: string;
  filterScope?: string;
  generatedBy?: string;
  recordCount: number;
  financialSummary?: {
    totalValuation?: number;
    totalArrears?: number;
    totalDue?: number;
    totalCollected?: number;
  };
}

/**
 * Escapes a single CSV field according to RFC-4180.
 * If preserveTextAsFormula is true, formats string as ="value" so Excel does not drop leading zeros or convert to exponential.
 */
export function formatCsvCell(
  value: any,
  options?: { preserveTextAsFormula?: boolean; isCurrency?: boolean }
): string {
  if (value === null || value === undefined) {
    return '""';
  }

  if (typeof value === "number") {
    if (isNaN(value)) return '""';
    return value.toFixed(2);
  }

  const str = String(value).trim();

  // Excel text formula preservation for phone numbers or alphanumeric codes with leading zeros
  if (options?.preserveTextAsFormula && str) {
    const escaped = str.replace(/"/g, '""');
    return `="""${escaped}"""`;
  }

  // Standard RFC-4180 quoting
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Generates an executive corporate banner for Microsoft Excel / CSV spreadsheets.
 */
export function buildCorporateHeader(metadata: CsvReportMetadata): string[] {
  const timestampUtc = new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC";
  const officer = metadata.generatedBy || "Authorized Revenue Officer";
  const scope = metadata.filterScope || "All Active Municipal Records";

  const lines: string[] = [
    '"===================================================================================================="',
    '"KPONE-KATAMANSO MUNICIPAL ASSEMBLY (KKMA) - REVENUE GOVERNANCE SYSTEM"',
    `"REPORT: ${metadata.reportTitle.toUpperCase()}"`,
    `"GENERATED AT: ${timestampUtc} | OFFICER: ${officer}"`,
    `"SCOPE / ACTIVE FILTERS: ${scope}"`,
    `"TOTAL RECORDS AUDITED: ${metadata.recordCount}"`,
  ];

  if (metadata.financialSummary) {
    const parts: string[] = [];
    if (metadata.financialSummary.totalValuation !== undefined) {
      parts.push(`Total Valuation: GHS ${metadata.financialSummary.totalValuation.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    }
    if (metadata.financialSummary.totalArrears !== undefined) {
      parts.push(`Total Arrears: GHS ${metadata.financialSummary.totalArrears.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    }
    if (metadata.financialSummary.totalDue !== undefined) {
      parts.push(`Total Outstanding Due: GHS ${metadata.financialSummary.totalDue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    }
    if (metadata.financialSummary.totalCollected !== undefined) {
      parts.push(`Total Revenue Collected: GHS ${metadata.financialSummary.totalCollected.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    }
    if (parts.length > 0) {
      lines.push(`"FINANCIAL AGGREGATES: ${parts.join(" | ")}"`);
    }
  }

  lines.push('"===================================================================================================="');
  lines.push('""'); // Empty separator line before table header
  return lines;
}

/**
 * Downloads a CSV string as a file using Blob and UTF-8 BOM (\uFEFF)
 */
export function downloadCsvFile(filename: string, csvString: string): void {
  // UTF-8 Byte Order Mark (\uFEFF) forces Excel to open with proper UTF-8 decoding
  const blob = new Blob(["\uFEFF", csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Normalizes phone numbers for reliable multi-property portfolio cross-referencing.
 */
function normalizePhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12) {
    return "0" + digits.slice(3);
  }
  return digits;
}

/**
 * Normalizes citizen names for fuzzy linking.
 */
function normalizeName(name: string): string {
  if (!name) return "";
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Builds an index of linked accounts across properties.
 * Identifies which properties share the same phone number or owner name.
 */
export function buildLinkedPropertiesIndex(properties: AdminProperty[]): {
  byPhone: Map<string, AdminProperty[]>;
  byName: Map<string, AdminProperty[]>;
} {
  const byPhone = new Map<string, AdminProperty[]>();
  const byName = new Map<string, AdminProperty[]>();

  for (const p of properties) {
    const normP = normalizePhone(p.ownerPhone);
    if (normP && normP.length >= 9) {
      const existing = byPhone.get(normP) || [];
      existing.push(p);
      byPhone.set(normP, existing);
    }

    const normN = normalizeName(p.ownerName);
    if (normN && normN.length >= 3) {
      const existing = byName.get(normN) || [];
      existing.push(p);
      byName.set(normN, existing);
    }
  }

  return { byPhone, byName };
}

// =========================================================================
// 1. RATEPAYERS & LINKED PORTFOLIOS EXPORT (PRIMARY EMPHASIS)
// =========================================================================

export function exportRatepayersCsv(
  ratepayers: AdminRatepayerSummary[],
  properties: AdminProperty[],
  metadata: CsvReportMetadata
): void {
  const { byPhone, byName } = buildLinkedPropertiesIndex(properties);

  const headerLines = buildCorporateHeader(metadata);

  const columnHeaders = [
    "Ratepayer ID",
    "Citizen Name",
    "Primary Phone Number",
    "Portfolio Hierarchy Status",
    "Linked Properties Count",
    "Linked Account Numbers (Cadastre Roll)",
    "Digital Addresses (GPS)",
    "Compliance Status",
    "Total Portfolio Valuation (GHS)",
    "Total Portfolio Arrears (GHS)",
    "Total Outstanding Due (GHS)",
    "Registration Date",
  ];

  let sumValuation = 0;
  let sumArrears = 0;
  let sumDue = 0;

  const dataRows: string[] = ratepayers.map((r) => {
    const normP = normalizePhone(r.phoneNumber);
    const normN = normalizeName(r.name);

    // Find linked properties by phone or matching name
    let linked = normP ? byPhone.get(normP) || [] : [];
    if (linked.length === 0 && normN) {
      linked = byName.get(normN) || [];
    }

    const propertyCount = Math.max(r.propertyCount, linked.length);
    const isMultiProperty = propertyCount > 1;
    const hierarchyStatus = isMultiProperty
      ? "MULTI-PROPERTY PORTFOLIO (PRIMARY)"
      : propertyCount === 1
      ? "SINGLE HOLDING"
      : "UNATTACHED CITIZEN";

    const linkedAccounts = linked.map((p) => p.accountNumber).filter(Boolean).join(" | ") || "—";
    const linkedGps = linked.map((p) => p.ownerDigitalAddress).filter((a) => a && a !== "—").join(" | ") || "—";

    const valuation = linked.reduce((sum, p) => sum + (p.rateableValue || 0), 0);
    const arrears = linked.reduce((sum, p) => sum + (p.arrears || 0), 0);
    const due = linked.reduce((sum, p) => sum + (p.totalAmountDue || 0), 0);

    sumValuation += valuation;
    sumArrears += arrears;
    sumDue += due;

    return [
      formatCsvCell(r.id),
      formatCsvCell(r.name),
      formatCsvCell(r.phoneNumber, { preserveTextAsFormula: true }),
      formatCsvCell(hierarchyStatus),
      formatCsvCell(propertyCount),
      formatCsvCell(linkedAccounts),
      formatCsvCell(linkedGps),
      formatCsvCell(r.status),
      formatCsvCell(valuation),
      formatCsvCell(arrears),
      formatCsvCell(due),
      formatCsvCell(r.createdAtFormatted),
    ].join(",");
  });

  // Summary row at the bottom
  const summaryRow = [
    '"TOTALS"',
    '""',
    '""',
    '""',
    `"${ratepayers.length} Ratepayers"`,
    '""',
    '""',
    '""',
    formatCsvCell(sumValuation),
    formatCsvCell(sumArrears),
    formatCsvCell(sumDue),
    '""',
  ].join(",");

  const csvContent = [
    ...headerLines,
    columnHeaders.map((c) => `"${c}"`).join(","),
    ...dataRows,
    summaryRow,
  ].join("\r\n");

  const dateStr = new Date().toISOString().split("T")[0];
  downloadCsvFile(`KKMA_Ratepayers_Linked_Portfolios_${dateStr}.csv`, csvContent);
}

// =========================================================================
// 2. CADASTRE & PROPERTY ROLL EXPORT (WITH LINKED ACCOUNT HIERARCHY)
// =========================================================================

export function exportCadastreCsv(
  properties: AdminProperty[],
  metadata: CsvReportMetadata
): void {
  const { byPhone, byName } = buildLinkedPropertiesIndex(properties);

  // Group properties so linked portfolios appear adjacent to each other
  const sortedProperties = [...properties].sort((a, b) => {
    const phoneA = normalizePhone(a.ownerPhone);
    const phoneB = normalizePhone(b.ownerPhone);
    if (phoneA && phoneB && phoneA === phoneB) {
      return a.accountNumber.localeCompare(b.accountNumber);
    }
    const nameA = a.ownerName.toLowerCase();
    const nameB = b.ownerName.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  const headerLines = buildCorporateHeader(metadata);

  const columnHeaders = [
    "Account Number",
    "Valuation Number",
    "Ratepayer / Owner Name",
    "Owner Phone Number",
    "Hierarchy Status",
    "Owner Portfolio Holdings Count",
    "Other Linked Account Numbers",
    "Owner Total Portfolio Liability (GHS)",
    "Digital Address (GhanaPost GPS)",
    "Physical Address / House No",
    "Property Classification",
    "Fiscal Year",
    "Rateable Value (GHS)",
    "Prior Arrears (GHS)",
    "Current Assessment (GHS)",
    "Total Amount Due (GHS)",
    "Billing Status",
    "Settlement Deadline",
    "Municipality",
  ];

  let sumRateable = 0;
  let sumArrears = 0;
  let sumCurrent = 0;
  let sumTotalDue = 0;

  const dataRows: string[] = sortedProperties.map((p) => {
    const normP = normalizePhone(p.ownerPhone);
    const normN = normalizeName(p.ownerName);

    let linked = normP ? byPhone.get(normP) || [] : [];
    if (linked.length === 0 && normN) {
      linked = byName.get(normN) || [];
    }

    const portfolioCount = Math.max(1, linked.length);
    const isMultiProperty = portfolioCount > 1;
    const hierarchyStatus = isMultiProperty ? "MULTI-HOLDING MEMBER" : "STANDALONE PARCEL";

    const otherAccounts = linked
      .filter((other) => other.accountNumber !== p.accountNumber)
      .map((other) => other.accountNumber)
      .join(" | ") || "—";

    const portfolioTotalDue = linked.reduce((sum, item) => sum + (item.totalAmountDue || 0), 0);

    sumRateable += p.rateableValue || 0;
    sumArrears += p.arrears || 0;
    sumCurrent += p.currentFee || 0;
    sumTotalDue += p.totalAmountDue || 0;

    return [
      formatCsvCell(p.accountNumber, { preserveTextAsFormula: true }),
      formatCsvCell(p.valuationNo || "—"),
      formatCsvCell(p.ownerName),
      formatCsvCell(p.ownerPhone, { preserveTextAsFormula: true }),
      formatCsvCell(hierarchyStatus),
      formatCsvCell(portfolioCount),
      formatCsvCell(otherAccounts),
      formatCsvCell(portfolioTotalDue),
      formatCsvCell(p.ownerDigitalAddress),
      formatCsvCell(p.physicalAddress || p.houseNo || "—"),
      formatCsvCell(p.propertyClassification),
      formatCsvCell(p.billYear),
      formatCsvCell(p.rateableValue),
      formatCsvCell(p.arrears),
      formatCsvCell(p.currentFee),
      formatCsvCell(p.totalAmountDue),
      formatCsvCell(p.status),
      formatCsvCell(p.settlementDeadlineFormatted),
      formatCsvCell(p.municipality),
    ].join(",");
  });

  const summaryRow = [
    '"TOTALS"',
    '""',
    '""',
    '""',
    '""',
    `"${properties.length} Parcels"`,
    '""',
    '""',
    '""',
    '""',
    '""',
    '""',
    formatCsvCell(sumRateable),
    formatCsvCell(sumArrears),
    formatCsvCell(sumCurrent),
    formatCsvCell(sumTotalDue),
    '""',
    '""',
    '""',
  ].join(",");

  const csvContent = [
    ...headerLines,
    columnHeaders.map((c) => `"${c}"`).join(","),
    ...dataRows,
    summaryRow,
  ].join("\r\n");

  const dateStr = new Date().toISOString().split("T")[0];
  downloadCsvFile(`KKMA_Cadastre_Property_Roll_${dateStr}.csv`, csvContent);
}

// =========================================================================
// 3. TREASURY RECONCILIATION EXPORT
// =========================================================================

export function exportTreasuryCsv(
  receipts: AdminTreasuryReceipt[],
  metadata: CsvReportMetadata
): void {
  const headerLines = buildCorporateHeader(metadata);

  const columnHeaders = [
    "Official Receipt Number",
    "Property Account Number",
    "Payer / Citizen Name",
    "Payment Channel / Method",
    "Settlement Type",
    "Amount Settled (GHS)",
    "Payment Date & Time",
    "Reconciliation Status",
    "Municipality",
  ];

  let sumAmount = 0;

  const dataRows: string[] = receipts.map((r) => {
    sumAmount += r.amount || 0;
    return [
      formatCsvCell(r.receiptNumber, { preserveTextAsFormula: true }),
      formatCsvCell(r.accountNumber, { preserveTextAsFormula: true }),
      formatCsvCell(r.ownerName),
      formatCsvCell(r.paymentMethod),
      formatCsvCell(r.settlementType),
      formatCsvCell(r.amount),
      formatCsvCell(r.datePaid),
      formatCsvCell(r.status),
      formatCsvCell(r.municipality || "Kpone-Katamanso (KKMA)"),
    ].join(",");
  });

  const summaryRow = [
    '"TOTAL RECONCILED REVENUE"',
    '""',
    '""',
    '""',
    '""',
    formatCsvCell(sumAmount),
    `"${receipts.length} Receipts"`,
    '""',
    '""',
  ].join(",");

  const csvContent = [
    ...headerLines,
    columnHeaders.map((c) => `"${c}"`).join(","),
    ...dataRows,
    summaryRow,
  ].join("\r\n");

  const dateStr = new Date().toISOString().split("T")[0];
  downloadCsvFile(`KKMA_Treasury_Reconciliation_${dateStr}.csv`, csvContent);
}

// =========================================================================
// 4. SYSTEM AUDIT TRAIL EXPORT
// =========================================================================

export function exportAuditLogsCsv(
  logs: AdminAuditLogItem[],
  metadata: CsvReportMetadata
): void {
  const headerLines = buildCorporateHeader(metadata);

  const columnHeaders = [
    "Log ID",
    "Timestamp (UTC)",
    "Action / Event Type",
    "Entity Target",
    "Entity Reference",
    "Admin Officer Name",
    "Admin ID",
    "Role",
    "Operation Details / Audit Payload",
  ];

  const dataRows: string[] = logs.map((l) => [
    formatCsvCell(l.id),
    formatCsvCell(l.createdAtFormatted),
    formatCsvCell(l.action),
    formatCsvCell(l.entityType),
    formatCsvCell(l.entityId || "—", { preserveTextAsFormula: true }),
    formatCsvCell(l.adminName),
    formatCsvCell(l.adminId, { preserveTextAsFormula: true }),
    formatCsvCell(l.adminRole),
    formatCsvCell(l.details),
  ].join(","));

  const csvContent = [
    ...headerLines,
    columnHeaders.map((c) => `"${c}"`).join(","),
    ...dataRows,
  ].join("\r\n");

  const dateStr = new Date().toISOString().split("T")[0];
  downloadCsvFile(`KKMA_Audit_Trail_${dateStr}.csv`, csvContent);
}

// =========================================================================
// 5. SMS ROLLOUT & TRANSACTIONAL LOGS EXPORT
// =========================================================================

export function exportSmsRolloutCsv(
  logs: SmsRolloutLogItem[],
  metadata: CsvReportMetadata
): void {
  const headerLines = buildCorporateHeader(metadata);

  const columnHeaders = [
    "Notice Reference",
    "Timestamp",
    "Recipient Citizen Name",
    "Recipient Mobile Phone",
    "Property Account Number",
    "Notice Type",
    "Delivery Channel",
    "Delivery Status",
    "SMS Message Content",
  ];

  const dataRows: string[] = logs.map((l) => [
    formatCsvCell(l.id),
    formatCsvCell(l.createdAtFormatted),
    formatCsvCell(l.recipientName),
    formatCsvCell(l.recipientPhone, { preserveTextAsFormula: true }),
    formatCsvCell(l.accountNumber || "—", { preserveTextAsFormula: true }),
    formatCsvCell(l.type),
    formatCsvCell(l.deliveryMethod),
    formatCsvCell(l.deliveryStatus),
    formatCsvCell(l.message),
  ].join(","));

  const csvContent = [
    ...headerLines,
    columnHeaders.map((c) => `"${c}"`).join(","),
    ...dataRows,
  ].join("\r\n");

  const dateStr = new Date().toISOString().split("T")[0];
  downloadCsvFile(`KKMA_SMS_Rollout_Logs_${dateStr}.csv`, csvContent);
}

// =========================================================================
// 6. SINGLE RATEPAYER DOSSIER EXPORT
// =========================================================================

export function exportRatepayerDossierCsv(
  dossier: RatepayerHistoryDossier,
  metadata: CsvReportMetadata
): void {
  const headerLines = buildCorporateHeader(metadata);

  const sections: string[] = [
    ...headerLines,
    '"CITIZEN PROFILE"',
    '"Citizen ID","Full Name","Phone Number","Role","Verification Status"',
    [
      formatCsvCell(dossier.user.id),
      formatCsvCell(dossier.user.name),
      formatCsvCell(dossier.user.phoneNumber, { preserveTextAsFormula: true }),
      formatCsvCell(dossier.user.role),
      formatCsvCell(dossier.user.isVerified ? "VERIFIED" : "UNVERIFIED"),
    ].join(","),
    '""',
    '"LINKED PORTFOLIO HOLDINGS"',
    '"Account Number","Digital Address","Physical Address","Classification","Rateable Value (GHS)","Arrears (GHS)","Current Fee (GHS)","Total Due (GHS)","Status"',
  ];

  const propRows = (dossier.properties || []).map((p) => [
    formatCsvCell(p.accountNumber, { preserveTextAsFormula: true }),
    formatCsvCell(p.ownerDigitalAddress),
    formatCsvCell(p.physicalAddress || "—"),
    formatCsvCell(p.propertyClassification),
    formatCsvCell(p.rateableValue),
    formatCsvCell(p.arrears),
    formatCsvCell(p.currentFee),
    formatCsvCell(p.totalAmountDue),
    formatCsvCell(p.status),
  ].join(","));

  sections.push(...propRows);
  sections.push('""');
  sections.push('"OFFICIAL PAYMENT RECEIPTS ARCHIVE"');
  sections.push('"Receipt Number","Property Account","Settlement Type","Payment Method","Amount Paid (GHS)","Payment Date","Status"');

  const receiptRows = (dossier.receipts || []).map((r) => [
    formatCsvCell(r.receiptNumber, { preserveTextAsFormula: true }),
    formatCsvCell(r.propertyAccountNumber || "—", { preserveTextAsFormula: true }),
    formatCsvCell(r.settlementType),
    formatCsvCell(r.paymentMethod),
    formatCsvCell(r.amount),
    formatCsvCell(r.datePaid),
    formatCsvCell(r.status),
  ].join(","));

  sections.push(...receiptRows);

  const cleanName = (dossier.user.name || "Ratepayer").replace(/[^a-zA-Z0-9]/g, "_");
  const dateStr = new Date().toISOString().split("T")[0];
  downloadCsvFile(`KKMA_Dossier_${cleanName}_${dateStr}.csv`, sections.join("\r\n"));
}

/**
 * Exports the Paid Ratepayers Directory to corporate CSV
 */
export function exportPaidUsersCsv(
  records: AdminPaidUserRecord[],
  filterType: "ALL" | "LIVE" | "TEST" = "ALL",
  officerName = "System Administrator"
) {
  const totalCollected = records.reduce((sum, r) => sum + r.amountPaid, 0);

  const filterLabel =
    filterType === "LIVE"
      ? "Live Ratepayer Payments Only"
      : filterType === "TEST"
      ? "Sandbox Test Accounts Only"
      : "Complete Paid Ratepayers Directory (Live & Test)";

  const headerBanner = buildCorporateHeader({
    reportTitle: "PAID RATEPAYERS DIRECTORY & COLLECTIONS REGISTRY",
    subtitle: "Official Municipal Rate Collections Registry & Reconciled Ratepayer Dossiers",
    filterScope: filterLabel,
    generatedBy: officerName,
    recordCount: records.length,
    financialSummary: {
      totalCollected,
    },
  });

  const columnHeaders = [
    "Ratepayer Full Name",
    "Telephone Number",
    "Property Account Number",
    "Amount Paid (GHS)",
    "Payment Channel",
    "Payment Reference",
    "Official GCR Receipt Number",
    "Reconciliation Status",
    "Account Classification",
    "Date & Time Reconciled",
  ];

  const dataRows = records.map((r) => [
    formatCsvCell(r.userName),
    formatCsvCell(r.phoneNumber, { preserveTextAsFormula: true }),
    formatCsvCell(r.accountNumber, { preserveTextAsFormula: true }),
    formatCsvCell(r.amountPaid),
    formatCsvCell(r.paymentMethod),
    formatCsvCell(r.reference, { preserveTextAsFormula: true }),
    formatCsvCell(r.receiptNumber, { preserveTextAsFormula: true }),
    formatCsvCell(r.status),
    formatCsvCell(r.isTestUser ? "TEST ACCOUNT" : "OFFICIAL RATEPAYER"),
    formatCsvCell(r.paidAt),
  ]);

  const csvContent = [
    ...headerBanner,
    columnHeaders.map((h) => `"${h}"`).join(","),
    ...dataRows.map((row) => row.join(",")),
  ].join("\r\n");

  const dateStr = new Date().toISOString().split("T")[0];
  downloadCsvFile(`KKMA_Paid_Ratepayers_${filterType}_${dateStr}.csv`, csvContent);
}
