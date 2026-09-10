export interface SMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  formattedPhone?: string;
}

export const DEFAULT_SMS_NOTICE_TEMPLATE =
  "Dear {{municipality}} Resident,\n\nDo find below your {{billYear}} Property Rate bill:\n\nValuation ID: {{accountNumber}}\n\nAmount due: GH₵ {{totalAmountDue}}\n\nView your bills: {{billLink}}\n\nPay Via *227*4362# or {{paymentLink}} with your payment reference {{accountNumber}}\n\nFor payment & enquiries kindly call 0256039385/0538702445\nDisregard if already paid. Keep receipt for verification.";

export interface BillRolloutSMSParams {
  accountNumber: string;
  ownerName: string;
  phoneNumber: string;
  totalAmountDue: number;
  arrears: number;
  currentFee: number;
  dueDate?: string;
  baseUrl?: string;
  token?: string;
  customTemplate?: string;
  municipality?: string;
  billYear?: number | string;
  supportPhone?: string;
  ussdCode?: string;
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
  /**
   * Sends an SMS message to a specific phone number.
   * @param to The recipient's phone number (in international format, e.g., +233209067556 or local 0209067556)
   * @param message The text content of the SMS
   */
  sendSMS(to: string, message: string): Promise<SMSResponse>;
}
