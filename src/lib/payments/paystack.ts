import { IPaymentProvider, InitializationParams, InitializationResponse, VerificationResponse, ChargeParams, ChargeResponse, ResolveAccountResponse } from './types';

export class PaystackProvider implements IPaymentProvider {
  private secretKey: string;
  private baseUrl = 'https://api.paystack.co';

  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || '';
  }

  private async fetchPaystack(endpoint: string, options: RequestInit = {}) {
    if (!this.secretKey) {
      throw new Error('PAYSTACK_SECRET_KEY is not configured in environment variables.');
    }
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
          channels: params.channels,
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
      // If customer name details are provided, sync with Paystack customer records
      if (params.firstName || params.lastName) {
        try {
          const custRes = await this.fetchPaystack('/customer', {
            method: 'POST',
            body: JSON.stringify({
              email: params.email,
              first_name: params.firstName,
              last_name: params.lastName,
              phone: params.phone || params.mobile_money.phone,
            }),
          });
          if (custRes.status === 200 && custRes.data?.data?.customer_code) {
            await this.fetchPaystack(`/customer/${custRes.data.data.customer_code}`, {
              method: 'PUT',
              body: JSON.stringify({
                first_name: params.firstName,
                last_name: params.lastName,
                phone: params.phone || params.mobile_money.phone,
              }),
            }).catch(() => {});
          }
        } catch (syncErr) {
          console.warn('Paystack customer profile sync non-blocking error:', syncErr);
        }
      }

      const { status, data } = await this.fetchPaystack('/charge', {
        method: 'POST',
        body: JSON.stringify({
          email: params.email,
          amount: Math.round(params.amount * 100),
          reference: params.reference,
          mobile_money: params.mobile_money,
          metadata: {
            ...params.metadata,
            first_name: params.firstName,
            last_name: params.lastName,
            customer_name: [params.firstName, params.lastName].filter(Boolean).join(' '),
          },
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

  async submitOtp(reference: string, otp: string): Promise<ChargeResponse> {
    try {
      const { status, data } = await this.fetchPaystack('/charge/submit_otp', {
        method: 'POST',
        body: JSON.stringify({
          reference,
          otp: otp.trim(),
        }),
      });

      if (status !== 200 || !data.status) {
        let errorMessage = data.message || 'Failed to submit OTP';
        if (data.data?.message) {
          errorMessage = data.data.message;
        } else if (data.data?.display_text) {
          errorMessage = data.data.display_text;
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
      console.error('Paystack submit OTP error:', error);
      return { success: false, error: error.message };
    }
  }

  async resendOtp(reference: string): Promise<ChargeResponse> {
    try {
      const { status, data } = await this.fetchPaystack('/charge/resend_otp', {
        method: 'POST',
        body: JSON.stringify({ reference }),
      });

      if (status !== 200 || !data.status) {
        let errorMessage = data.message || 'Failed to resend OTP';
        if (data.data?.message) {
          errorMessage = data.data.message;
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
      console.error('Paystack resend OTP error:', error);
      return { success: false, error: error.message };
    }
  }

  async resolveMobileMoneyAccount(phoneNumber: string, network?: string): Promise<ResolveAccountResponse> {
    try {
      const cleanDigits = phoneNumber.replace(/\D/g, '');
      const accountNumber =
        cleanDigits.length === 12 && cleanDigits.startsWith('233')
          ? '0' + cleanDigits.substring(3)
          : cleanDigits;

      let bankCode = 'MTN';
      const netUpper = (network || '').toUpperCase();
      if (netUpper === 'TELECEL' || netUpper === 'VODAFONE' || netUpper === 'VOD') {
        bankCode = 'VOD';
      } else if (netUpper === 'AIRTELTIGO' || netUpper === 'AT' || netUpper === 'ATL') {
        bankCode = 'ATL';
      }

      const { status, data } = await this.fetchPaystack(
        `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
        { method: 'GET' }
      );

      if (status === 200 && data.status && data.data?.account_name) {
        return {
          success: true,
          accountName: data.data.account_name,
          accountNumber: data.data.account_number,
          bankId: data.data.bank_id,
        };
      }

      return {
        success: false,
        error: data.message || 'Could not resolve mobile money account',
      };
    } catch (error: any) {
      console.error('Paystack mobile money resolve error:', error);
      return { success: false, error: error.message };
    }
  }
}

