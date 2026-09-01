import { ISMSProvider, SMSResponse } from './types';

export class AfricasTalkingProvider implements ISMSProvider {
  private username: string;
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.username = process.env.AT_USERNAME || 'sandbox';
    this.apiKey = process.env.AT_API_KEY || '';
    
    // Use sandbox URL if username is sandbox
    this.baseUrl = this.username === 'sandbox' 
      ? 'https://api.sandbox.africastalking.com/version1/messaging'
      : 'https://api.africastalking.com/version1/messaging';
  }

  /**
   * Format phone number to E.164 standard which Africa's Talking requires.
   * Assuming Ghanaian numbers.
   */
  private formatPhoneNumber(phone: string): string {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
      return `+233${cleanPhone.substring(1)}`;
    }
    if (cleanPhone.startsWith('233') && cleanPhone.length === 12) {
      return `+${cleanPhone}`;
    }
    return phone;
  }

  async sendSMS(to: string, message: string): Promise<SMSResponse> {
    try {
      if (!this.apiKey || this.apiKey === 'YOUR_API_KEY_HERE') {
        console.warn(`[SMS Mock] To: ${to} | Message: ${message}`);
        // Simulate a delay
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true, messageId: `mock-${Date.now()}` };
      }

      const formattedPhone = this.formatPhoneNumber(to);
      const params = new URLSearchParams({
        username: this.username,
        to: formattedPhone,
        message: message,
      });

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'apiKey': this.apiKey,
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AT API Error:', errorText);
        return { success: false, error: `AT API Error: ${errorText}` };
      }

      const data = await response.json();

      // Check Africa's Talking response structure
      if (data?.SMSMessageData?.Recipients?.length > 0) {
        const recipient = data.SMSMessageData.Recipients[0];
        if (recipient.status === 'Success') {
          return {
            success: true,
            messageId: recipient.messageId,
          };
        }
        return { success: false, error: `AT Error: ${recipient.status}` };
      }

      return { success: false, error: 'Failed to send SMS' };

    } catch (error: any) {
      console.error('AfricasTalking Provider Error:', error);
      return { success: false, error: error.message || 'Unknown SMS error' };
    }
  }
}
