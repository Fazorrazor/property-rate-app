'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useDragControls } from 'framer-motion';
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Printer,
  Share2,
  X,
  Send,
  Phone,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';
import { AppleSpinner } from './ui/AppleSpinner';
import {
  UnifiedPaymentRecord,
  getReceiptSmsStatus,
  sendInPersonPaymentConfirmationSms,
  getAccountTelephone,
  getAccountRemainingBalance,
} from '@/app/actions';
import { formatGhc } from '@/lib/formatters';

export interface PaymentReceiptModalProps {
  payment: UnifiedPaymentRecord | null;
  onClose: () => void;
  defaultPhone?: string;
  outstandingBalance?: number;
  currentAdmin?: {
    id: string;
    username: string;
    name?: string | null;
    role: string;
  } | null;
  onOpenStatement?: (accountNo: string) => void;
  onUpdateReceiptNumber?: (
    newReceiptNo: string,
    sendSmsNotice: boolean
  ) => Promise<{ success: boolean; error?: string; updatedReceiptNumber?: string }>;
}

function middleTruncate(str?: string, lead = 7, tail = 3): string {
  if (!str) return '';
  if (str.length <= lead + tail + 1) return str;
  return `${str.slice(0, lead)}…${str.slice(-tail)}`;
}

function formatDisplayDateTime(dateStr?: string, timeStr?: string): string {
  if (!dateStr) return '';
  const cleanDate = dateStr.replace(/^0(\d)/, '$1');
  return timeStr ? `${cleanDate}, ${timeStr}` : cleanDate;
}

/**
 * Detect constrained/low-end devices (mid-range Android, low CPU cores/memory, or prefers-reduced-transparency)
 * to gracefully substitute heavy full-screen GPU blur with a high-performance flat scrim.
 */
function useIsLowEndDevice(): boolean {
  const [isLowEnd, setIsLowEnd] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const nav = window.navigator as any;
      const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
      const lowCores = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4;
      const prefersReducedTrans = window.matchMedia?.('(prefers-reduced-transparency: reduce)')?.matches;
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      const supportsBlur = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('backdrop-filter', 'blur(1px)');

      if (!supportsBlur || lowMemory || lowCores || prefersReducedTrans || prefersReducedMotion) {
        setIsLowEnd(true);
      }
    } catch {
      // Safe fallback on strict sandbox environments
      setIsLowEnd(false);
    }
  }, []);

  return isLowEnd;
}

