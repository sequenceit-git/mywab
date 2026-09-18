import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage, AIMessage, ToolMessage, BaseMessage } from '@langchain/core/messages';
import { db } from '@/lib/db';
import { env } from '@/lib/config/env';
import { WhatsAppButton } from '@/lib/whatsapp/service';
import { ConversationSessionState } from '@/types';
import {
  getFaqTool,
  updateDraftOrderTool,
  createOrderTool,
  trackOrderTool
} from './tools';
import { buildSystemPrompt } from './prompts';
import { extractSlotsFromMessage, isAffirmativePhrase, isResetIntent } from './slot-extractor';
import { fallbackEngineStructured, StructuredAgentResponse } from './fallback-engine';
import { orderStateGraph } from './order-graph';
import { runStepGuard } from './step-guard';

export type { StructuredAgentResponse, WhatsAppButton };
export {
  getFaqTool,
  updateDraftOrderTool,
  createOrderTool,
  trackOrderTool,
  orderStateGraph
};

export class LangChainAgentService {
  private tools = [
    getFaqTool,
    createOrderTool,
    trackOrderTool,
    updateDraftOrderTool
  ];

  private getLLM() {
    if (!env.openai.apiKey) {
      return null;
    }
    const model = env.openai.model || 'gpt-5-nano';
    const isSpecialModel = model.includes('gpt-5') || model.includes('o1') || model.includes('o3') || model.includes('nano');
    return new ChatOpenAI({
      openAIApiKey: env.openai.apiKey,
      modelName: model,
      ...(isSpecialModel ? {} : { temperature: 0.3 })
    });
  }

  getSystemPrompt(params: {
    customerPhone: string;
    sessionState: ConversationSessionState;
    customerProfile?: import('@/types').CustomerMemoryProfile;
    recentOrders?: import('@/types').Order[];
    summary?: string;
    faqs?: any[];
  }): string {
    return buildSystemPrompt(params);
  }

