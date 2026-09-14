# WapBusiness (WhatsApp AI Commerce & Telegram Dispatch)

An automated e-commerce engine integrating **WhatsApp Business Cloud API**, **LangChain OpenAI conversational ordering**, **Supabase PostgreSQL database**, and **Telegram worker fulfillment dispatch** with atomic order claiming.

## Quick Start (Local Development)

1. Clone the repository:
   ```bash
   git clone https://github.com/sequenceit-git/mywab.git
   cd mywab
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   # Fill in your Supabase, OpenAI, WhatsApp, and Telegram credentials in .env
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Run development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the Operations Hub and Simulator.

---

## Production Deployment with Docker & Traefik

The project includes a multi-stage Dockerfile optimized for Next.js standalone mode and Traefik reverse proxy routing.

### 1. Environment Configuration

Ensure your `.env` contains your domain and Traefik settings:
```env
DOMAIN=your-shop-domain.com
TRAEFIK_NETWORK=traefik-crkl_default # or your Traefik network name
CERT_RESOLVER=letsencrypt
```

### 2. Build and Run with Docker Compose

```bash
# Build the container image
docker compose build

# Start the application in detached mode
docker compose up -d
```

### 3. Check Container & Logs

```bash
docker compose ps
docker compose logs -f app
```

---

## Supabase Database Migrations

Database migrations are organized in `supabase/migrations/`:
- `supabase/migrations/20260914000000_initial_schema.sql` - Complete schema, indexes, RLS policies, and atomic stored procedures (`claim_order_atomic`).
- `supabase/seed.sql` - Sample bilingual products catalog and store FAQs.
