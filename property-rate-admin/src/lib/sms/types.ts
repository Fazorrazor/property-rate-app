export interface SMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  formattedPhone?: string;
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
