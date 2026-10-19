# Brand Voice AI — Editorial Brand Studio & Campaign Orchestrator

An AI-powered brand voice studio built with React 19, TypeScript, Tailwind CSS, Vite, Node.js + Express, Google OAuth, MySQL, and JWT session authentication. It analyzes a brand brief to uncover its unique written personality and generates exactly 10 campaign-ready tweets adhering strictly to user-selected tones and emoji distribution preferences, with live Notion database synchronization via an n8n webhook workflow.

---

## 1. System Architecture

Brand Voice AI follows a decoupled, security-first architecture designed to separate static client presentation from backend AI orchestration, database persistence, and private credentials:

```
┌──────────────────────────────────────────────┐
│  Static Frontend (React 19 + Vite)           │
│  - Editorial Studio & Form Controls          │
│  - Google Sign-In with GIS Client            │
│  - User Menu & Session State                 │
│  - Dual-Level Emoji Preference System        │
│  - Strict Tone Adherence Badge Engine        │
│  - User-Scoped Campaign Library              │
│  - Deployed on Vercel (dist/ static files)   │
└───────────────────────┬──────────────────────┘
                        │
                        │ JSON HTTP API (VITE_API_BASE_URL)
                        │ Credentials: "include" (HttpOnly Session Cookie)
                        ▼
┌──────────────────────────────────────────────┐
│  Backend API (Node.js + Express)             │
│  - Google Token Verification (Official SDK)  │
│  - JWT Session Issuance & Auth Middleware    │
│  - Rate Limiting on /api/auth/*              │
│  - MySQL 8.0 Persistence with User Scoping   │
│  - In-Memory Fallback for Dev & Testing      │
│  - Port 3001 / Strict Credentialed CORS      │
└───────────────┬──────────────────────┬───────┘
                │                      │
       REST API │                      │ Webhook POST
                ▼                      ▼
┌───────────────────────────┐  ┌───────────────────────────┐
│ Google Gemini 2.5 Flash   │  │ n8n Automation Engine     │
│ - Brand Voice Profile     │  │ - Transforms Payload      │
│ - 10 Campaign Tweets      │  │ - Notion API Database     │
│ - Single/Batch Regen      │  │ - Returns Page ID & URL   │
└───────────────────────────┘  └───────────────────────────┘
```

- **Static Frontend**: React 19 single-page application built with Vite and Tailwind CSS. Deployed statically to Vercel without TanStack runtime or client routing. Zero provider keys or private webhooks exist in client-side code.
- **Node.js Express Backend**: Independent microservice exposing typed endpoints for Google verification, JWT authentication, MySQL user/campaign persistence, Gemini AI generation, single/batch regeneration, and n8n Notion dispatch.
- **Google OAuth 2.0**: Official server-side ID token verification using `google-auth-library`. Verifies token signature, expiry, and client audience before creating or finding users.
- **MySQL Database**: Persistent storage for `users` and `campaigns` tables with foreign keys and strict per-user ownership scoping.
- **Google Gemini 2.5 Flash**: Editorial reasoning engine generating inferred voice profiles and 10 bespoke tweets.
- **n8n + Notion Campaign Library**: Automated workflow webhook that transforms campaign briefs and generated copy into structured Notion database properties and page blocks, returning authenticated Notion page URLs.

---

## 2. Authentication & Data Persistence

### Google Sign-In + JWT Session Flow

1. **User Sign-In**: The user clicks **Continue with Google** in the top navigation or studio gate.
2. **Google Identity Services (GIS)**: Google authenticates the user and delivers a signed ID token (`credential`) to the client.
3. **Server-Side Token Verification**: The frontend dispatches `POST /api/auth/google` with the ID token. The backend verifies it using Google's official `OAuth2Client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })`. User details sent directly from the client are never trusted.
4. **User Persistence**: The user is upserted into MySQL using Google's immutable `sub` identifier as the unique key.
5. **JWT Issuance**: The backend issues an application-signed JWT containing claims: `sub` (internal user ID), `iss` (`brand-voice-ai`), `aud` (`brand-voice-ai-app`), and a 24-hour expiration (`exp`).
6. **HttpOnly Cookie**: The JWT is set in an `HttpOnly`, `SameSite: Lax`, `Secure` (in production) cookie named `bv_session`. Long-lived authentication tokens are never stored in browser `localStorage`.
7. **Session Restoration**: On page refresh, `GET /api/auth/me` verifies the session cookie and restores user state.
8. **Logout**: `POST /api/auth/logout` clears the session cookie and invalidates client session state.

### Multi-User Data Isolation

- Every saved campaign record belongs strictly to the authenticated `user_id`.
- `GET /api/campaigns/history` queries only campaigns where `user_id = req.user.id`.
- Modifying, regenerating, or saving a campaign checks ownership and returns `403 Forbidden` if one user attempts to access another user's campaign ID.

---

## 3. Database Setup & Schema Migrations

The database schema is located at `server/src/schema.sql` and includes the `users` and `campaigns` tables:

