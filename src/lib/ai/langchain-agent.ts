import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage, AIMessage, ToolMessage, BaseMessage } from '@langchain/core/messages';
import { db } from '@/lib/db';
import { env } from '@/lib/config/env';
import { WhatsAppButton } from '@/lib/whatsapp/service';
import { ConversationSessionState } from '@/types';
import {
  searchCatalogTool,
  getFaqTool,
  updateDraftOrderTool,
  createOrderTool,
  trackOrderTool,
  getCustomerOrdersTool
} from './tools';
import { buildSystemPrompt } from './prompts';
import { extractSlotsFromMessage, isAffirmativePhrase } from './slot-extractor';
import { fallbackEngineStructured, StructuredAgentResponse } from './fallback-engine';
import { orderStateGraph } from './order-graph';

export type { StructuredAgentResponse };
export {
  searchCatalogTool,
  getFaqTool,
  updateDraftOrderTool,
  createOrderTool,
  trackOrderTool,
  getCustomerOrdersTool,
  orderStateGraph
};

export class LangChainAgentService {
  private tools = [
    searchCatalogTool,
    getFaqTool,
    updateDraftOrderTool,
    createOrderTool,
    trackOrderTool,
    getCustomerOrdersTool
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
    products?: any[];
    policies?: any[];
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

    // 1. Fetch current session state & conversation history
    let sessionState = db.getSessionState(conversationId);
    let draft = sessionState.draftOrder;

    // 1b. Proactive Deterministic Slot Extraction & State Sync for this customer's session
    const { extractedUid, extractedTrx, extractedPaymentMethod, extractedItems, parallelOrders } = extractSlotsFromMessage(messageText);

    if (extractedUid || extractedTrx || extractedPaymentMethod || extractedItems || parallelOrders) {
      const updatedUid = extractedUid || draft.playerUid;
      const updatedTrx = extractedTrx || draft.trxId;
      const updatedPayment = extractedPaymentMethod || draft.paymentMethod;
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

    // 2. Check Affirmation Fast-Path (When all slots are already complete and user sends confirmation)
    const isAffirmative = isAffirmativePhrase(messageText);
    const hasTopUpSlots = Boolean(draft.items && draft.items.length > 0 && draft.playerUid);

    if ((sessionState.step === 'AWAITING_CONFIRMATION' || (hasTopUpSlots && draft.trxId)) && isAffirmative) {
      console.log(`[AI Fast-Path] Affirmative top-up response received in state ${sessionState.step}. Placing top-up order directly...`);
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
        const text = 
`🎉 *টপ-আপ অর্ডার সফলভাবে গ্রহণ করা হয়েছে!*

📦 *Order ID:* \`${toolResult.order_id}\`
🎮 *Player UID:* \`${toolResult.player_uid || targetUid}\`
💎 *প্যাকেজ:* ${targetItems.map(i => `${i.skuOrName} x${i.quantity}`).join(', ')}
💰 *মোট মূল্য:* ৳${toolResult.total_amount}
💳 *পেমেন্ট:* ${toolResult.payment_method || targetPayment} (TrxID: \`${toolResult.trx_id || targetTrx}\`)
⚡ *ডেলিভারি সময়:* ৫–১৫ মিনিট (5-15 Minutes)

আপনার টপ-আপ প্রসেসিং শুরু হয়েছে। খুব শীঘ্রই ইউসি আপনার আইডিতে যুক্ত হয়ে যাবে! 🚀✨`;

        const buttons: WhatsAppButton[] = [
          { id: `track:${toolResult.order_id}`, title: '📦 অর্ডার ট্র্যাক' },
          { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
          { id: 'btn_website', title: '🌐 ওয়েবসাইট ২% ছাড়' }
        ];

        return { text, buttons, createdOrder: toolResult };
      }
    }

    const activeProducts = await db.getProducts();
    const activePolicies = await db.getAIPolicies();
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
          products: activeProducts,
          policies: activePolicies,
          faqs: activeFaqs
        });

        const formattedHistory: BaseMessage[] = [
          new SystemMessage(systemPromptStr)
        ];

        pastMessages.slice(-8).forEach(m => {
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

          const dynamicButtons: WhatsAppButton[] = createdOrderResult?.order_id
            ? [
                { id: `track:${createdOrderResult.order_id}`, title: '📦 অর্ডার ট্র্যাক' },
                { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
                { id: 'btn_website', title: '🌐 ওয়েবসাইট ২% ছাড়' }
              ]
            : [
                { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
                { id: 'btn_track', title: '📦 অর্ডার ট্র্যাক' },
                { id: 'btn_website', title: '🌐 ওয়েবসাইট ২% ছাড়' }
              ];

          return {
            text: rawText,
            buttons: dynamicButtons,
            createdOrder: createdOrderResult
          };
        }

        const rawText = String(response.content || '');
        const lowerMsg = messageText.toLowerCase();
        
        let dynamicButtons: WhatsAppButton[] = [
          { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
          { id: 'btn_track', title: '📦 অর্ডার ট্র্যাক' },
          { id: 'btn_website', title: '🌐 ওয়েবসাইট ২% ছাড়' }
        ];

        const hasSelectedPackage = Boolean(sessionState.draftOrder?.items && sessionState.draftOrder.items.length > 0);
        if ((lowerMsg.includes('uc') || lowerMsg.includes('price') || lowerMsg.includes('dam') || lowerMsg.includes('koto')) && !hasSelectedPackage) {
          dynamicButtons = [
            { id: 'btn_60uc', title: '⚡ 60 UC (৳115)' },
            { id: 'btn_385uc', title: '👑 385 UC (৳710)' },
            { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' }
          ];
        }

        return {
          text: rawText,
          buttons: dynamicButtons
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
          buttons: graphResult.buttons,
          createdOrder: graphResult.createdOrders?.[0]
        };
      }
    } catch (graphErr) {
      console.error('[LangGraph Fallback Error]:', graphErr);
    }

    // 5. Ultimate Fallback: Rule Engine
    return fallbackEngineStructured({ phone, messageText, conversationId });
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

