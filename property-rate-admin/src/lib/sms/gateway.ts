import { ISMSProvider } from './types';
import { TwilioProvider } from './twilio';
import { ArkeselProvider } from './arkesel';

export type SMSProviderType = 'ARKESEL' | 'TWILIO';

export class SMSGateway {
  private provider: ISMSProvider;

  constructor(providerType?: SMSProviderType) {
    const activeProvider = providerType || (process.env.SMS_PROVIDER?.toUpperCase() as SMSProviderType) || (process.env.ARKESEL_API_KEY ? 'ARKESEL' : 'TWILIO');

    switch (activeProvider) {
      case 'ARKESEL':
        this.provider = new ArkeselProvider();
        break;
      case 'TWILIO':
        this.provider = new TwilioProvider();
        break;
      default:
        this.provider = new ArkeselProvider();
    }
  }

  getProvider(): ISMSProvider {
    return this.provider;
  }
}
