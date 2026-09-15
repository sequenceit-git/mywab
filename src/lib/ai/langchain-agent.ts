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
    faqs?: any[];
  }): string {
    return buildSystemPrompt(params);
  }

  /**
   * Process customer message using LLM-agent with real-time tool calling and conversational reasoning
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
        text: 'আপনার অর্ডার ড্রাফট রিসেট করা হয়েছে ভাইয়া। নতুনভাবে কী প্যাকেজ নিতে চান বলুন! 🎮',
        buttons: undefined
      };
    }

    // 1. Fetch current session state & conversation history
    let sessionState = db.getSessionState(conversationId);
    let draft = sessionState.draftOrder;

    // 1b. Proactive Deterministic Slot Extraction & State Sync for this customer's session
    const { extractedUid, extractedTrx, extractedPaymentMethod, extractedItems, parallelOrders } = extractSlotsFromMessage(messageText);

    if (extractedUid || extractedTrx || extractedPaymentMethod || extractedItems || parallelOrders) {
      // If customer specifies a new package while session is IDLE, start a fresh draft
      const isFreshPackage = extractedItems && extractedItems.length > 0 && sessionState.step === 'IDLE';
      const updatedUid = isFreshPackage ? (extractedUid || undefined) : (extractedUid || draft.playerUid);
      const updatedTrx = isFreshPackage ? (extractedTrx || undefined) : (extractedTrx || draft.trxId);
      const updatedPayment = isFreshPackage ? (extractedPaymentMethod || undefined) : (extractedPaymentMethod || draft.paymentMethod);
      const updatedItems = extractedItems && extractedItems.length > 0 ? extractedItems : draft.items;

      let nextStep = sessionState.step;
      const hasItems = updatedItems && updatedItems.length > 0;
      const hasUid = Boolean(updatedUid && updatedUid.trim());
      const hasPayment = Boolean(updatedTrx && updatedTrx.trim());

      if (hasItems && hasUid && hasPayment) {
        nextStep = 'AWAITING_CONFIRMATION';
      } else if (hasItems && hasUid && !hasPayment) {
        nextStep = 'AWAITING_PAYMENT';
      } else if (hasItems && !hasUid) {
        nextStep = 'COLLECTING_DETAILS';
      }

      sessionState = db.setSessionState(conversationId, {
        step: nextStep,
        draftOrder: {
          items: updatedItems,
          playerUid: updatedUid,
          trxId: updatedTrx,
          paymentMethod: updatedPayment,
          customerPhone: phone
        }
      });
      draft = sessionState.draftOrder;
    }

    // 2. Check Affirmation / Complete Slot Fast-Path
    const isAffirmative = isAffirmativePhrase(messageText);
    const hasValidUid = Boolean(draft.playerUid && /^\d{5,12}$/.test(draft.playerUid.trim()));
    const hasValidTrx = Boolean(draft.trxId && draft.trxId.trim().length >= 4);
    const hasTopUpSlots = Boolean(draft.items && draft.items.length > 0 && hasValidUid);
    const hasCompleteOrder = Boolean(hasTopUpSlots && hasValidTrx);

    if (hasCompleteOrder || (sessionState.step === 'AWAITING_CONFIRMATION' && isAffirmative && hasValidTrx)) {
      console.log(`[AI Fast-Path] Complete top-up slots / affirmative response received. Placing top-up order directly...`);
      const targetPhone = draft.customerPhone || phone;
      const targetName = draft.customerName || 'PUBG Player';
      const targetUid = draft.playerUid || 'N/A';
      const targetTrx = draft.trxId || 'N/A';
      const targetPayment = draft.paymentMethod || 'bKash/Nagad/Rocket';
      const targetItems = draft.items && draft.items.length > 0 ? draft.items : [{ skuOrName: '60 UC', quantity: 1 }];

      const toolResultRaw = await createOrderTool.invoke({
        customerPhone: targetPhone,
        customerName: targetName,
        playerUid: targetUid,
        trxId: targetTrx,
        paymentMethod: targetPayment,
        items: targetItems,
        customerNotes: draft.customerNotes,
        conversationId
      });

      const toolResult = JSON.parse(toolResultRaw);
      if (toolResult.success) {
        db.clearSessionDraft(conversationId, toolResult.order_id);
        const text = 
`🎉 *টপ-আপ অর্ডার সফলভাবে গ্রহণ করা হয়েছে!*

📦 *Order ID:* \`${toolResult.order_id}\`
🎮 *Player UID:* \`${toolResult.player_uid || targetUid}\`
💎 *প্যাকেজ:* ${targetItems.map(i => `${i.skuOrName} x${i.quantity}`).join(', ')}
💰 *মোট মূল্য:* ৳${toolResult.total_amount}
💳 *পেমেন্ট:* ${toolResult.payment_method || targetPayment} (TrxID: \`${toolResult.trx_id || targetTrx}\`)
⚡ *ডেলিভারি সময়:* ৫–১৫ মিনিট (5-15 Minutes)

আপনার টপ-আপ প্রসেসিং শুরু হয়েছে। খুব শীঘ্রই ইউসি আপনার আইডিতে যুক্ত হয়ে যাবে! 🚀✨`;

        return { text, buttons: undefined, createdOrder: toolResult };
      }
    }

    const activeFaqs = await db.getFAQs();
    const llm = this.getLLM();

    // 3. Primary Path: Intelligent OpenAI LLM with Tools
    if (llm && env.openai.apiKey) {
      try {
        console.log(`[AI Agent] Processing message from ${phone}: "${messageText}" using model ${env.openai.model || 'gpt-5-nano'}`);
        const modelWithTools = llm.bindTools(this.tools);

        const conv = await db.getConversationById(conversationId);
        const historyMessages = conv?.messages || [];

        // Exclude the very last message if it matches messageText to avoid duplication
        const pastMessages = (historyMessages.length > 0 && historyMessages[historyMessages.length - 1].content === messageText)
          ? historyMessages.slice(0, -1)
          : historyMessages;

        const systemPromptStr = this.getSystemPrompt({
          customerPhone: phone,
          sessionState,
          faqs: activeFaqs
        });

        const formattedHistory: BaseMessage[] = [
          new SystemMessage(systemPromptStr)
        ];

        // Maintain full multi-turn conversational memory (last 16 messages)
        pastMessages.slice(-16).forEach(m => {
          if (m.sender === 'CUSTOMER') {
            formattedHistory.push(new HumanMessage(m.content));
          } else {
            formattedHistory.push(new AIMessage(m.content));
          }
        });

        formattedHistory.push(new HumanMessage(messageText));

        const response = await modelWithTools.invoke(formattedHistory);
        let createdOrderResult: any = null;

        // Tool Calling Execution Loop
        if (response.tool_calls && response.tool_calls.length > 0) {
          console.log(`[AI Agent] Tool calls detected (${response.tool_calls.length}):`, response.tool_calls.map(tc => tc.name).join(', '));
          
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

    // 4. Secondary Fallback: LangGraph State Graph
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

    // 5. Ultimate Fallback: Rule Engine
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