  /**
   * Process customer message using LLM-agent with real-time tool calling and conversational reasoning.
   *
   * Pipeline:
   *  1. Reset check (cancel/clear)
   *  2. Slot extraction (extractSlotsFromMessage)
   *  3. Step Guard — SINGLE slot-sync + step advancement (replaces duplicate inline extraction)
   *  4. Returning customer UID auto-fill
   *  5. Fast-path: place order if all slots complete
   *  6. LLM with step-aware system prompt + customer-only history (no bot hallucination reinforcement)
   *  7. LangGraph fallback
   *  8. Rule engine fallback
   */
  async processStructuredMessage(params: {
    phone: string;
    messageText: string;
    conversationId: string;
  }): Promise<StructuredAgentResponse> {
    const { phone, messageText, conversationId } = params;

    // 0. Explicit User Reset / Cancel Intent
    if (isResetIntent(messageText)) {
      db.clearSessionDraft(conversationId);
      return {
        text: 'আপনার অর্ডার ড্রাফট রিসেট করা হয়েছে ভাইয়া। নতুনভাবে কী প্যাকেজ নিতে চান বলুন! 🎮',
        buttons: undefined
      };
    }

    // 1. Extract slots ONCE — all downstream uses this result.
    const slots = extractSlotsFromMessage(messageText);

    // 2. Step Guard: single-source slot sync + FSM step advancement.
    //    This REPLACES the duplicate slot extraction that was previously
    //    in langchain-agent.ts (lines 99–133). The step guard is now the
    //    only place that writes to session state based on slot data.
    const guardResult = await runStepGuard({
      phone,
      messageText,
      conversationId,
      slots
    });
    let sessionState = guardResult.updatedSessionState;
    let draft = sessionState.draftOrder;

    // 3. Fetch customer profile and recent orders (for memory and prompt)
    const customerProfile = await db.getCustomerProfile(phone);
    const recentOrders = await db.getOrdersByPhone(phone);
    const isAffirmative = isAffirmativePhrase(messageText);

    // 4. Returning Customer UID Auto-Fill:
    //    If customer confirms ("yes", "ok") and we have a saved UID but no current UID,
    //    and there's a package selected, use their saved UID.
    if (isAffirmative && !draft.playerUid && customerProfile.last_used_uid && draft.items && draft.items.length > 0) {
      console.log(`[Memory Auto-Fill] Reusing saved Player UID ${customerProfile.last_used_uid} for returning customer ${phone}`);
      sessionState = db.setSessionState(conversationId, {
        step: draft.trxId ? 'AWAITING_CONFIRMATION' : 'AWAITING_PAYMENT',
        draftOrder: {
          ...draft,
          playerUid: customerProfile.last_used_uid
        }
      });
      draft = sessionState.draftOrder;
    }

    // 5. Fast-path: if all slots are captured, place the order directly
    //    (no LLM needed for deterministic outcomes)
    const hasValidUid  = Boolean(draft.playerUid && /^\d{5,12}$/.test(draft.playerUid.trim()));
    const hasValidTrx  = Boolean(draft.trxId && draft.trxId.trim().length >= 4);
    const hasTopUpSlots = Boolean(draft.items && draft.items.length > 0 && hasValidUid);
    const hasCompleteOrder = Boolean(hasTopUpSlots && hasValidTrx);

    if (hasCompleteOrder || (sessionState.step === 'AWAITING_CONFIRMATION' && isAffirmative && hasValidTrx)) {
      console.log(`[AI Fast-Path] Complete top-up slots detected. Placing order directly...`);
      const targetItems = draft.items && draft.items.length > 0 ? draft.items : [{ skuOrName: '60 UC', quantity: 1 }];
      const toolResultRaw = await createOrderTool.invoke({
        customerPhone: draft.customerPhone || phone,
        customerName: draft.customerName || 'PUBG Player',
        playerUid: draft.playerUid!,
        trxId: draft.trxId!,
        paymentMethod: draft.paymentMethod || 'bKash/Nagad/Rocket',
        items: targetItems,
        customerNotes: draft.customerNotes,
        conversationId
      });

      const toolResult = JSON.parse(toolResultRaw);
      if (toolResult.success) {
        db.clearSessionDraft(conversationId, toolResult.order_id);
        db.updateCustomerProfile(phone, {
          last_used_uid: draft.playerUid!,
          preferred_payment: draft.paymentMethod || 'bKash',
          total_completed_orders: (customerProfile.total_completed_orders || 0) + 1
        }).catch(() => {});

        const text =
`🎉 *টপ-আপ অর্ডার সফলভাবে গ্রহণ করা হয়েছে!*

📦 *Order ID:* \`${toolResult.order_id}\`
🎮 *Player UID:* \`${toolResult.player_uid || draft.playerUid}\`
💎 *প্যাকেজ:* ${targetItems.map(i => `${i.skuOrName} x${i.quantity}`).join(', ')}
💰 *মোট মূল্য:* ৳${toolResult.total_amount}
💳 *পেমেন্ট:* ${toolResult.payment_method || draft.paymentMethod} (TrxID: \`${toolResult.trx_id || draft.trxId}\`)
⚡ *ডেলিভারি সময়:* ৫–১৫ মিনিট (5-15 Minutes)

আপনার টপ-আপ প্রসেসিং শুরু হয়েছে। খুব শীঘ্রই ইউসি আপনার আইডিতে যুক্ত হয়ে যাবে! 🚀✨`;

        return { text, buttons: undefined, createdOrder: toolResult };
      }
    }

    // 6. LLM path with step-aware prompt
    const activeFaqs = await db.getFAQs();
    const llm = this.getLLM();

    if (llm && env.openai.apiKey) {
      try {
        console.log(`[AI Agent] Processing message from ${phone}: "${messageText}" | step=${sessionState.step} | model=${env.openai.model || 'gpt-5-nano'}`);
        const modelWithTools = llm.bindTools(this.tools);

        const conv = await db.getConversationById(conversationId);
        const historyMessages = conv?.messages || [];

        // Build step-aware system prompt (includes YOUR TASK THIS TURN block at top)
        const systemPromptStr = this.getSystemPrompt({
          customerPhone: phone,
          sessionState,
          customerProfile,
          recentOrders,
          summary: conv?.summary,
          faqs: activeFaqs
        });

        const formattedHistory: BaseMessage[] = [
          new SystemMessage(systemPromptStr)
        ];

        // FIX: Inject ONLY customer messages from history (last 6).
        // Previously we injected the last 8 messages including the bot's own
        // confused replies — this was teaching the LLM to repeat its mistakes.
        // Now we only show what the customer said, which is reliable ground truth.
        // The system prompt's CURRENT ORDER STATE section provides all bot context.
        const excludeLastIfDuplicate =
          historyMessages.length > 0 &&
          historyMessages[historyMessages.length - 1].content === messageText;
        const pastMessages = excludeLastIfDuplicate
          ? historyMessages.slice(0, -1)
          : historyMessages;

        // Only use CUSTOMER messages (not bot/admin replies) to avoid reinforcing bad behavior
        const customerOnlyHistory = pastMessages
          .filter(m => m.sender === 'CUSTOMER')
          .slice(-6);

        customerOnlyHistory.forEach(m => {
          formattedHistory.push(new HumanMessage(m.content));
        });

        formattedHistory.push(new HumanMessage(messageText));

        const response = await modelWithTools.invoke(formattedHistory);
        let createdOrderResult: any = null;

        // Tool Calling Execution Loop
        if (response.tool_calls && response.tool_calls.length > 0) {
          console.log(`[AI Agent] Tool calls: ${response.tool_calls.map(tc => tc.name).join(', ')}`);

          const toolMessages: ToolMessage[] = [];
          for (const toolCall of response.tool_calls) {
            const selectedTool = this.tools.find(t => t.name === toolCall.name);
            if (selectedTool) {
              const toolOutput = await (selectedTool as any).invoke(toolCall.args);
              if (toolCall.name === 'create_order') {
                try {
                  createdOrderResult = JSON.parse(String(toolOutput));
                } catch (_) {}
              }
              toolMessages.push(new ToolMessage({
                tool_call_id: toolCall.id || `tool-${Date.now()}`,
                name: toolCall.name,
                content: String(toolOutput)
              }));
            }
          }

          const finalMessages: BaseMessage[] = [
            ...formattedHistory,
            response,
            ...toolMessages
          ];

          const finalResponse = await llm.invoke(finalMessages);
          const rawText = String(finalResponse.content || '');

          return {
            text: rawText,
            buttons: undefined,
            createdOrder: createdOrderResult
          };
        }

        const rawText = String(response.content || '');
        return {
          text: rawText,
          buttons: undefined
        };
      } catch (err) {
        console.error('[LangChain Agent Exception, falling back to graph/rules]:', err);
      }
    }

    // 7. Secondary Fallback: LangGraph State Graph
    try {
      const graphResult = await orderStateGraph.invoke(
        {
          phone,
          messageText,
          conversationId,
          sessionState: db.getSessionState(conversationId),
          messages: []
        },
        {
          configurable: {
            thread_id: conversationId
          }
        }
      );

      if (graphResult.finalResponseText) {
        return {
          text: graphResult.finalResponseText,
          buttons: undefined,
          createdOrder: graphResult.createdOrders?.[0]
        };
      }
    } catch (graphErr) {
      console.error('[LangGraph Fallback Error]:', graphErr);
    }

    // 8. Ultimate Fallback: Rule Engine
    const fallbackRes = await fallbackEngineStructured({ phone, messageText, conversationId });
    return {
      text: fallbackRes.text,
      buttons: undefined,
      createdOrder: fallbackRes.createdOrder
    };
  }

  async generateResponse(params: {
    phone: string;
    messageText: string;
    conversationId: string;
  }): Promise<string> {
    const res = await this.processStructuredMessage(params);
    return res.text;
  }

  async generateTextResponse(phone: string, messageText: string, conversationId: string): Promise<string> {
    return this.generateResponse({ phone, messageText, conversationId });
  }
}

export const langchainAgent = new LangChainAgentService();
export const langChainAgent = langchainAgent;


