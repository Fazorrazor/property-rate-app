import { ISMSProvider, SMSResponse } from './types';
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
  private formatPhoneNumber(phone: string): string {
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

  async sendSMS(to: string, message: string): Promise<SMSResponse> {
    try {
      if (!this.client || !this.fromNumber || this.fromNumber === 'YOUR_TWILIO_PHONE_NUMBER') {
        console.warn(`[SMS Mock - Twilio] To: ${to} | Message: ${message}`);
        // Simulate a delay
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true, messageId: `mock-twilio-${Date.now()}` };
      }

      const formattedPhone = this.formatPhoneNumber(to);
      
      const response = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedPhone
      });

      if (response.errorCode) {
          return { success: false, error: `Twilio Error: ${response.errorMessage}` };
      }

      return {
        success: true,
        messageId: response.sid,
      };

    } catch (error: any) {
      console.error('Twilio Provider Error:', error);
      return { success: false, error: error.message || 'Unknown Twilio SMS error' };
    }
  }
}
