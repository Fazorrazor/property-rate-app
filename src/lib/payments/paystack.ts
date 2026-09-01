import { IPaymentProvider, InitializationParams, InitializationResponse, VerificationResponse, ChargeParams, ChargeResponse } from './types';

export class PaystackProvider implements IPaymentProvider {
  private secretKey: string;
  private baseUrl = 'https://api.paystack.co';

  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || '';
  }

  private async fetchPaystack(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();
    return { status: response.status, data };
  }

  async initializeTransaction(params: InitializationParams): Promise<InitializationResponse> {
    try {
      const { status, data } = await this.fetchPaystack('/transaction/initialize', {
        method: 'POST',
        body: JSON.stringify({
          email: params.email,
          amount: Math.round(params.amount * 100), // Convert GHS to pesewas
          reference: params.reference,
          callback_url: params.callbackUrl,
          metadata: params.metadata,
        }),
      });

      if (status !== 200 || !data.status) {
        return {
          success: false,
          error: data.message || 'Failed to initialize Paystack transaction',
        };
      }

      return {
        success: true,
        authorizationUrl: data.data.authorization_url,
        accessCode: data.data.access_code,
        reference: data.data.reference,
      };
    } catch (error: any) {
      console.error('Paystack init error:', error);
      return { success: false, error: error.message };
    }
  }

  async chargeMobileMoney(params: ChargeParams): Promise<ChargeResponse> {
    try {
      const { status, data } = await this.fetchPaystack('/charge', {
        method: 'POST',
        body: JSON.stringify({
          email: params.email,
          amount: Math.round(params.amount * 100),
          reference: params.reference,
          mobile_money: params.mobile_money,
          metadata: params.metadata,
        }),
      });

      if (status !== 200 || !data.status) {
        let errorMessage = data.message || 'Failed to initiate Paystack mobile money charge';
        
        // Paystack sometimes returns 'status: false' with 'message: "Charge attempted"', 
        // but puts the real error in data.data.message or data.data.display_text
        if (data.data) {
          if (data.data.message) {
            errorMessage = data.data.message;
          } else if (data.data.display_text) {
            errorMessage = data.data.display_text;
          }
        }
        
        return {
          success: false,
          error: errorMessage,
        };
      }

      return {
        success: true,
        status: data.data.status,
        reference: data.data.reference,
        displayText: data.data.display_text,
      };
    } catch (error: any) {
      console.error('Paystack charge error:', error);
      return { success: false, error: error.message };
    }
  }

  async verifyTransaction(reference: string): Promise<VerificationResponse> {
    try {
      const { status, data } = await this.fetchPaystack(`/transaction/verify/${reference}`, {
        method: 'GET',
      });

      if (status !== 200 || !data.status) {
        return {
          success: false,
          status: 'FAILED',
          amount: 0,
          reference,
          error: data.message || 'Failed to verify transaction',
        };
      }

      const txData = data.data;
      let mappedStatus: VerificationResponse['status'] = 'PENDING';

      if (txData.status === 'success') {
        mappedStatus = 'SUCCESS';
      } else if (txData.status === 'failed') {
        mappedStatus = 'FAILED';
      } else if (txData.status === 'abandoned') {
        mappedStatus = 'ABANDONED';
      }

      return {
        success: true,
        status: mappedStatus,
        amount: txData.amount / 100, // Convert pesewas back to GHS
        reference: txData.reference,
        gatewayResponse: txData.gateway_response,
      };
    } catch (error: any) {
      console.error('Paystack verify error:', error);
      return {
        success: false,
        status: 'FAILED',
        amount: 0,
        reference,
        error: error.message,
      };
    }
  }
}
