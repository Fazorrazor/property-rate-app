import { IPaymentProvider } from './types';
import { PaystackProvider } from './paystack';

export class PaymentGateway {
  private provider: IPaymentProvider;

  constructor(providerName: 'PAYSTACK' = 'PAYSTACK') {
    // We can orchestrate multiple providers here later (e.g. Hubtel, Flutterwave)
    if (providerName === 'PAYSTACK') {
      this.provider = new PaystackProvider();
    } else {
      this.provider = new PaystackProvider();
    }
  }

  getProvider() {
    return this.provider;
  }
}
