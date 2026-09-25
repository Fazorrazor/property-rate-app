import {
  ISMSProvider,
  SMSResponse,
  BillRolloutSMSParams,
  FormattedBillSMS,
  MultiPropertySMSParams,
  FormattedMultiPropertySMS,
} from './types';
export class ArkeselProvider implements ISMSProvider {
  private apiKey: string;
  private senderId: string;
  constructor() {
    this.apiKey = process.env.ARKESEL_API_KEY || '';
    this.senderId = process.env.ARKESEL_SENDER_ID || 'KKMA';
  }
  public setApiKey(key: string): void {
    this.apiKey = key;
  }
  public setSenderId(senderId: string): void {
    this.senderId = senderId;
  }
  public getApiKey(): string {
    return this.apiKey;
  }
  public getSenderId(): string {
    return this.senderId;
  }
  public formatPhoneNumber(phone: string): string {
    if (!phone) return '';
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    if (cleanPhone.startsWith('+')) return cleanPhone.substring(1);
    if (cleanPhone.startsWith('233')) return cleanPhone;
    if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
      return `233${cleanPhone.substring(1)}`;
    }
    if (cleanPhone.length === 9) return `233${cleanPhone}`;
    return cleanPhone;
  }
  public buildBillLinks(
    accountNumber: string,
    baseUrl?: string,
    token?: string
  ): { billLinkUrl: string; paymentLinkUrl: string } {
    let host =
      baseUrl?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      'https://property-rate-app.vercel.app';
    host = host.replace(/\/+$/, '');
    if (host.includes('-projects.vercel.app') || host.includes('kzz98dclv')) {
      host = 'https://property-rate-app.vercel.app';
    }
    const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : '';
    const encodedAccount = encodeURIComponent(accountNumber);
    return {
      billLinkUrl:
        `${host}/bill?accountNumber=${encodedAccount}${tokenQuery}`,
      paymentLinkUrl:
        `${host}/checkout?accountNumber=${encodedAccount}${tokenQuery}`,
    };
  }
  public formatBillRolloutMessage(
    params: BillRolloutSMSParams
  ): FormattedBillSMS {
    const {
      accountNumber,
      ownerName,
      phoneNumber,
      totalAmountDue,
      arrears,
      currentFee,
      dueDate = '30-Jun-2025',
      baseUrl,
      token,
      customTemplate,
      municipality = 'Kpone-Katamanso (KKMA)',
      billYear = new Date().getFullYear(),
      supportPhone = '0243756235',
      ussdCode =
      process.env.NEXT_PUBLIC_USSD_CODE ||
      process.env.USSD_SHORT_CODE ||
      '*227*4362#',
      ownerDigitalAddress = '',
    } = params;
    const { billLinkUrl, paymentLinkUrl } = this.buildBillLinks(
      accountNumber,
      baseUrl,
      token
    );
    const cleanMunicipality =
      municipality.replace(/\s*\([^)]*\)/, '').trim() || municipality;
    const money = (value: number) =>
      Number(value || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    const formattedAmount = money(totalAmountDue);
    const formattedArrears = money(arrears);
    const formattedCurrentFee = money(currentFee);
    const defaultMsg =
      `*${cleanMunicipality} PROPERTY RATE BILL*\n\n` +
      `Dear ${ownerName || 'Property Owner'},\n\n` +
      `Your ${billYear} property rate bill for Property ID ${accountNumber} is ready:\n\n` +
      `• Total Amount Due: GH₵ ${formattedAmount}\n` +
      `• Outstanding Arrears: GH₵ ${formattedArrears}\n` +
      `• Due Date: ${dueDate}\n\n` +
      `View Bill:\n${billLinkUrl}\n\n` +
      `Pay Online:\n${paymentLinkUrl}\n\n` +
      `For assistance, contact Assembly Revenue Office on ${supportPhone}.\n` +
      `Thank you.`;
    const messageText = customTemplate?.trim()
      ? customTemplate
        .replace(/{{municipality}}/g, cleanMunicipality)
        .replace(/{{billYear}}/g, String(billYear))
        .replace(/{{supportPhone}}/g, supportPhone)
        .replace(/{{ussdCode}}/g, ussdCode)
        .replace(/{{accountNumber}}/g, accountNumber)
        .replace(/{{ownerName}}/g, ownerName || 'Property Owner')
        .replace(/{{totalAmountDue}}/g, formattedAmount)
        .replace(/{{arrears}}/g, formattedArrears)
        .replace(/{{currentFee}}/g, formattedCurrentFee)
        .replace(/{{dueDate}}/g, dueDate)
        .replace(
          /{{propertyGpsAddress}}/g,
          ownerDigitalAddress.trim() || 'N/A'
        )
        .replace(/{{billLink}}/g, billLinkUrl)
        .replace(/{{link_bill}}/g, billLinkUrl)
        .replace(/{{paymentLink}}/g, paymentLinkUrl)
        .replace(/{{link_checkout}}/g, paymentLinkUrl)
        .replace(/{{link_assessment}}/g, billLinkUrl)
      : defaultMsg;
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
  public formatMultiPropertyMessage(
    params: MultiPropertySMSParams
  ): FormattedMultiPropertySMS {
    const {
      phoneNumber,
      ownerName,
      properties,
      dueDate = '30-Jun-2025',
      customTemplate,
      municipality = 'Kpone-Katamanso (KKMA)',
      billYear = new Date().getFullYear(),
      supportPhone = '0243756235',
      ussdCode =
      process.env.NEXT_PUBLIC_USSD_CODE ||
      process.env.USSD_SHORT_CODE ||
      '*227*4362#',
    } = params;
    const cleanMunicipality =
      municipality.replace(/\s*\([^)]*\)/, '').trim() || municipality;
    const totalAmountDue = properties.reduce(
      (sum, property) => sum + Number(property.totalAmountDue || 0),
      0
    );
    const totalArrears = properties.reduce(
      (sum, property) => sum + Number(property.arrears || 0),
      0
    );
    const totalCurrentFee = properties.reduce(
      (sum, property) => sum + Number(property.currentFee || 0),
      0
    );
    const accountNumbers = properties.map((property) => property.accountNumber);
    const propertyAccounts = accountNumbers.join(', ');
    const paymentLinks = properties
      .map((property) => `${property.accountNumber}: ${property.paymentLinkUrl}`)
      .join('\n');
    const billLinks = properties
      .map((property) => `${property.accountNumber}: ${property.billLinkUrl}`)
      .join('\n');
    const gpsAddresses = Array.from(
      new Set(
        properties
          .map((property) => property.ownerDigitalAddress?.trim())
          .filter((address): address is string => Boolean(address))
      )
    ).join(', ');
    const money = (value: number) =>
      Number(value || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    const formattedAmount = money(totalAmountDue);
    const formattedArrears = money(totalArrears);
    const formattedCurrentFee = money(totalCurrentFee);
    const defaultMessage =
      `Dear ${ownerName || `${cleanMunicipality} Resident`},\n\n` +
      `You have ${properties.length} property account(s) for the ` +
      `${billYear} billing year.\n\n` +
      `Accounts: ${propertyAccounts}\n\n` +
      `Total amount due: GHS ${formattedAmount}\n\n` +
      `Payment links:\n${paymentLinks}\n\n` +
      `Offline/USSD: Dial ${ussdCode}\n\n` +
      `For payment and enquiries, call ${supportPhone}.\n` +
      `Disregard if already paid.`;
    const messageText = customTemplate?.trim()
      ? customTemplate
        .replace(/{{municipality}}/g, cleanMunicipality)
        .replace(/{{billYear}}/g, String(billYear))
        .replace(/{{supportPhone}}/g, supportPhone)
        .replace(/{{ussdCode}}/g, ussdCode)
        .replace(/{{accountNumber}}/g, propertyAccounts)
        .replace(/{{propertyAccounts}}/g, propertyAccounts)
        .replace(/{{ownerName}}/g, ownerName || 'Municipal Ratepayer')
        .replace(/{{totalAmountDue}}/g, formattedAmount)
        .replace(/{{arrears}}/g, formattedArrears)
        .replace(/{{currentFee}}/g, formattedCurrentFee)
        .replace(/{{dueDate}}/g, dueDate)
        .replace(/{{propertyGpsAddress}}/g, gpsAddresses || 'N/A')
        .replace(/{{billLink}}/g, billLinks)
        .replace(/{{paymentLink}}/g, paymentLinks)
      : defaultMessage;
    return {
      recipientPhone: this.formatPhoneNumber(phoneNumber),
      recipientName: ownerName || 'Municipal Ratepayer',
      messageText,
      accountNumbers,
      totalAmountDue,
    };
  }
  public async sendSMS(to: string, message: string): Promise<SMSResponse> {
    try {
      const formattedPhone = this.formatPhoneNumber(to);
      if (!formattedPhone) {
        return { success: false, error: 'A valid recipient phone is required.' };
      }
      if (!this.apiKey) {
        console.warn(
          `[SMS Mock - Arkesel] To: ${formattedPhone} | Message: ${message}`
        );
        return {
          success: true,
          messageId: `mock-arkesel-${Date.now()}`,
          formattedPhone,
        };
      }
      const response = await fetch(
        'https://sms.arkesel.com/api/v2/sms/send',
        {
          method: 'POST',
          headers: {
            'api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender: this.senderId,
            message,
            recipients: [formattedPhone],
          }),
        }
      );
      const responseText = await response.text();
      let data: any = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { message: responseText };
      }
      if (!response.ok || data.status === 'error') {
        return {
          success: false,
          error: data.message || `HTTP ${response.status} from Arkesel`,
          formattedPhone,
        };
      }
      return {
        success: true,
        messageId:
          data.data?.[0]?.id ||
          data.data?.id ||
          data.message_id ||
          `arkesel-${Date.now()}`,
        formattedPhone,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Arkesel error',
      };
    }
  }
}