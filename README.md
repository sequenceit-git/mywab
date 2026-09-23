# WapBusiness (MyWab)
### WhatsApp AI Commerce & Telegram Worker Fulfillment Dispatch Engine

[![Next.js](https://img.shields.io/badge/Next.js-15.2.1-black?logo=next.js)](https://nextjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb)](https://www.mongodb.com/)
[![OpenAI & LangChain](https://img.shields.io/badge/LangChain-OpenAI%20Agents-412991?logo=openai)](https://www.langchain.com/)
[![WhatsApp Cloud API](https://img.shields.io/badge/Meta-WhatsApp%20Cloud%20API-25D366?logo=whatsapp)](https://developers.facebook.com/)
[![Telegram Bot API](https://img.shields.io/badge/Telegram-Worker%20Bot-24A1DE?logo=telegram)](https://core.telegram.org/bots)
[![Docker](https://img.shields.io/badge/Docker-Multi--Stage-2496ED?logo=docker)](https://www.docker.com/)
[![Traefik](https://img.shields.io/badge/Reverse%20Proxy-Traefik-24A1DE?logo=traefik)](https://traefik.io/)

---

## 📌 Executive Summary

**WapBusiness** is an enterprise conversational commerce platform engineered to automate end-to-end e-commerce operations. It unifies:
1. **Bilingual Customer Shopping via WhatsApp**: Conversational product discovery, automated FAQ resolution, and dynamic order placement in Bengali & English powered by **LangChain + OpenAI**.
2. **Real-time Worker Dispatch via Telegram**: Instant dispatch of confirmed orders into a Telegram fulfillment group with **atomic order locking** (preventing race conditions / double-claims).
3. **Centralized Operations Hub**: A secure Next.js dashboard featuring live order tracking, chat monitoring with one-click human takeover, product catalog management, and staff analytics backed by **MongoDB Atlas & Mongoose**.

---

## 🏗️ Architecture Diagrams

### 1. High-Level System Architecture

```mermaid
flowchart TD
    subgraph Customers["Customer Channel (WhatsApp)"]
        User["📱 Customer (WhatsApp)"]
    end

    subgraph MetaCloud["Meta Platform"]
        WA_API["WhatsApp Cloud API Gateway"]
    end

    subgraph CoreEngine["WapBusiness Core Platform (Next.js App Router)"]
        direction TB
        WH_Route["/api/webhooks/whatsapp\n(Signature Verification & Router)"]
        AI_Agent["LangChain Agent Engine\n(OpenAI Tool Calling)"]
        
        subgraph Tools["LangChain Tool Suite"]
            T_Cat["search_catalog"]
            T_FAQ["get_faq"]
            T_Order["create_order"]
            T_Track["track_order"]
        end

        DB_Service["Database Service Facade\n(src/lib/db.ts)"]
        TG_Service["Telegram Dispatch Service\n(src/lib/telegram/bot.ts)"]
        WA_Service["WhatsApp Outbound Service\n(src/lib/whatsapp/service.ts)"]
        Admin_Panel["Admin Dashboard & Live Inbox\n(mywab.sequenceit.software)"]
    end

    subgraph Database["MongoDB Atlas Cloud"]
        SQL_DB[("MongoDB Database\n• users\n• orders & items\n• packages\n• conversations\n• workers & assignments")]
        Atomic_Proc["findOneAndUpdate()\n(Atomic Find & Claim)"]
    end

    subgraph Workers["Fulfillment Team Channel (Telegram)"]
        TG_API["Telegram Bot API"]
        TG_Group["👥 Telegram Worker Group\n(Dispatch Channel)"]
        Worker_App["👷 Delivery Worker\n(Inline Button Actions)"]
    end

    User <-->|Encrypted Chat| WA_API
    WA_API <-->|Webhook POST / Inbound| WH_Route
    WH_Route --> AI_Agent
    AI_Agent --> Tools
    T_Cat & T_FAQ & T_Track <--> DB_Service
    T_Order --> DB_Service
    T_Order --> TG_Service
    T_Order --> WA_Service
    
    DB_Service <-->|CRUD & RLS| SQL_DB
    DB_Service <-->|RPC Execution| Atomic_Proc
    
    TG_Service -->|Broadcast Card| TG_API
    TG_API --> TG_Group
    Worker_App -->|⚡ Claim / Status Update| TG_API
    TG_API -->|Webhook POST| WH_Route
    
    Admin_Panel <-->|Live Oversight & Human Takeover| DB_Service
```

---

### 2. Order Lifecycle & Dispatch Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Customer as 📱 Customer
    participant WhatsApp as Meta WhatsApp API
    participant NextApp as WapBusiness Backend
    participant OpenAI as LangChain / OpenAI
    participant MongoDB as MongoDB Atlas (Mongoose)
    participant Telegram as Telegram Bot API
    actor Worker as 👷 Telegram Worker

    Customer->>WhatsApp: "১টি কালো টি-শার্ট অর্ডার করতে চাই"
    WhatsApp->>NextApp: Webhook: Incoming Message Payload
    NextApp->>OpenAI: Process intent with Conversation History & Tools
    OpenAI->>NextApp: Invoke `create_order` (Items, Address, Phone)
    
    NextApp->>MongoDB: Insert Order (Status: PENDING_CLAIM) & Order Items
    MongoDB-->>NextApp: Order Created (e.g. WAP-20260914-1001)
    
    par Worker Dispatch
        NextApp->>Telegram: Send Interactive Order Card + [⚡ Claim] Button
        Telegram->>Worker: Broadcast to Worker Group
    and WhatsApp Confirmation
        NextApp->>WhatsApp: Send Order Receipt & Confirmation Template
        WhatsApp->>Customer: "আপনার অর্ডার #WAP-20260914-1001 নিশ্চিত হয়েছে!"
    end

    Worker->>Telegram: Clicks [⚡ Claim Order]
    Telegram->>NextApp: CallbackQuery (`claim:WAP-20260914-1001`)
    NextApp->>MongoDB: Call `claimOrder()` (Atomic findOneAndUpdate)
    
    alt Order Already Claimed
        MongoDB-->>NextApp: { success: false, code: "ALREADY_CLAIMED" }
        NextApp->>Telegram: Alert Worker: "⚠️ Order already claimed by another rider"
    else Claim Successful
        MongoDB-->>NextApp: { success: true, worker_id: "...", status: "CLAIMED" }
        NextApp->>Telegram: Edit Message -> Update Card to Claimed & Show Action Buttons
        NextApp->>WhatsApp: Notify Customer: "Worker [Name] is preparing your order!"
    end

    Worker->>Telegram: Clicks [✅ Mark Delivered]
    Telegram->>NextApp: CallbackQuery (`status_delivered:WAP-...`)
    NextApp->>MongoDB: Update Order Status -> DELIVERED
    NextApp->>WhatsApp: Send Delivery Notification & Feedback Request
    WhatsApp->>Customer: "🎉 আপনার অর্ডার সফলভাবে ডেলিভারি করা হয়েছে!"
```

---

### 3. Database Entity Relationship Model

```mermaid
erDiagram
    USERS ||--o{ CONVERSATIONS : "has"
    USERS ||--o{ ORDERS : "places"
    CONVERSATIONS ||--o{ MESSAGES : "contains"
    ORDERS ||--|{ ORDER_ITEMS : "contains"
    PRODUCTS ||--o{ ORDER_ITEMS : "referenced_in"
    ORDERS ||--o{ ORDER_ASSIGNMENTS : "assigned_to"
    WORKERS ||--o{ ORDER_ASSIGNMENTS : "claims"
    ORDERS ||--o{ PAYMENTS : "paid_by"

    USERS {
        uuid id PK
        varchar phone_number UK
        varchar name
        jsonb address_profile
        varchar language_pref
        varchar status_tag
        timestamptz created_at
    }

    CONVERSATIONS {
        uuid id PK
        uuid user_id FK
        varchar channel
        boolean is_ai_active
        timestamptz last_message_at
        timestamptz created_at
    }

    MESSAGES {
        uuid id PK
        uuid conversation_id FK
        varchar sender
        text content
        text media_url
        jsonb raw_payload
        timestamptz created_at
    }

    PRODUCTS {
        uuid id PK
        varchar sku UK
        varchar name_en
        varchar name_bn
        numeric price
        int stock_qty
        varchar category
        boolean is_active
    }

    FAQS {
        uuid id PK
        text question_en
        text question_bn
        text answer_en
        text answer_bn
        varchar category
        boolean is_active
    }

    ORDERS {
        uuid id PK
        varchar order_id UK
        uuid user_id FK
        numeric total_amount
        varchar status
        jsonb delivery_address
        varchar delivery_phone
        text customer_notes
        bigint telegram_message_id
        timestamptz created_at
    }

    ORDER_ITEMS {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        varchar product_name
        numeric unit_price
        int quantity
        numeric subtotal
    }

    WORKERS {
        uuid id PK
        bigint telegram_user_id UK
        varchar telegram_username
        varchar full_name
        varchar phone_number
        varchar role
        boolean is_active
        timestamptz created_at
    }

    ORDER_ASSIGNMENTS {
        uuid id PK
        uuid order_id FK
        uuid worker_id FK
        varchar status
        timestamptz claimed_at
        timestamptz completed_at
    }

    PAYMENTS {
        uuid id PK
        uuid order_id FK
        varchar payment_method
        varchar trx_id
        numeric amount
        varchar status
        timestamptz created_at
    }
```

---

## 🛠️ Technology Stack

| Layer | Technology | Description |
|---|---|---|
| **Framework** | Next.js 15.2 (App Router) | Server Actions, API Route Handlers, Standalone output |
| **Language & Typing** | TypeScript 5.8 & React 19 | Strictly typed components, interfaces, and schemas |
| **Styling & UI** | Tailwind CSS + Lucide Icons | Responsive dark theme with curated glassmorphism |
| **Database & Auth** | MongoDB Atlas (Mongoose 9) | Document collections, schema validation, atomic operations |
| **AI / Agent Core** | LangChain + OpenAI | Tool-calling agent (`gpt-4o-mini`, `gpt-5-mini`, etc.) |
| **Customer Messaging** | Meta WhatsApp Cloud API (v21.0) | Webhook intake, interactive messages, templates |
| **Worker Dispatch** | Telegram Bot API (GrammY) | Group broadcasts, inline keyboards, callback updates |
| **Containerization** | Docker & Docker Compose | Multi-stage Alpine containerization |
| **Reverse Proxy** | Traefik | Automated TLS certificates & subdomain routing |

---

## 🚀 Getting Started (Local Development)

### 1. Prerequisites
- Node.js 20.x or higher
- npm 10.x or higher
- MongoDB Atlas Cluster or local MongoDB instance

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/sequenceit-git/mywab.git
cd mywab

# Install project dependencies
npm install
```

### 3. Environment Setup
Copy the template and configure your credentials:
```bash
cp .env.example .env
```

Edit `.env`:
```env
# MongoDB Atlas Configuration
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini

# WhatsApp Cloud API
WHATSAPP_PHONE_NUMBER_ID=1234567890
WHATSAPP_ACCESS_TOKEN=EAAT...
WHATSAPP_VERIFY_TOKEN=wapbusiness_secure_verify_token

# Telegram Bot
TELEGRAM_BOT_TOKEN=123456789:ABC...
TELEGRAM_WORKER_GROUP_ID=-1001234567890

# Subdomain & Admin Auth
NEXT_PUBLIC_APP_URL=https://mywab.sequenceit.software
DOMAIN=mywab.sequenceit.software
ADMIN_EMAIL=admin@sequenceit.software
ADMIN_PASSWORD=admin123456
AUTH_SECRET=your_super_secret_session_key
```

### 4. Database Setup
The models are defined in `src/lib/db/models/`. Mongoose automatically initializes and indexes the collections upon first connection.

### 5. Launch Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🐳 Docker & Traefik Production Deployment

This project is configured with a multi-stage Docker build and native Traefik reverse proxy labels.

### 1. Subdomain & Network Matching
Ensure your `.env` contains your domain and Traefik Docker network:
```env
DOMAIN=mywab.sequenceit.software
TRAEFIK_NETWORK=traefik-network   # Name of your active Traefik external network
CERT_RESOLVER=letsencrypt
```

### 2. Build and Run Container
```bash
# Build and launch with Docker Compose
docker compose up -d --build

# View real-time container logs
docker compose logs -f app
```

---

## 🔐 Admin Authentication Panel

The dashboard is protected by session middleware (`src/middleware.ts`).

| Field | Default Value |
|---|---|
| **Login URL** | `https://mywab.sequenceit.software/login` |
| **Default Email** | `admin@sequenceit.software` |
| **Default Password** | `admin123456` |

*You can customize admin credentials anytime in `.env` using `ADMIN_EMAIL` and `ADMIN_PASSWORD`.*

---

## 🔗 Webhook Endpoints

| Service | Path | Description |
|---|---|---|
| **WhatsApp Inbound** | `GET /api/webhooks/whatsapp` | Webhook verification handshake with Meta |
| **WhatsApp Message Event** | `POST /api/webhooks/whatsapp` | Receives incoming customer messages & triggers LangChain agent |
| **Telegram Callback** | `POST /api/webhooks/telegram` | Receives worker claim & status updates from Telegram buttons |

---

## 📄 License

This software is developed and maintained by **SequenceIT**. All rights reserved.
