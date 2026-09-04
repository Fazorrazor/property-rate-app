import { ISMSProvider, SMSResponse, BillRolloutSMSParams, FormattedBillSMS } from './types';

export class ArkeselProvider implements ISMSProvider {
  private apiKey: string;
  private senderId: string;

  constructor() {
    this.apiKey = process.env.ARKESEL_API_KEY || '';
    this.senderId = process.env.ARKESEL_SENDER_ID || 'Arnold';
  }

  /**
   * Format phone number for Arkesel API.
   * Arkesel accepts Ghanaian format like 233551908713 or 0551908713.
   */
  public formatPhoneNumber(phone: string): string {
    if (!phone) return '';
    const cleanPhone = phone.replace(/[^\d+]/g, '');

    if (cleanPhone.startsWith('+')) {
      return cleanPhone.substring(1); // Remove leading +
    }

    if (cleanPhone.startsWith('233')) {
      return cleanPhone;
    }

    if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
      return `233${cleanPhone.substring(1)}`;
    }

    if (cleanPhone.length === 9) {
      return `233${cleanPhone}`;
    }

    return cleanPhone;
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

      if (!this.apiKey || this.apiKey === 'YOUR_ARKESEL_API_KEY') {
        console.warn(`[SMS Mock - Arkesel] To: ${formattedPhone} | Message: ${message}`);
        await new Promise((resolve) => setTimeout(resolve, 300));
        return {
          success: true,
          messageId: `mock-arkesel-${Date.now()}`,
          formattedPhone,
        };
      }

      const response = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: this.senderId,
          message: message,
          recipients: [formattedPhone],
        }),
      });

      const data = await response.json();

      if (!response.ok || data.status === 'error') {
        console.error('Arkesel SMS Error:', data);
        return {
          success: false,
          error: data.message || `HTTP ${response.status} from Arkesel`,
          formattedPhone,
        };
      }

      return {
        success: true,
        messageId: data.data?.[0]?.id || `arkesel-${Date.now()}`,
        formattedPhone,
      };
    } catch (error: any) {
      console.error('Arkesel Provider Exception:', error);
      return {
        success: false,
        error: error.message || 'Unknown Arkesel error',
      };
    }
  }
}
