export interface InitializationParams {
  amount: number; // In GHS, gateway should handle conversion to pesewas if needed
  email: string;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, any>;
}

export interface InitializationResponse {
  success: boolean;
  authorizationUrl?: string;
  accessCode?: string;
  reference?: string;
  error?: string;
}

export interface VerificationResponse {
  success: boolean;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'ABANDONED';
  amount: number; // In GHS
  reference: string;
  gatewayResponse?: string;
  error?: string;
}

export interface ChargeParams {
  email: string;
  amount: number;
  reference: string;
  mobile_money: {
    phone: string;
    provider: 'mtn' | 'vod' | 'tgo';
  };
  metadata?: any;
}

export interface ChargeResponse {
  success: boolean;
  status?: string; // 'send_otp', 'pay_offline', etc.
  reference?: string;
  displayText?: string;
  error?: string;
}

export interface IPaymentProvider {
  initializeTransaction(params: InitializationParams): Promise<InitializationResponse>;
  chargeMobileMoney(params: ChargeParams): Promise<ChargeResponse>;
  verifyTransaction(reference: string): Promise<VerificationResponse>;
}
