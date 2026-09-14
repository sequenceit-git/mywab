'use client';

import React from 'react';
import { Header } from '@/components/Header';
import {
  Database,
  Sparkles,
  MessageSquare,
  Bot,
  Key,
  CheckCircle2,
  FileCode,
  Copy
} from 'lucide-react';

export default function ConfigPage() {
  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Supabase & Environment Configuration"
        subtitle="Credentials, API keys, database schema, and webhook endpoints"
      />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* 1. Supabase Setup Guide */}
        <div className="p-6 rounded-2xl bg-dark-900/90 border border-slate-800/80 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">1. Supabase Database Setup</h3>
              <p className="text-xs text-slate-400">PostgreSQL tables, indexes, and atomic order claiming stored procedure</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300 space-y-2">
            <p className="font-semibold text-slate-200">How to execute the schema in Supabase:</p>
            <ol className="list-decimal list-inside space-y-1 text-slate-400 leading-relaxed">
              <li>Open your <b>Supabase Dashboard</b> ➔ <b>SQL Editor</b>.</li>
              <li>Open the file <code className="text-brand-400">supabase/schema.sql</code> in this repository and click <b>Run</b>.</li>
              <li>Optionally run <code className="text-brand-400">supabase/seed.sql</code> to populate sample Bengali & English products and FAQs.</li>
              <li>Copy your <b>Project URL</b> and <b>Anon / Service Role Key</b> into your <code className="text-brand-400">.env.local</code> file.</li>
            </ol>
          </div>
        </div>

        {/* 2. OpenAI & LangChain Setup */}
        <div className="p-6 rounded-2xl bg-dark-900/90 border border-slate-800/80 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">2. OpenAI & LangChain Setup</h3>
              <p className="text-xs text-slate-400">Powering bilingual natural language parsing, tool calling, and order generation</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300 space-y-2">
            <p className="text-slate-400 leading-relaxed">
              Set your <code className="text-indigo-400">OPENAI_API_KEY</code> in <code className="text-indigo-400">.env.local</code>. The LangChain agent utilizes <b>ChatOpenAI</b> with function calling tools (<code className="text-slate-300">search_catalog</code>, <code className="text-slate-300">get_faq</code>, <code className="text-slate-300">create_order</code>, <code className="text-slate-300">track_order</code>).
            </p>
          </div>
        </div>

        {/* 3. WhatsApp Cloud API Webhooks */}
        <div className="p-6 rounded-2xl bg-dark-900/90 border border-slate-800/80 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">3. WhatsApp Business Cloud API</h3>
              <p className="text-xs text-slate-400">Meta Developer Webhook endpoint</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Callback URL:</span>
              <code className="text-brand-400 font-mono">https://your-domain.com/api/webhooks/whatsapp</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Verify Token:</span>
              <code className="text-brand-400 font-mono">wapbusiness_secure_verify_token</code>
            </div>
          </div>
        </div>

        {/* 4. Telegram Worker Bot Webhooks */}
        <div className="p-6 rounded-2xl bg-dark-900/90 border border-slate-800/80 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-telegram-500/10 text-telegram-500">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">4. Telegram Worker Bot Setup</h3>
              <p className="text-xs text-slate-400">Telegram BotFather token & worker group ID</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Webhook URL:</span>
              <code className="text-telegram-500 font-mono">https://your-domain.com/api/webhooks/telegram</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Set Telegram Webhook Command:</span>
              <code className="text-slate-400 font-mono text-[10px]">
                curl -F &quot;url=https://your-domain.com/api/webhooks/telegram&quot; https://api.telegram.org/bot&lt;BOT_TOKEN&gt;/setWebhook
              </code>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
