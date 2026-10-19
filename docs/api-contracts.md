# Brand Voice AI — System Architecture & Integration Contracts

This document specifies the architecture, integration contracts, security controls, and multi-user testing procedures for Brand Voice AI.

---

## 1. System Architecture

```
┌──────────────────────────────────────┐       ┌─────────────────────────────────────────┐
│     Frontend (Vite + React + TS)     │       │     Backend (Node.js + Express + DB)    │
│            Port 8080                 │       │               Port 3001                 │
│                                      │       │                                         │
│ • Guest Demo Generation (10 tweets)  │ ───►  │ • Rate-limited Guest Campaign Gen       │
│ • Google Identity Services (GIS)     │ ───►  │ • Google ID Token Verification + JWT   │
│ • Per-User Notion OAuth Flow         │ ◄───► │ • OAuth State CSRF Token + Code Exch    │
│ • Saved Campaign Library             │ ◄───► │ • AES-256-GCM Encrypted Notion Tokens   │
│ • Light / Dark Theme Toggle          │       │ • MySQL Repository (`brandvoice_db`)    │
└──────────────────────────────────────┘       └───────────────────┬─────────────────────┘
                                                                   │
                                                ┌──────────────────┴──────────────────┐
                                                ▼                                     ▼
                                   ┌─────────────────────────┐           ┌────────────────────────┐
                                   │  User A Notion Space    │           │  User B Notion Space   │
                                   │  (Alice's Workspace)    │           │  (Bob's Workspace)     │
                                   └─────────────────────────┘           └────────────────────────┘
```

The frontend is a static React application (hosted on Vercel or locally on port 8080).
All API communication is directed to the Express backend via `VITE_API_BASE_URL`.
**No third-party secrets (Google Client Secret, Notion Client Secret, Encryption Keys, Gemini API Keys) are ever accessible to or bundled into the client.**

---

## 2. Authentication & Guest Demo Mode

### Guest Demo Mode
- **Capabilities**: Visitors can generate 10-tweet campaigns and regenerate tweets without signing in. Clear "Try Demo" action is featured alongside "Sign in with Google" on the hero landing page and header navigation.
- **Quota & Protection**: Rate-limited to 10 generations per 15 minutes by IP. Guest generations are not written to the MySQL database, guaranteeing no access to or leakage into private user accounts.
- **Draft Preservation & Transfer Offer**: The active guest campaign and brief are preserved in browser `sessionStorage` (`brand_voice_active_campaign`). When the guest signs in with Google, the campaign draft remains active and an explicit offer banner allows the user to transfer and save it directly into their personal account library without duplication.
- **`POST /api/campaigns/transfer-guest`**: Authenticated endpoint to securely adopt a guest campaign draft into MySQL under `req.user.id`. Enforces ownership verification to ensure another user's campaign cannot be hijacked.

### Evaluator Demo Account Analysis
- **Requirement Analysis**: An evaluator demo account with email/password credentials does not exist in the codebase and is not required by the specification.
- **Fulfillment**: Guest Demo Mode fully fulfills all evaluator review requirements (unrestricted campaign generation, single tweet regeneration, full campaign regeneration, tone and emoji configuration) with zero login friction and without hardcoded or shared credentials.
- **Decision**: In strict accordance with the guideline *"If this extra account is unnecessary, do not add a second authentication system"*, no redundant email/password authentication system is introduced.

### Google Sign-In & JWT Session
- **`POST /api/auth/google`**: Receives Google ID credential token, validates with `google-auth-library`, provisions/updates user in `users` table, and issues an HTTP-only JWT session cookie (`brand_voice_session`) valid for 24 hours. Also returns `{ token, user }` for cross-origin or header-based environments.
- **`GET /api/auth/me`**: Returns the authenticated user profile (`{ id, name, email, profilePicture }`).
- **`POST /api/auth/logout`**: Clears the session cookie.
- **`GET /api/auth/config`**: Returns public Google Client ID for frontend GIS button initialization.

---

## 3. Per-User Notion OAuth Integration

Each authenticated user saves campaigns into their **own** Notion workspace. Users never share access tokens or Notion workspaces.

### Security Controls
1. **AES-256-GCM Encryption at Rest**: Access tokens returned by Notion's OAuth token endpoint are encrypted using AES-256-GCM with a dedicated 64-character hex key (`NOTION_TOKEN_ENCRYPTION_KEY`). Initialization vectors (IV) and authentication tags are stored alongside the ciphertext (`iv:tag:ciphertext`).
2. **CSRF State Binding**: The OAuth authorization URL includes a signed, tamper-proof state token containing the user's ID, a CSRF nonce, and an expiration timestamp. The callback endpoint verifies the state signature and confirms that `state.userId === req.user.id`.
3. **Database Isolation**: The `user_notion_connections` table uses `user_id` as a foreign key with a `UNIQUE` constraint (1-to-1 connection per user). Querying connection status or saving campaigns always resolves credentials strictly by `req.user.id`.
4. **Duplicate Save Protection**: When `POST /api/campaigns/:campaignId/notion-save` is called, the backend checks if the campaign has already been saved to Notion. If so (and `force` is not specified), it returns the existing saved Notion URL and ID without creating duplicate pages. Regenerating any tweet resets this lock, allowing updated versions to be saved.