```sql
CREATE DATABASE IF NOT EXISTS brand_voice_ai
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE brand_voice_ai;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  google_id VARCHAR(128) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  profile_picture TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_google_id (google_id),
  INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaigns (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  brand_name VARCHAR(255) NOT NULL,
  industry VARCHAR(255) DEFAULT '',
  campaign_objective VARCHAR(100) NOT NULL,
  product_info TEXT,
  brand_voice_profile JSON,
  tweets JSON,
  notion_url VARCHAR(500) NULL,
  notion_page_id VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_campaigns_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_campaigns_user_id (user_id),
  INDEX idx_campaigns_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Running Migrations

You can run migrations in two ways:
1. **Automatic**: When `MYSQL_USER` and `MYSQL_PASSWORD` are configured in `server/.env`, the server automatically creates the tables on startup via `runDatabaseMigrations()`.
2. **Manual MySQL CLI**:
   ```bash
   mysql -u root -p < server/src/schema.sql
   ```

---

## 4. Google Cloud Console OAuth Setup

To obtain a Google Client ID for Google Sign-In:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g. `Brand Voice AI`) or select an existing one.
3. Navigate to **APIs & Services** > **OAuth consent screen**:
   - Choose **External** user type and click **Create**.
   - Enter **App name** (e.g. `Brand Voice AI`) and your developer email.
   - Click **Save and Continue** through Scopes (default `email`, `profile`, `openid` are sufficient).
   - Under **Test users**, add your own Google email address if keeping the app in Testing status.
4. Navigate to **APIs & Services** > **Credentials**:
   - Click **Create Credentials** > **OAuth client ID**.
   - Select **Application type**: **Web application**.
   - Name: `Brand Voice AI Web Client`.
   - **Authorized JavaScript origins**:
     - Local development: `http://localhost:8080` and `http://127.0.0.1:8080`
     - Production: `https://your-app-domain.vercel.app`
   - Click **Create**.
5. Copy your **Client ID** (format: `xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`).
6. Paste the Client ID into `server/.env`:
   ```env
   GOOGLE_CLIENT_ID=your_client_id_here
   ```

---

## 5. Environment Variables Reference

### Frontend Configuration (`.env`)

| Variable | Required | Description | Example / Default |
| :--- | :---: | :--- | :--- |
| `VITE_API_BASE_URL` | Optional | Public origin of the deployed Express backend | `http://localhost:3001` |
| `VITE_GOOGLE_CLIENT_ID` | Optional | Client ID fallback (also fetched dynamically via `/api/auth/config`) | `123456...apps.googleusercontent.com` |

### Backend Configuration (`server/.env`)

| Variable | Required | Description | Example / Default |
| :--- | :---: | :--- | :--- |
| `PORT` | Optional | Port for the Express backend server | `3001` |
| `FRONTEND_ORIGIN` | Optional | Allowed CORS origin for frontend credentials | `http://localhost:8080` |
| `GEMINI_API_KEY` | **Yes** | Google AI Studio API key | `AIzaSy...` |
| `GEMINI_MODEL` | Optional | Gemini model identifier | `gemini-2.5-flash` |
| `N8N_NOTION_WEBHOOK_URL` | **Yes** | n8n Webhook URL for Notion campaign persistence | `https://n8n.../webhook/...` |
| `GOOGLE_CLIENT_ID` | **Yes** | Google OAuth Web Client ID for token verification | `123456...apps.googleusercontent.com` |
| `JWT_SECRET` | **Yes** | Strong secret string (min 32 chars) for JWT signing | `openssl rand -hex 32` |
| `MYSQL_HOST` | Optional | MySQL server host | `localhost` |
| `MYSQL_PORT` | Optional | MySQL server port | `3306` |
| `MYSQL_DATABASE` | Optional | MySQL database name | `brand_voice_ai` |
| `MYSQL_USER` | **Yes** | MySQL user username | `root` or `brand_voice_user` |
| `MYSQL_PASSWORD` | **Yes** | MySQL user password | `your_mysql_password` |

---

## 6. Local Setup & Execution Guide

### Prerequisites

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- MySQL 8.0+ running locally on port 3306

### Step 1: Configure Environment Files

```bash
# Frontend environment
cp .env.example .env

# Backend environment
cp server/.env.example server/.env
```

Edit `server/.env` and add:
- `GEMINI_API_KEY`: Your key from [Google AI Studio](https://aistudio.google.com/)
- `N8N_NOTION_WEBHOOK_URL`: Your n8n webhook URL
- `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID
- `JWT_SECRET`: A secure random string (e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- `MYSQL_USER` and `MYSQL_PASSWORD`: Your local MySQL credentials

### Step 2: Start the Backend Service

```bash
cd server
npm install
npm run dev
```

The backend server starts on `http://localhost:3001`. The startup check validates all environment variables without leaking secret keys.

### Step 3: Start the Frontend Application

```bash
# In project root
npm install
npm run dev
```

The frontend studio runs on `http://localhost:8080`.

---

## 7. Automated Testing & Verification

### Frontend Tests (Vitest)

```bash
npm test
```

_Result: 36 passing tests across 3 test suites (`campaign-service.test.ts`, `brand-voice-studio.test.tsx`, `auth-flow.test.tsx`)._

### Backend Tests (Node Native Runner)

```bash
cd server
npm test
```

_Result: 31 passing tests across 4 test suites (`gemini.test.js`, `auth.test.js`)._

### Production Build

```bash
npm run build
```

_Result: Clean Vite production bundle in `dist/` in ~400ms with zero errors._
