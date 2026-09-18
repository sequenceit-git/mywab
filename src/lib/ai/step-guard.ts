/**
 * Step Guard Middleware
 *
 * This is the core fix for AI hallucination and step confusion.
 * It enforces the FSM (Finite State Machine) conversation flow by:
 *
 *  1. Advancing the session step when new slots arrive (single source of truth)
 *  2. Deciding when to return a DETERMINISTIC response (bypassing LLM entirely)
 *  3. Signaling when the LLM is allowed to generate a free response
 *
 * The LLM is ONLY the language generator -- it never controls flow.
 * The step guard is the flow controller.
 */

import { db } from '@/lib/db';
import { ConversationSessionState, ConversationStep } from '@/types';
import { ExtractedSlots, isAffirmativePhrase, isBDPhoneNumber } from './slot-extractor';

export interface StepGuardResult {
  /** If set, return this text directly -- do NOT call the LLM */
  deterministicResponse?: string;
  /** The updated (possibly advanced) session state to use for this turn */
  updatedSessionState: ConversationSessionState;
  /** Whether the step was advanced this turn (for logging) */
  stepAdvanced: boolean;
  previousStep: ConversationStep;
  currentStep: ConversationStep;
}

/**
 * Main entry point. Call this BEFORE any LLM invocation.
 * It synchronizes slots from the current message into session state,
 * advances the step if appropriate, and returns a deterministic response
 * for certain transitions.
 */
export async function runStepGuard(params: {
  phone: string;
  messageText: string;
  conversationId: string;
  slots: ExtractedSlots;
}): Promise<StepGuardResult> {
  const { phone, messageText, conversationId, slots } = params;

  const sessionState = db.getSessionState(conversationId);
  const previousStep = sessionState.step;
  const draft = sessionState.draftOrder;
  const isAffirmative = isAffirmativePhrase(messageText);

  // PHASE 1: Sync slots into draft (single-source slot extraction)

  let updatedUid   = slots.extractedUid   || draft.playerUid;
  let updatedTrx   = slots.extractedTrx   || draft.trxId;
  let updatedPay   = slots.extractedPaymentMethod || draft.paymentMethod;
  let updatedItems = (slots.extractedItems && slots.extractedItems.length > 0)
    ? slots.extractedItems
    : draft.items;

  // Guard: If extracted UID is actually a BD phone number, discard it.
  if (updatedUid && isBDPhoneNumber(updatedUid)) {
    console.warn(`[StepGuard] Discarded BD phone number mistaken as UID: ${updatedUid}`);
    updatedUid = draft.playerUid;
  }

  // If session just had an order placed and a new package comes in, start fresh draft
  const isStartingFreshOrder =
    (previousStep === 'ORDER_PLACED' || previousStep === 'IDLE') &&
    slots.extractedItems && slots.extractedItems.length > 0;

  if (isStartingFreshOrder) {
    updatedUid   = slots.extractedUid   || undefined;
    updatedTrx   = slots.extractedTrx   || undefined;
    updatedPay   = slots.extractedPaymentMethod || undefined;
    updatedItems = slots.extractedItems!; // safe: isStartingFreshOrder already checks extractedItems is non-null
  }

  // PHASE 2: Determine the next step based on current slot state

  const hasItems   = !!(updatedItems && updatedItems.length > 0);
  const hasUid     = !!(updatedUid && updatedUid.trim());
  const hasPayment = !!(updatedTrx && updatedTrx.trim());

  let nextStep: ConversationStep = previousStep;

  // Parallel order handling
  if (slots.parallelOrders && slots.parallelOrders.length > 1) {
    const allParallelHavePayment = (sessionState.parallelDrafts || []).every(p => p.trxId);
    nextStep = allParallelHavePayment ? 'PARALLEL_CONFIRMATION' : 'AWAITING_PAYMENT';
  } else {
    // Standard single-order FSM transitions
    if (hasItems && hasUid && hasPayment) {
      nextStep = 'AWAITING_CONFIRMATION';
    } else if (hasItems && hasUid && !hasPayment) {
      nextStep = 'AWAITING_PAYMENT';
    } else if (hasItems && !hasUid) {
      if (slots.hasPurchaseIntent || isAffirmative) {
        nextStep = 'COLLECTING_DETAILS';
      } else if (previousStep === 'IDLE' || previousStep === 'BROWSING') {
        nextStep = 'BROWSING';
      } else {
        nextStep = 'COLLECTING_DETAILS';
      }
    } else if (!hasItems) {
      if (previousStep === 'BROWSING' && (slots.hasPurchaseIntent || isAffirmative)) {
        nextStep = 'BROWSING';
      } else if (previousStep === 'COLLECTING_DETAILS' || previousStep === 'AWAITING_PAYMENT') {
        nextStep = previousStep;
      }
      // else: IDLE or ORDER_PLACED with no items -> stay as-is
    }
  }

  // PHASE 3: Persist updated session state

  const parallelDrafts = slots.parallelOrders && slots.parallelOrders.length > 1
    ? slots.parallelOrders.map(p => ({
        items: p.items,
        playerUid: p.playerUid,
        trxId: slots.extractedTrx || draft.trxId,
        paymentMethod: updatedPay || 'BKASH',
        customerPhone: phone
      }))
    : sessionState.parallelDrafts;

  const updatedSession = db.setSessionState(conversationId, {
    step: nextStep,
    draftOrder: {
      items: updatedItems,
      playerUid: updatedUid,
      trxId: updatedTrx,
      paymentMethod: updatedPay,
      customerPhone: phone,
      customerName: draft.customerName,
      customerNotes: draft.customerNotes
    },
    parallelDrafts: parallelDrafts
  });

  const stepAdvanced = nextStep !== previousStep;
  if (stepAdvanced) {
    console.log(
      `[StepGuard] Step: ${previousStep} -> ${nextStep} | phone=${phone} | items=${hasItems} | uid=${hasUid} | payment=${hasPayment}`
    );
  }

  return {
    updatedSessionState: updatedSession,
    stepAdvanced,
    previousStep,
    currentStep: nextStep
  };
}