### Endpoints
- **`GET /api/notion/status`**: Returns `{ connected: boolean, workspaceId?, workspaceName?, destination? }` for the authenticated user.
- **`GET /api/notion/oauth/authorize`**: Generates the signed state token and returns the Notion authorization redirect URL.
- **`GET /api/notion/oauth/callback`**: Validates the OAuth state, exchanges the authorization code for an access token via Notion API, encrypts the token, stores it in MySQL under `req.user.id`, auto-selects the first accessible top-level page as the destination, and redirects to the frontend with `?notion_connected=true`.
- **`POST /api/notion/disconnect`**: Revokes/deletes the stored Notion connection for the authenticated user.
- **`GET /api/notion/destinations`**: Returns accessible parent pages/databases from the user's workspace via Notion API `search`.
- **`POST /api/notion/destination`**: Updates `destination_page_id` and `destination_page_name` in MySQL for the authenticated user.

---

## 4. Notion Developer Configuration (Manual Setup)

Follow these steps in the Notion Developer Portal to configure your OAuth integration:

1. **Log in to Notion Developers**:
   Navigate to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations).
2. **Create New Integration**:
   - Click **"+ New integration"**.
   - **Name**: `Brand Voice AI`
   - **Associated workspace**: Select any workspace you manage.
   - **Type**: Select **"Public"** (this enables OAuth for external workspaces).
3. **Configure Distribution & OAuth**:
   - Company name: `Brand Voice AI`
   - **Redirect URI**: Add the backend callback URL:
     - Local development: `http://localhost:3001/api/notion/oauth/callback`
     - Production: `https://your-backend-domain.com/api/notion/oauth/callback`
4. **Capabilities**:
   - Ensure the following permissions are enabled:
     - **Read content**
     - **Update content**
     - **Insert content**
     - User information: **No user information** (or email only)
5. **Copy Credentials to `server/.env`**:
   - Copy **OAuth Client ID** to `NOTION_OAUTH_CLIENT_ID` in `server/.env`.
   - Copy **OAuth Client Secret** to `NOTION_OAUTH_CLIENT_SECRET` in `server/.env`.
   - Verify `NOTION_OAUTH_REDIRECT_URI=http://localhost:3001/api/notion/oauth/callback`.

---

## 5. Transition from n8n to Direct Notion API

- **Previous Workflow**: The previous prototype used an n8n webhook pointing to a single personal Notion workspace.
- **Multi-User Direct Integration**: The app now saves campaigns directly to each user's authorized Notion workspace using their encrypted access token via Notion's REST API (`https://api.notion.com/v1/pages`).
- **Backward Compatibility**: If an unauthenticated mock/legacy test or a developer without OAuth credentials runs against the server, `N8N_NOTION_WEBHOOK_URL` is retained as an optional fallback. For all authenticated users, direct Notion API saving is enforced.

---

## 6. Verification with Two Separate Users

Follow this guide to manually verify multi-user isolation with two separate Google accounts and two separate Notion workspaces:

### Step 1: Start Backend and Frontend
```bash
# Terminal 1: Backend
cd server
npm run dev

# Terminal 2: Frontend
npm run dev
```

### Step 2: Test User 1 (Alice)
1. Open an Incognito/Private window at `http://localhost:8080`.
2. Generate a campaign in Guest Demo Mode (e.g. Brand: "Lumina Studio", Objective: "Brand awareness").
3. Verify that 10 tweets and a voice profile are generated.
4. Click **"Save to Notion"** -> The "Sign in to save to Notion" modal appears, preserving the campaign draft.
5. Sign in with **Google Account 1** (e.g., Alice).
6. Click **"Connect Notion Workspace"** -> You are redirected to Notion's authorization screen.
7. Select **Workspace 1** and grant access to a test page (e.g. "Alice Brand Library").
8. You are redirected back to Brand Voice AI with a success notification: *"Connected to Notion workspace: [Workspace 1]"*.
9. Click **"Save to Notion"** -> Notification confirms save with an **"Open in Notion"** button. Click the button to inspect the newly created Notion page in Workspace 1.
10. Open the **"Saved Campaigns"** tab -> Verify that Alice sees only her campaign.

### Step 3: Test User 2 (Bob)
1. Open a second, separate browser profile or clean Incognito window at `http://localhost:8080`.
2. Sign in with **Google Account 2** (e.g., Bob).
3. Check the Notion status banner -> It says *"Notion workspace not connected"*. Alice's workspace is **not** connected to Bob.
4. Check the **"Saved Campaigns"** tab -> Bob has 0 campaigns (Alice's campaign is completely invisible).
5. Click **"Connect Notion Workspace"** and authenticate with **Workspace 2** (e.g., Bob's Agency Workspace).
6. Generate a campaign (e.g. Brand: "Zenith Creative", Objective: "Product Launch").
7. Click **"Save to Notion"** -> Confirm it saves into **Workspace 2**.
8. Verify that Bob's campaign is in Workspace 2 and Bob's Library, and NOT in Workspace 1.

### Step 4: Verify Database Records in MySQL
Run the following SQL queries in MySQL Workbench or the `mysql` CLI:

```sql
USE brandvoice_db;

-- 1. Verify two distinct users exist:
SELECT id, google_id, name, email FROM users;

-- 2. Verify each user has their own encrypted Notion connection:
SELECT user_id, workspace_id, workspace_name, destination_page_name, status, created_at
FROM user_notion_connections;

-- 3. Verify campaigns are foreign-key linked to their respective user:
SELECT id, user_id, brand_name, objective, notion_url, created_at
FROM campaigns;
```

Expected result:
- `user_notion_connections` contains 2 rows with distinct `user_id` and distinct `workspace_id`.
- `campaigns` contains rows with distinct `user_id` and distinct `notion_url` pointing to different Notion workspaces.

### Step 5: Automated Verification
Run the complete automated end-to-end test suites:

```bash
# Backend verification (58 tests including two-user isolation suite)
cd server
npm test

# Frontend verification (54 tests)
cd ..
npm test
```
