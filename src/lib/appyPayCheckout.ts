import type { AppyPayCreateOrderResult } from './api';

const APPYPAY_CHECKOUT_KEY = 'ump-appypay-checkout';

export function emptyCheckoutForm(market: string) {
  return {
    firstName: '',
    lastName: '',
    phoneCountryIso2: market === 'AO' ? 'AO' : 'PT',
    phone: '',
    email: '',
    address: '',
    addressLine2: '',
    deliveryReference: '',
    postalCode: '',
    city: '',
    country: market === 'AO' ? 'Angola' : 'Portugal',
    taxId: '',
    notes: '',
  };
}

export type CheckoutCoupon = { code: string; discountAmount: number; freeShipping: boolean; label: string };

type SavedAppyPayCheckout = {
  order: AppyPayCreateOrderResult;
  form: ReturnType<typeof emptyCheckoutForm>;
  coupon: CheckoutCoupon | null;
  amount: number;
  authorizationStartedAt?: number;
};

export function readAppyPayCheckout(): SavedAppyPayCheckout | null {
  try {
    const raw = sessionStorage.getItem(APPYPAY_CHECKOUT_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as SavedAppyPayCheckout;
    return snapshot.order?.cancellationToken && snapshot.form && Number.isFinite(snapshot.amount)
      ? snapshot : null;
  } catch {
    return null;
  }
}

export function saveAppyPayCheckout(snapshot: SavedAppyPayCheckout | null) {
  try {
    if (snapshot) sessionStorage.setItem(APPYPAY_CHECKOUT_KEY, JSON.stringify(snapshot));
    else sessionStorage.removeItem(APPYPAY_CHECKOUT_KEY);
  } catch {
    // Checkout continues in memory if session storage is unavailable.
  }
}
