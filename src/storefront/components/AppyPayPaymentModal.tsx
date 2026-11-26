import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Clock3, LockKeyhole, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { C, F } from '../../theme';
import type { AppyPayCreateOrderResult } from '../../lib/api';
import { AppyPayWidget } from './AppyPayWidget';

type ModalPhase = 'loading' | 'ready' | 'releasing' | 'error';

type Props = {
  order: AppyPayCreateOrderResult;
  amount: number;
  formattedAmount: string;
  phoneNumber: string;
  lang: 'pt' | 'en';
  phase: ModalPhase;
  attempt: number;
  cancellationConfirmed: boolean;
  checkingSavedOrder: boolean;
  awaitingSavedPayment: boolean;
  initialAuthorizationStartedAt?: number;
  onAuthorizationStarted: (startedAt: number) => void;
  paymentFailed: boolean;
  retryFailed: boolean;
  onWidgetStateChange: (state: 'loading' | 'ready' | 'failed') => void;
  onCancel: () => void;
  onRetry: () => void;
  onViewStatus: () => void;
  onExpired: () => void;
};

export function AppyPayPaymentModal({
  order,
  amount,
  formattedAmount,
  phoneNumber,
  lang,
  phase,
  attempt,
  cancellationConfirmed,
  checkingSavedOrder,
  awaitingSavedPayment,
  initialAuthorizationStartedAt,
  onAuthorizationStarted,
  paymentFailed,
  retryFailed,
  onWidgetStateChange,
  onCancel,
  onRetry,
  onViewStatus,
  onExpired,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const expiredRef = useRef(false);
  const cancelRef = useRef(onCancel);
  const expiredCallbackRef = useRef(onExpired);
  const [now, setNow] = useState(() => Date.now());
  const expiresAt = new Date(order.reservationExpiresAt).getTime();
  const remainingSeconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const [authorizationStartedAt, setAuthorizationStartedAt] = useState(initialAuthorizationStartedAt ?? null);
  const startCallbackRef = useRef(onAuthorizationStarted);
  useEffect(() => {
    startCallbackRef.current = onAuthorizationStarted;
  }, [onAuthorizationStarted]);
  const startAuthorization = useCallback((startedAt: number) => {
    setNow(startedAt);
    setAuthorizationStartedAt(startedAt);
    startCallbackRef.current(startedAt);
  }, []);
  const paymentSeconds = authorizationStartedAt === null
    ? null
    : Math.max(0, Math.min(60, Math.ceil((authorizationStartedAt + 60_000 - now) / 1000)));
  const authorizationPending = (paymentSeconds !== null || awaitingSavedPayment) && !paymentFailed;
  const canCancel = phase !== 'releasing' && !checkingSavedOrder && !authorizationPending;
  const showError = phase === 'error' || paymentFailed;
  const canRetry = phase !== 'releasing' && (cancellationConfirmed || paymentFailed);
  const countdown = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  useEffect(() => {
    cancelRef.current = onCancel;
    expiredCallbackRef.current = onExpired;
  }, [onCancel, onExpired]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && canCancel) cancelRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [canCancel]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (remainingSeconds === 0 && !expiredRef.current && phase !== 'error' && !authorizationPending && !checkingSavedOrder && !paymentFailed) {
      expiredRef.current = true;
      expiredCallbackRef.current();
    }
  }, [phase, remainingSeconds, authorizationPending, checkingSavedOrder, paymentFailed]);

  const copy = lang === 'pt' ? {
    eyebrow: 'Pagamento seguro',
    title: 'Concluir com AppyPay',
    amount: 'Total da encomenda',
    reference: 'Encomenda',
    reserve: 'Stock reservado',
    reserveHelp: 'Mantemos os artigos reservados enquanto conclui o pagamento.',
    loading: 'A preparar as opções de pagamento...',
    loadingHelp: 'Isto pode demorar alguns segundos. Não feche esta janela.',
    errorTitle: 'Não foi possível abrir o AppyPay',
    errorHelp: cancellationConfirmed
      ? 'A reserva desta tentativa foi cancelada e o stock foi devolvido. Pode tentar novamente em segurança.'
      : 'Não conseguimos confirmar a libertação do stock. Não tente novamente até verificarmos a encomenda.',
    paymentTime: 'Tempo para autorizar',
    checkingPayment: 'A confirmar o estado do pagamento com o AppyPay…',
    paymentFailed: paymentSeconds === 0 ? 'O tempo para autorizar terminou' : 'O pagamento não foi concluído',
    retryPaymentHelp: 'Pode enviar um novo pedido de pagamento mantendo os dados da encomenda.',
    retryError: 'Não foi possível iniciar um novo pagamento. Verifique a encomenda ou tente novamente.',
    retry: 'Tentar novamente',
    cancel: 'Cancelar pagamento',
    cancelling: 'A cancelar e a libertar o stock...',
    status: 'Ver estado da encomenda',
    secure: 'O pagamento é processado pelo AppyPay. A encomenda só é confirmada após validação do pagamento.',
    close: 'Fechar e cancelar pagamento',
  } : {
    eyebrow: 'Secure payment',
    title: 'Complete with AppyPay',
    amount: 'Order total',
    reference: 'Order',
    reserve: 'Stock reserved',
    reserveHelp: 'We keep your items reserved while you complete payment.',
    loading: 'Preparing payment options...',
    loadingHelp: 'This can take a few seconds. Please keep this window open.',
    errorTitle: 'AppyPay could not be opened',
    errorHelp: cancellationConfirmed
      ? 'This attempt was cancelled and its stock was returned. You can safely try again.'
      : 'We could not confirm that the stock was released. Do not retry until the order has been checked.',
    paymentTime: 'Time to authorize',
    checkingPayment: 'Checking the payment status with AppyPay…',
    paymentFailed: paymentSeconds === 0 ? 'The authorization time has ended' : 'The payment was unsuccessful',
    retryPaymentHelp: 'You can send a new payment request using the same checkout details.',
    retryError: 'Could not start a new payment. Check the order status or try again.',
    retry: 'Try again',
    cancel: 'Cancel payment',
    cancelling: 'Cancelling and releasing stock...',
    status: 'View order status',
    secure: 'Payment is processed by AppyPay. Your order is only confirmed after the payment is verified.',
    close: 'Close and cancel payment',
  };

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(5,5,5,0.72)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', padding: 'clamp(10px, 3vw, 28px)' }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && canCancel) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="appypay-modal-title"
        aria-describedby="appypay-modal-description"
        style={{ width: 'min(100%, 640px)', maxHeight: 'calc(100dvh - 20px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.paper, border: `1px solid ${C.fieldBorder}`, borderRadius: 16, boxShadow: '0 28px 90px rgba(0,0,0,0.42)' }}
      >
        <header style={{ flex: '0 0 auto', padding: '18px clamp(18px, 4vw, 26px) 16px', borderBottom: `1px solid ${C.ruleLight}`, background: C.subtleBg }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, color: C.goldDeep, fontSize: 10, fontWeight: 900, letterSpacing: '0.13em', textTransform: 'uppercase' }}>
                <LockKeyhole size={13} aria-hidden="true" /> {copy.eyebrow}
              </div>
              <h2 id="appypay-modal-title" style={{ margin: 0, color: C.ink, fontFamily: F.display, fontSize: 'clamp(22px, 5vw, 30px)', lineHeight: 1.08 }}>
                {copy.title}
              </h2>
            </div>
            <button
              ref={closeRef}
              type="button"
              aria-label={copy.close}
              disabled={!canCancel}
              onClick={onCancel}
              style={{ width: 40, height: 40, flex: '0 0 40px', display: 'grid', placeItems: 'center', borderRadius: 999, border: `1px solid ${C.fieldBorder}`, background: C.paper, color: C.ink, cursor: canCancel ? 'pointer' : 'default' }}
            >
              <X size={19} aria-hidden="true" />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
            <div style={{ padding: '10px 12px', borderRadius: 10, background: C.paper, border: `1px solid ${C.ruleLight}` }}>
              <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{copy.amount}</div>
              <div style={{ marginTop: 3, color: C.ink, fontSize: 17, fontWeight: 900 }}>{formattedAmount}</div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 10, background: C.paper, border: `1px solid ${C.ruleLight}` }}>
              <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{copy.reference}</div>
              <div style={{ marginTop: 3, color: C.ink, fontSize: 14, fontWeight: 900 }}>#{order.orderNumber}</div>
            </div>
          </div>
        </header>

        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
          {!showError && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '11px clamp(18px, 4vw, 26px)', borderBottom: `1px solid ${C.ruleLight}`, background: C.tagBg }}>
              <Clock3 size={17} color={C.goldDeep} aria-hidden="true" />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: C.ink, fontSize: 11, fontWeight: 900 }}>
                  <span>{copy.reserve} · {countdown(remainingSeconds)}</span>
                  {paymentSeconds !== null && (
                    <span role="timer" aria-label={copy.paymentTime}> · {copy.paymentTime} {countdown(paymentSeconds)}</span>
                  )}
                </div>
                <div style={{ color: C.inkSoft, fontSize: 10, lineHeight: 1.35 }}>{copy.reserveHelp}</div>
              </div>
            </div>
          )}
          {authorizationPending && !awaitingSavedPayment && paymentSeconds === 0 && (
            <p role="status" style={{ padding: '0 18px', color: C.ink }}>{copy.checkingPayment}</p>
          )}

          {showError ? (
            <div role="alert" style={{ minHeight: 360, display: 'grid', placeItems: 'center', padding: '34px 24px', textAlign: 'center' }}>
              <div style={{ maxWidth: 420 }}>
                <div style={{ width: 54, height: 54, margin: '0 auto 16px', borderRadius: 999, display: 'grid', placeItems: 'center', background: C.dangerBg, color: C.danger }}>
                  <AlertTriangle size={25} aria-hidden="true" />
                </div>
                <h3 style={{ margin: '0 0 8px', color: C.ink, fontFamily: F.display, fontSize: 22 }}>{paymentFailed ? copy.paymentFailed : copy.errorTitle}</h3>
                <p style={{ margin: 0, color: C.inkSoft, fontSize: 12, lineHeight: 1.65 }}>{retryFailed ? copy.retryError : paymentFailed ? copy.retryPaymentHelp : copy.errorHelp}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 22 }}>
                  <button type="button" onClick={onRetry} disabled={!canRetry} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 16px', borderRadius: 8, border: `1px solid ${canRetry ? C.ctaBorder : C.disabledBg}`, background: canRetry ? C.ctaBg : C.disabledBg, color: canRetry ? C.onDark : C.disabledFg, fontWeight: 900 }}>
                    <RotateCcw size={15} aria-hidden="true" /> {copy.retry}
                  </button>
                  <button type="button" onClick={onViewStatus} style={{ padding: '11px 16px', borderRadius: 8, border: `1px solid ${C.fieldBorder}`, background: C.paper, color: C.ink, fontWeight: 900 }}>{copy.status}</button>
                </div>
              </div>
            </div>
          ) : checkingSavedOrder || awaitingSavedPayment ? (
            <div role="status" style={{ padding: '34px 24px', textAlign: 'center', color: C.ink }}>
              {copy.checkingPayment}
            </div>
          ) : (
            <div style={{ position: 'relative', background: '#fff', minHeight: 420 }}>
              {remainingSeconds > 0 && <AppyPayWidget
                amount={amount}
                description={`Use Me With Style ${order.orderNumber}`}
                orderNumber={order.orderNumber}
                merchantTransactionId={order.merchantTransactionId}
                phoneNumber={phoneNumber}
                lang={lang}
                attempt={attempt}
                onStateChange={onWidgetStateChange}
                onAuthorizationStarted={startAuthorization}
              />}
              {(phase === 'loading' || phase === 'releasing') && (
                <div aria-live="polite" style={{ position: 'absolute', inset: 0, minHeight: 420, display: 'grid', placeItems: 'center', padding: 28, background: '#FFFDF8', color: '#171714', textAlign: 'center' }}>
                  <div style={{ maxWidth: 360 }}>
                    <div className="appypay-payment-spinner" style={{ width: 34, height: 34, margin: '0 auto 17px', border: '3px solid #E7E0D5', borderTopColor: '#7E5D1F', borderRadius: 999 }} />
                    <div style={{ fontFamily: F.display, fontSize: 19, fontWeight: 900 }}>{phase === 'releasing' ? copy.cancelling : copy.loading}</div>
                    {phase === 'loading' && <div style={{ marginTop: 7, fontSize: 11, lineHeight: 1.5, color: '#68655D' }}>{copy.loadingHelp}</div>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <footer id="appypay-modal-description" style={{ flex: '0 0 auto', padding: '13px clamp(18px, 4vw, 26px)', borderTop: `1px solid ${C.ruleLight}`, background: C.subtleBg }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, color: C.inkSoft, fontSize: 10, lineHeight: 1.45 }}>
            <ShieldCheck size={17} color={C.goldDeep} aria-hidden="true" style={{ flex: '0 0 auto' }} />
            <span>{copy.secure}</span>
          </div>
          {!showError && (checkingSavedOrder || awaitingSavedPayment || (authorizationPending && paymentSeconds === 0)) && (
            <button type="button" onClick={onViewStatus} style={{ marginTop: 12 }}>{copy.status}</button>
          )}
          {!showError && !checkingSavedOrder && !authorizationPending && (
            <button type="button" onClick={onCancel} disabled={!canCancel} style={{ width: '100%', marginTop: 12, padding: 11, borderRadius: 8, border: `1px solid ${C.fieldBorder}`, background: C.paper, color: C.ink, fontWeight: 900, cursor: canCancel ? 'pointer' : 'default' }}>
              {phase === 'releasing' ? copy.cancelling : copy.cancel}
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  );
}
