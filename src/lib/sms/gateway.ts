import { ISMSProvider } from './types';
import { TwilioProvider } from './twilio';
import { AfricasTalkingProvider } from './africastalking';

export type SMSProviderType = 'AFRICASTALKING' | 'HUBTEL' | 'TWILIO';

export class SMSGateway {
  private provider: ISMSProvider;

  constructor(providerType: SMSProviderType = 'TWILIO') {
    switch (providerType) {
      case 'AFRICASTALKING':
        this.provider = new AfricasTalkingProvider();
        break;
      case 'TWILIO':
        this.provider = new TwilioProvider();
        break;
      // You can add HubtelProvider here later
      default:
        this.provider = new TwilioProvider();
    }
  }

  getProvider(): ISMSProvider {
    return this.provider;
  }
}
