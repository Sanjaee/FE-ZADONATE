/**
 * Midtrans New 3DS JS - Get Card Token & Authenticate
 * @see https://docs.midtrans.com/docs/card-payment-getting-started
 */
interface MidtransGetCardTokenResponse {
  status_code: string;
  status_message?: string;
  token_id: string;
  hash?: string;
}

/** Response dari 3DS authenticate onSuccess (transaction_status: "capture" = sukses) */
export interface Midtrans3DSResponse {
  status_code?: string;
  status_message?: string;
  transaction_status?: string;
  transaction_id?: string;
  order_id?: string;
  [key: string]: unknown;
}

interface MidtransAuthenticateOptions {
  performAuthentication: (redirectUrl: string) => void;
  onSuccess: (response: Midtrans3DSResponse) => void;
  onFailure: (response: unknown) => void;
  onPending: (response: unknown) => void;
}

declare global {
  interface Window {
    MidtransNew3ds?: {
      getCardToken: (
        cardData: {
          card_number: string | number;
          card_exp_month: number | string;
          card_exp_year: number | string;
          card_cvv: string | number;
          bank_one_time_token?: string;
        },
        options: {
          onSuccess: (response: MidtransGetCardTokenResponse) => void;
          onFailure: (response: unknown) => void;
        }
      ) => void;
      authenticate: (redirectUrl: string, options: MidtransAuthenticateOptions) => void;
    };
  }
}

export {};
