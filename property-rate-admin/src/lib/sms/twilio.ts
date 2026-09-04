import { ISMSProvider, SMSResponse, BillRolloutSMSParams, FormattedBillSMS } from './types';
import twilio from 'twilio';

export class TwilioProvider implements ISMSProvider {
  private client: twilio.Twilio | null = null;
  private fromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    const authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';

    // Initialize the Twilio client only if the credentials are provided and not placeholders
    if (accountSid && authToken && accountSid !== 'YOUR_TWILIO_ACCOUNT_SID') {
      try {
        this.client = twilio(accountSid, authToken);
      } catch (error) {
        console.error('Failed to initialize Twilio client:', error);
      }
    }
  }

  /**
   * Format phone number to E.164 standard which Twilio requires.
   */
  public formatPhoneNumber(phone: string): string {
    if (!phone) return '';
    // If it already has a +, clean formatting and return
    if (phone.startsWith('+')) {
      return phone.replace(/[^\d+]/g, '');
    }

    const cleanPhone = phone.replace(/\D/g, '');
    
    // Any number starting with 233 (Ghana country code)
    if (cleanPhone.startsWith('233')) {
      return `+${cleanPhone}`;
    }

    // Ghana 10-digit with leading 0 (e.g., 0551908713 -> +233551908713)
    if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
      return `+233${cleanPhone.substring(1)}`;
    }

    // Ghana 9-digit without leading 0 (e.g., 551908713 -> +233551908713)
    if (cleanPhone.length === 9) {
      return `+233${cleanPhone}`;
    }

    // US 11-digit with country code (e.g., 17242625663 -> +17242625663)
    if (cleanPhone.startsWith('1') && cleanPhone.length === 11) {
      return `+${cleanPhone}`;
    }

    // US 10-digit (e.g., 7242625663 -> +17242625663)
    if (cleanPhone.length === 10 && !cleanPhone.startsWith('0')) {
      return `+1${cleanPhone}`;
    }
    
    return `+${cleanPhone}`;
  }

  /**
   * Builds the dual deep links for viewing the digital bill and accessing in-app payment.
   */
  public buildBillLinks(accountNumber: string, baseUrl?: string): { billLinkUrl: string; paymentLinkUrl: string } {
    const host = (baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    return {
      billLinkUrl: `${host}/properties?accountNumber=${encodeURIComponent(accountNumber)}`,
      paymentLinkUrl: `${host}/properties?accountNumber=${encodeURIComponent(accountNumber)}&action=pay`,
    };
  }

  /**
   * Formats a complete dual-link Bill Rollout SMS notice.
   */
  public formatBillRolloutMessage(params: BillRolloutSMSParams): FormattedBillSMS {
    const {
      accountNumber,
      ownerName,
      phoneNumber,
      totalAmountDue,
      arrears,
      currentFee,
      dueDate = '30-Jun-2025',
      baseUrl,
      customTemplate,
      municipality = 'Kpone-Katamanso (KKMA)',
      billYear = new Date().getFullYear(),
      supportPhone = '0256039385/0538702445',
      ussdCode = '*227*4362#',
    } = params;

    const { billLinkUrl, paymentLinkUrl } = this.buildBillLinks(accountNumber, baseUrl);

    const cleanMunicipality = municipality.replace(/\s*\([^)]*\)/, '').trim() || municipality;
    const formattedAmount = totalAmountDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedArrears = arrears.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedCurrentFee = currentFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const defaultMsg = `Dear ${cleanMunicipality} Resident,\n\nDo find below your ${billYear} Property Rate bill:\n\nValuation ID: ${accountNumber}\n\nAmount due: GH₵ ${formattedAmount}\n\nView your bills: ${billLinkUrl}\n\nPay Via ${ussdCode} or ${paymentLinkUrl} with your payment reference ${accountNumber}\n\nFor payment & enquiries kindly call ${supportPhone}\nDisregard if already paid. Keep receipt for verification.`;

    let messageText: string;

    if (customTemplate && customTemplate.trim()) {
      messageText = customTemplate
        .replace(/{{municipality}}/g, cleanMunicipality)
        .replace(/{{billYear}}/g, String(billYear))
        .replace(/{{supportPhone}}/g, supportPhone)
        .replace(/{{ussdCode}}/g, ussdCode)
        .replace(/{{accountNumber}}/g, accountNumber)
        .replace(/{{ownerName}}/g, ownerName || 'Municipal Ratepayer')
        .replace(/{{totalAmountDue}}/g, formattedAmount)
        .replace(/{{arrears}}/g, formattedArrears)
        .replace(/{{currentFee}}/g, formattedCurrentFee)
        .replace(/{{dueDate}}/g, dueDate)
        .replace(/{{billLink}}/g, billLinkUrl)
        .replace(/{{paymentLink}}/g, paymentLinkUrl);
    } else {
      messageText = defaultMsg;
    }

    return {
      recipientPhone: this.formatPhoneNumber(phoneNumber),
      recipientName: ownerName || 'Municipal Ratepayer',
      accountNumber,
      messageText,
      billLinkUrl,
      paymentLinkUrl,
      totalAmountDue,
    };
  }

  async sendSMS(to: string, message: string): Promise<SMSResponse> {
    try {
      const formattedPhone = this.formatPhoneNumber(to);

      if (!this.client || !this.fromNumber || this.fromNumber === 'YOUR_TWILIO_PHONE_NUMBER') {
        console.warn(`[SMS Mock - Twilio] To: ${formattedPhone} | Message: ${message}`);
        // Simulate safe execution without live network dispatch
        await new Promise((resolve) => setTimeout(resolve, 300));
        return {
          success: true,
          messageId: `mock-twilio-${Date.now()}`,
          formattedPhone,
        };
      }
      
      const response = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedPhone,
      });

      if (response.errorCode) {
        return { success: false, error: `Twilio Error: ${response.errorMessage}`, formattedPhone };
      }

      return {
        success: true,
        messageId: response.sid,
        formattedPhone,
      };
    } catch (error: any) {
      console.error('Twilio Provider Error:', error);
      return { success: false, error: error.message || 'Unknown Twilio SMS error' };
    }
  }
}