export function PaymentReceiptModal({
  payment,
  onClose,
  defaultPhone,
  outstandingBalance,
  currentAdmin,
  onOpenStatement,
  onUpdateReceiptNumber,
}: PaymentReceiptModalProps) {
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [isEditingPhysical, setIsEditingPhysical] = useState(false);
  const [physicalInput, setPhysicalInput] = useState('');
  const [sendSmsNotice, setSendSmsNotice] = useState(true);
  const [isSavingPhysical, setIsSavingPhysical] = useState(false);
  const [physicalError, setPhysicalError] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(true);

  // SMS Notification tracking & dispatch states
  const [smsSent, setSmsSent] = useState<boolean>(false);
  const [smsSentAt, setSmsSentAt] = useState<string | null>(null);
  const [isCheckingSms, setIsCheckingSms] = useState<boolean>(false);
  const [isSendingSms, setIsSendingSms] = useState<boolean>(false);
  const [showSmsDrawer, setShowSmsDrawer] = useState<boolean>(false);
  const [smsPhoneInput, setSmsPhoneInput] = useState<string>('');
  const [remainingBal, setRemainingBal] = useState<number>(outstandingBalance ?? 0);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [smsToast, setSmsToast] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const dragControls = useDragControls();
  const isLowEnd = useIsLowEndDevice();

  // Initialize state & check SMS delivery status when payment changes
  useEffect(() => {
    if (payment) {
      setPhysicalInput(payment.receiptNumber || '');
      setIsEditingPhysical(false);
      setPhysicalError(null);
      const initialPhone = (payment.payerPhone || defaultPhone || '').trim();
      setSmsPhoneInput(initialPhone);
      setShowSmsDrawer(false);
      setSmsError(null);

      let isCancelled = false;

      // If phone wasn't attached to payment record, query linked property telephone from DB
      if (!initialPhone && payment.accountNo) {
        getAccountTelephone(payment.accountNo).then((phone) => {
          if (!isCancelled && phone) {
            setSmsPhoneInput(phone.trim());
          }
        });
      }

      // Query live remaining balance from DB if not provided via prop
      if (typeof outstandingBalance === 'number') {
        setRemainingBal(outstandingBalance);
      } else if (payment.accountNo) {
        getAccountRemainingBalance(payment.accountNo).then((bal) => {
          if (!isCancelled && typeof bal === 'number') {
            setRemainingBal(bal);
          }
        });
      }

      async function checkStatus() {
        if (!payment?.receiptNumber) return;
        setIsCheckingSms(true);
        try {
          const res = await getReceiptSmsStatus(payment.receiptNumber);
          if (!isCancelled && res.sent) {
            setSmsSent(true);
            setSmsSentAt(res.sentAt || null);
          } else if (!isCancelled) {
            setSmsSent(false);
            setSmsSentAt(null);
          }
        } catch (e) {
          console.error('Failed to check receipt SMS status:', e);
        } finally {
          if (!isCancelled) setIsCheckingSms(false);
        }
      }
      checkStatus();
      return () => {
        isCancelled = true;
      };
    }
  }, [payment, defaultPhone, outstandingBalance]);

  const handleDispatchSms = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!payment) return;
    const phone = smsPhoneInput.trim();
    if (!phone) {
      setSmsError('Please enter a recipient phone number.');
      return;
    }

    setIsSendingSms(true);
    setSmsError(null);
    try {
      const res = await sendInPersonPaymentConfirmationSms({
        accountNumber: payment.accountNo,
        ratepayerName: payment.payerName || 'Ratepayer',
        amount: payment.amountPaid,
        receiptNumber: payment.receiptNumber,
        remainingBalance: remainingBal,
        recipientPhone: phone,
      });

      if (res.success) {
        setSmsSent(true);
        setSmsSentAt(new Date().toISOString());
        setShowSmsDrawer(false);
        setSmsToast(`Confirmation SMS sent to ${phone}`);
        setTimeout(() => setSmsToast(null), 3500);
      } else {
        setSmsError(res.error || 'Failed to dispatch SMS confirmation.');
      }
    } catch (err: any) {
      setSmsError(err.message || 'An unexpected error occurred while dispatching SMS.');
    } finally {
      setIsSendingSms(false);
    }
  };

  // Accessibility: Focus trapping, scroll lock & escape dismiss
  useEffect(() => {
    if (!payment) return;

    previousActiveElement.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditingPhysical) {
          setIsEditingPhysical(false);
          setPhysicalError(null);
        } else {
          onClose();
        }
        return;
      }

      // Focus trap
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableElements.length) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus({ preventScroll: true });
      }
    };
  }, [payment, isEditingPhysical, onClose]);

  const handleAnimationComplete = useCallback(() => {
    setIsAnimating(false);
  }, []);

  if (!payment) return null;

  const dateTimeText = formatDisplayDateTime(payment.formattedDate, payment.formattedTime);
  const methodText =
    payment.paymentCategory === 'ONLINE'
      ? 'Online App (Paystack)'
      : payment.paymentMethod || 'In-Person Cash';

  const handleCopyReference = async () => {
    if (!payment.transactionReference) return;
    try {
      await navigator.clipboard.writeText(payment.transactionReference);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 1500);
    } catch {}
  };

  const handleShare = async () => {
    const summaryLines = [
      'HEINZ INTEGRATED SYSTEMS LIMITED',
      'Official Payment Receipt',
      '----------------------------------------',
      `Amount: ${payment.amountPaidFormatted}`,
      `Status: Paid`,
      `Date: ${dateTimeText}`,
      `Receipt No: ${payment.receiptNumber}`,
      `Property Account: ${payment.accountNo}`,
      `Method: ${methodText}`,
      payment.transactionReference ? `Reference: ${payment.transactionReference}` : null,
      payment.arrearsPaid > 0 ? `Overdue: ${formatGhc(payment.arrearsPaid)}` : null,
      payment.currentPaid > 0 ? `Current: ${formatGhc(payment.currentPaid)}` : null,
      '----------------------------------------',
      'Official Municipal Record',
    ].filter(Boolean);

    const shareText = summaryLines.join('\n');

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Receipt ${payment.receiptNumber}`,
          text: shareText,
        });
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 1500);
    } catch {}
  };

  const handleSavePhysical = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = physicalInput.trim();
    if (!clean) {
      setPhysicalError('Please enter a valid receipt number.');
      return;
    }

    if (!onUpdateReceiptNumber) {
      setIsEditingPhysical(false);
      return;
    }

    setIsSavingPhysical(true);
    setPhysicalError(null);
    try {
      const res = await onUpdateReceiptNumber(clean, sendSmsNotice);
      if (res.success) {
        setIsEditingPhysical(false);
      } else {
        setPhysicalError(res.error || 'Failed to update receipt number.');
      }
    } catch (err: any) {
      setPhysicalError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSavingPhysical(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center select-none ${
        isLowEnd ? 'bg-black/60' : 'bg-black/45 backdrop-blur-xs'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <motion.div
        id="payment-receipt-print-area"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-dialog-title"
        tabIndex={-1}
        initial={{ opacity: 0, y: 32, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, transition: { duration: 0.15, ease: 'easeIn' } }}
        transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}
        onAnimationStart={() => setIsAnimating(true)}
        onAnimationComplete={handleAnimationComplete}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.35 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 80 || info.velocity.y > 400) {
            onClose();
          }
        }}
        style={{
          willChange: isAnimating ? 'transform, opacity' : 'auto',
        }}
        className="w-full sm:max-w-[440px] max-h-[92dvh] bg-white rounded-t-[20px] sm:rounded-[20px] shadow-xl sm:shadow-2xl flex flex-col overflow-hidden relative outline-none border border-[#E5E5EA]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Handle (Grabber with Isolated Touch Controls) */}
        <div
          className="sm:hidden w-full pt-2.5 pb-2 flex justify-center cursor-grab active:cursor-grabbing no-print touch-none select-none"
          onPointerDown={(e) => dragControls.start(e)}
          style={{ touchAction: 'none' }}
        >
          <div className="w-9 h-1 rounded-full bg-[#D2D2D7]" />
        </div>

        {/* Desktop Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="hidden sm:flex absolute top-3.5 right-3.5 w-8 h-8 rounded-full items-center justify-center text-[#8E8E93] hover:text-[#1D1D1F] hover:bg-[#F2F2F7] transition-colors cursor-pointer z-10 no-print"
          title="Close Receipt"
          aria-label="Close Receipt"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Scrollable Receipt Body (Hardware-Contained & Isolated from Drag) */}
        <div
          className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 pt-3 sm:pt-6 pb-4 space-y-5 no-scrollbar"
          style={{
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            contain: 'layout paint style',
          }}
        >
          {/* Header Block (Centered) */}
          <div className="text-center space-y-1">
            <div className="w-10 h-10 rounded-xl bg-[#007AFF] text-white flex items-center justify-center mx-auto mb-2 shadow-xs">
              <Building2 className="w-5 h-5 stroke-[2]" />
            </div>
            <h2
              id="receipt-dialog-title"
              className="text-[15px] font-semibold text-[#1D1D1F] tracking-tight leading-tight uppercase"
            >
              HEINZ INTEGRATED SYSTEMS LIMITED
            </h2>
            <p className="text-[13px] text-[#86868B] font-normal">
              Official Payment Receipt
            </p>
          </div>

          {/* Amount Hero */}
          <div className="text-center pt-1 pb-2">
            <div className="text-[32px] sm:text-[38px] font-semibold tracking-tight text-[#1D1D1F] tabular-nums leading-none">
              {payment.amountPaidFormatted}
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-2.5 text-[13px]">
              <span className="inline-flex items-center gap-1 text-[#34C759] font-medium">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                Paid
              </span>
              <span className="text-[#86868B]">&bull;</span>
              <span className="text-[#86868B]">{dateTimeText}</span>
            </div>
          </div>

          {/* Details List (Inset Grouped) */}
          <div className="rounded-[12px] bg-[#F5F5F7] border border-[#E5E5EA]/70 divide-y divide-[#E5E5EA] overflow-hidden">
            {/* Receipt No */}
            <div className="min-h-[44px] px-3.5 py-2.5 flex items-center justify-between gap-3 text-[15px]">
              <span className="text-[#86868B] shrink-0">Receipt No</span>
              <span className="text-[#1D1D1F] font-medium text-right truncate">
                {payment.receiptNumber}
              </span>
            </div>

            {/* Property Account */}
            <div className="min-h-[44px] px-3.5 py-2.5 flex items-center justify-between gap-3 text-[15px]">
              <span className="text-[#86868B] shrink-0">Property Account</span>
              {onOpenStatement ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenStatement(payment.accountNo);
                  }}
                  className="text-[#007AFF] hover:underline font-medium text-right truncate cursor-pointer transition-colors"
                  title={`View statement for ${payment.accountNo}`}
                >
                  {payment.accountNo}
                </button>
              ) : (
                <span className="text-[#1D1D1F] font-medium text-right truncate">
                  {payment.accountNo}
                </span>
              )}
            </div>

            {/* Method */}
            <div className="min-h-[44px] px-3.5 py-2.5 flex items-center justify-between gap-3 text-[15px]">
              <span className="text-[#86868B] shrink-0">Method</span>
              <span className="text-[#1D1D1F] font-medium text-right truncate">
                {methodText}
              </span>
            </div>

            {/* Reference */}
            {payment.transactionReference && (
              <div className="min-h-[44px] px-3.5 py-2.5 flex items-center justify-between gap-3 text-[15px]">
                <span className="text-[#86868B] shrink-0">Reference</span>
                <button
                  type="button"
                  onClick={handleCopyReference}
                  className="inline-flex items-center gap-1.5 text-[#1D1D1F] hover:text-[#007AFF] font-medium text-right cursor-pointer group transition-colors focus:outline-none"
                  title="Copy full transaction reference"
                >
                  <span>{middleTruncate(payment.transactionReference)}</span>
                  {copiedRef ? (
                    <span className="text-xs text-[#34C759] font-semibold" aria-live="polite">
                      Copied
                    </span>
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#8E8E93] group-hover:text-[#007AFF] transition-colors shrink-0" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Allocation Group (Only if non-zero) */}
          {(payment.arrearsPaid > 0 || payment.currentPaid > 0) && (
            <div className="rounded-[12px] bg-[#F5F5F7] border border-[#E5E5EA]/70 divide-y divide-[#E5E5EA] overflow-hidden">
              {payment.arrearsPaid > 0 && (
                <div className="min-h-[44px] px-3.5 py-2.5 flex items-center justify-between gap-3 text-[15px]">
                  <span className="text-[#86868B] shrink-0">Overdue</span>
                  <span className="text-[#1D1D1F] font-medium tabular-nums text-right">
                    {formatGhc(payment.arrearsPaid)}
                  </span>
                </div>
              )}
              {payment.currentPaid > 0 && (
                <div className="min-h-[44px] px-3.5 py-2.5 flex items-center justify-between gap-3 text-[15px]">
                  <span className="text-[#86868B] shrink-0">Current</span>
                  <span className="text-[#1D1D1F] font-medium tabular-nums text-right">
                    {formatGhc(payment.currentPaid)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Staff-Only Physical Receipt Row (Discrete inline row) */}
          {currentAdmin && (
            <div className="rounded-[12px] bg-[#F5F5F7] border border-[#E5E5EA]/70 p-3.5 no-print transition-all">
              {!isEditingPhysical ? (
                <div className="min-h-[38px] flex items-center justify-between gap-3 text-[15px]">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[#86868B] shrink-0">Physical receipt no.</span>
                    <span className="text-[#1D1D1F] font-medium truncate">
                      {payment.receiptNumber || 'Not set'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPhysicalInput(payment.receiptNumber || '');
                      setIsEditingPhysical(true);
                      setPhysicalError(null);
                    }}
                    className="text-[#007AFF] hover:underline font-medium text-[15px] cursor-pointer shrink-0"
                  >
                    Edit
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSavePhysical} className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="physicalReceiptInput"
                      className="text-xs font-semibold text-[#1D1D1F]"
                    >
                      Physical receipt no.
                    </label>
                    <span className="text-[11px] text-[#86868B]">Enter to save &bull; Esc to cancel</span>
                  </div>

                  {physicalError && (
                    <div className="p-2 rounded-lg bg-[#FF3B30]/10 text-[#FF3B30] text-xs font-medium">
                      {physicalError}
                    </div>
                  )}

                  <input
                    id="physicalReceiptInput"
                    type="text"
                    required
                    autoFocus
                    value={physicalInput}
                    onChange={(e) => setPhysicalInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setIsEditingPhysical(false);
                        setPhysicalError(null);
                      }
                    }}
                    placeholder="e.g. GCR-104928"
                    className="w-full px-3 py-2 bg-white border border-[#D2D2D7] rounded-lg text-[16px] sm:text-[15px] font-medium text-[#1D1D1F] outline-none focus:border-[#007AFF] min-h-[40px]"
                  />

                  <div className="flex items-center gap-2 pt-0.5">
                    <input
                      type="checkbox"
                      id="receiptSendSms"
                      checked={sendSmsNotice}
                      onChange={(e) => setSendSmsNotice(e.target.checked)}
                      className="rounded text-[#007AFF] w-4 h-4 cursor-pointer"
                    />
                    <label
                      htmlFor="receiptSendSms"
                      className="text-xs text-[#6E6E73] cursor-pointer select-none"
                    >
                      Send SMS notice to resident
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isSavingPhysical}
                      onClick={() => {
                        setIsEditingPhysical(false);
                        setPhysicalError(null);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-[#D2D2D7] text-[#1D1D1F] text-xs font-medium cursor-pointer min-h-[36px]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingPhysical}
                      className="px-3.5 py-1.5 rounded-lg bg-[#007AFF] hover:bg-[#0071E3] text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 min-h-[36px]"
                    >
                      {isSavingPhysical ? (
                        <>
                          <AppleSpinner size="xs" className="text-white" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <span>Save</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Print-Only Official Footer */}
          <div className="print-only text-center pt-8 border-t border-black/10">
            <p className="text-[11px] font-medium text-black">
              Official Municipal Record
            </p>
            <p className="text-[10px] text-black/60 mt-0.5">
              HEINZ INTEGRATED SYSTEMS LIMITED &bull; Revenue Directorate
            </p>
          </div>
        </div>

        {/* SMS Notice Feedback Toast */}
        {smsToast && (
          <div className="mx-5 sm:mx-6 mb-2 p-2.5 rounded-xl bg-[#34C759]/10 border border-[#34C759]/20 text-[#34C759] text-xs font-semibold flex items-center gap-2 animate-in fade-in no-print">
            <CheckCircle2 className="w-4 h-4 stroke-[2.2]" />
            <span>{smsToast}</span>
          </div>
        )}

        {/* SMS Notice Dispatch Overlay/Drawer */}
        {showSmsDrawer && (
          <div className="px-5 sm:px-6 py-4 bg-[#FAFAFC] border-t border-[#E8E8ED] space-y-3.5 animate-in fade-in duration-150 no-print">
            <div className="flex items-center justify-between border-b border-[#E8E8ED] pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center">
                  <Send className="w-3.5 h-3.5 stroke-[2]" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#1D1D1F]">
                    {smsSent ? 'Resend Payment SMS Notice' : 'Send Payment SMS Notice'}
                  </h4>
                  <p className="text-[10px] text-[#8E8E93]">
                    Official GCR #{payment.receiptNumber} &bull; Property #{payment.accountNo}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSmsDrawer(false);
                  setSmsError(null);
                }}
                className="w-6 h-6 rounded-md flex items-center justify-center text-[#8E8E93] hover:text-[#1D1D1F] hover:bg-[#E5E5EA] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {smsError && (
              <div className="p-2.5 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] text-xs flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{smsError}</span>
              </div>
            )}

            <form onSubmit={handleDispatchSms} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[#1D1D1F] flex items-center justify-between">
                  <span>Recipient Phone Number *</span>
                  <span className="text-[10px] text-[#8E8E93] font-normal">Ghana Mobile (e.g. 0244...)</span>
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-[#8E8E93] absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="tel"
                    required
                    autoFocus
                    value={smsPhoneInput}
                    onChange={(e) => setSmsPhoneInput(e.target.value)}
                    placeholder="e.g. 0244123456"
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#D2D2D7] rounded-xl font-mono text-xs font-bold text-[#1D1D1F] outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                  />
                </div>
              </div>

              {/* SMS Notice Preview (Clean text, ZERO URL links) */}
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[10px] font-semibold text-[#6E6E73]">
                  <MessageSquare className="w-3 h-3" />
                  <span>SMS Notice Preview (No Links)</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-[#E8E8ED] font-mono text-[10px] text-[#48484A] leading-relaxed whitespace-pre-wrap select-text">
                  {`KKMA Official Payment Confirmation\nDear ${payment.payerName || 'Ratepayer'}, payment of GH₵ ${payment.amountPaid.toFixed(2)} for Property #${payment.accountNo} is credited.\nOfficial GCR: ${payment.receiptNumber}\nRemaining Balance: GH₵ ${remainingBal.toFixed(2)}\nThank you for paying your municipal property rate.`}
                </div>
              </div>

              <div className="pt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isSendingSms}
                  onClick={() => {
                    setShowSmsDrawer(false);
                    setSmsError(null);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-[#D2D2D7] text-[#1D1D1F] text-xs font-semibold hover:bg-[#F5F5F7] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingSms}
                  className="px-3.5 py-1.5 rounded-lg bg-[#007AFF] hover:bg-[#0066D6] text-white text-xs font-semibold flex items-center gap-1.5 shadow-[0px_1px_4px_0px_rgba(0,122,255,0.3)] transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSendingSms ? (
                    <>
                      <AppleSpinner size="xs" />
                      <span>Sending SMS...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>{smsSent ? 'Resend SMS' : 'Send SMS Notice'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Sticky Action Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-[#E5E5EA] bg-white flex flex-col xs:flex-row items-center gap-2.5 shrink-0 no-print pb-[max(16px,env(safe-area-inset-bottom))]">
          {smsSent ? (
            <button
              type="button"
              onClick={() => {
                setShowSmsDrawer(true);
                setSmsError(null);
              }}
              disabled={isSendingSms}
              className="w-full xs:flex-1 min-h-[48px] rounded-[12px] bg-[#34C759]/10 hover:bg-[#34C759]/15 text-[#34C759] font-semibold text-[14px] flex items-center justify-center gap-2 cursor-pointer transition-colors active:scale-[0.98] select-none whitespace-nowrap border border-[#34C759]/20"
              title="SMS notice was sent to resident. Tap to view or resend."
            >
              <CheckCircle2 className="w-4 h-4 stroke-[2.2]" />
              <span>SMS Sent &bull; Resend</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowSmsDrawer(true);
                setSmsError(null);
              }}
              disabled={isSendingSms}
              className="w-full xs:flex-1 min-h-[48px] rounded-[12px] bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F] font-semibold text-[15px] flex items-center justify-center gap-2 cursor-pointer transition-colors active:scale-[0.98] select-none whitespace-nowrap"
              title="Send payment confirmation SMS to resident"
            >
              <Send className="w-4 h-4 stroke-[2]" />
              <span>Send SMS</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="w-full xs:flex-1 min-h-[48px] rounded-[12px] bg-[#007AFF] hover:bg-[#0071E3] text-white font-semibold text-[15px] flex items-center justify-center gap-2 cursor-pointer transition-colors active:scale-[0.98] select-none whitespace-nowrap shadow-xs"
            title="Print official receipt"
          >
            <Printer className="w-4 h-4 stroke-[2]" />
            <span>Print Receipt</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default PaymentReceiptModal;
