export interface SMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  formattedPhone?: string;
}
export const FILTER_SMS_TEMPLATES: Record<string, string> = {
  UNPAID:
    "*{{municipality}} PROPERTY RATE BILL*\n\nDear {{ownerName}},\n\nYour {{billYear}} property rate bill for Property ID {{accountNumber}} (GPS: {{propertyGpsAddress}}) is ready:\n\n• Current Fee: GH₵ {{currentFee}}\n• Outstanding Arrears: GH₵ {{arrears}}\n• Total Due: GH₵ {{totalAmountDue}}\n• Due Date: {{dueDate}}\n\nView Bill:\n{{link_assessment}}\n\nPay Online:\n{{link_checkout}}\n\nFor assistance, contact Assembly Revenue Office on 0243756235.\nThank you.",
  PAID:
    "*{{municipality}} PAYMENT CONFIRMATION*\n\nDear {{ownerName}},\n\nThank you! Your property rate account {{accountNumber}} (GPS: {{propertyGpsAddress}}) has been fully settled with a zero balance (GH₵ 0.00) for {{billYear}}.\n\nView Official Receipt & Clearance:\n{{link_assessment}}\n\nThank you for supporting community development.\nAssembly Revenue Office: 0243756235.",
  OVERPAID:
    "*{{municipality}} ACCOUNT STATEMENT*\n\nDear {{ownerName}},\n\nOur records indicate your property rate account {{accountNumber}} (GPS: {{propertyGpsAddress}}) has an account credit of GH₵ {{totalAmountDue}}. This will offset your upcoming bills.\n\nView Statement:\n{{link_assessment}}\n\nFor questions, contact Assembly Revenue Office on 0243756235.\nThank you.",
  ALL:
    "*{{municipality}} PROPERTY RATE NOTICE*\n\nDear {{ownerName}},\n\nHere are your property rate bill details:\n• Property ID: {{accountNumber}}\n• Location: {{propertyGpsAddress}}\n• Total Amount Due: GH₵ {{totalAmountDue}}\n\nView Bill:\n{{link_assessment}}\n\nPay Online:\n{{link_checkout}}\n\nFor assistance, contact Assembly Revenue Office on 0243756235.\nThank you.",
};

export const DEFAULT_SMS_NOTICE_TEMPLATE = FILTER_SMS_TEMPLATES.UNPAID;

export const DEFAULT_RECEIPT_NOTICE_TEMPLATE =
  "Payment Confirmed: GH₵ {{amount}} received for Property {{accountNumber}}.\n\nOfficial GCR Receipt #{{receiptNumber}} issued.\n\nView official receipt & scanned copy:\n{{receiptLink}}\n\nDisregard if already received. Keep receipt for verification.\nAssembly Revenue Office: 0243756235.";

export const DEFAULT_SAVED_TEMPLATES = [
  {
    id: "preset_unpaid",
    name: "Annual Bill Notice (Unpaid)",
    type: "BILLING" as const,
    filterKey: "UNPAID",
    content: FILTER_SMS_TEMPLATES.UNPAID,
    savedAt: "System Standard",
  },
  {
    id: "preset_all",
    name: "General Notice (All Records)",
    type: "BILLING" as const,
    filterKey: "ALL",
    content: FILTER_SMS_TEMPLATES.ALL,
    savedAt: "System Standard",
  },
  {
    id: "preset_paid",
    name: "Settlement Clearance (Paid)",
    type: "BILLING" as const,
    filterKey: "PAID",
    content: FILTER_SMS_TEMPLATES.PAID,
    savedAt: "System Standard",
  },
  {
    id: "preset_overpaid",
    name: "Credit Statement (Overpaid)",
    type: "BILLING" as const,
    filterKey: "OVERPAID",
    content: FILTER_SMS_TEMPLATES.OVERPAID,
    savedAt: "System Standard",
  },
  {
    id: "preset_receipt",
    name: "Standard Payment Receipt Notice",
    type: "RECEIPT" as const,
    filterKey: "RECEIPT",
    content: DEFAULT_RECEIPT_NOTICE_TEMPLATE,
    savedAt: "System Standard",
  },
];
export interface ReceiptNoticeSMSParams {
  receiptNumber: string;
  accountNumber: string;
  amount: number;
  recipientPhone: string;
  recipientName?: string;
  paymentMethod?: string;
  datePaid?: string;
  baseUrl?: string;
  customTemplate?: string;
}
export interface BillRolloutSMSParams {
  accountNumber: string;
  ownerName: string;
  phoneNumber: string;
  totalAmountDue: number;
  arrears: number;
  currentFee: number;
  dueDate?: string;
  baseUrl?: string;
  customTemplate?: string;
  municipality?: string;
  billYear?: number;
  token?: string;
  supportPhone?: string;
  ussdCode?: string;
  ownerDigitalAddress?: string;
}
export interface MultiPropertySMSItem {
  accountNumber: string;
  totalAmountDue: number;
  arrears: number;
  currentFee: number;
  billLinkUrl: string;
  paymentLinkUrl: string;
  municipality: string;
  billYear: number;
  ownerDigitalAddress: string;
}
export interface MultiPropertySMSParams {
  phoneNumber: string;
  ownerName: string;
  properties: MultiPropertySMSItem[];
  dueDate?: string;
  baseUrl?: string;
  token?: string;
  customTemplate?: string;
  municipality?: string;
  billYear?: number;
  supportPhone?: string;
  ussdCode?: string;
}
export interface FormattedMultiPropertySMS {
  recipientPhone: string;
  recipientName: string;
  messageText: string;
  accountNumbers: string[];
  totalAmountDue: number;
}
export interface FormattedBillSMS {
  recipientPhone: string;
  recipientName: string;
  accountNumber: string;
  messageText: string;
  billLinkUrl: string;
  paymentLinkUrl: string;
  totalAmountDue: number;
}
export interface ISMSProvider {
  sendSMS(to: string, message: string): Promise<SMSResponse>;
}