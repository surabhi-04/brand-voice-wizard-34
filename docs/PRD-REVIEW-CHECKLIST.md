# Brand Voice AI — PRD Review & Verification Checklist

This document provides a structured audit checklist for hiring managers, engineering leads, and technical evaluators to verify the implementation of all requirements specified in [`docs/PRD.md`](./PRD.md).

---

## 1. Functional Requirements Verification Checklist

| Requirement ID | Requirement Name | Acceptance Criteria Summary | Automated Test Suite Evidence | Manual Verification Step | Status |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **FR-001** | Campaign Brief Intake | Form accepts & validates Brand Name, Industry, Objective, Offering, Audience, Tones, and Emoji settings. | `server/test/gemini.test.js`<br>`src/test/campaign-service.test.ts` | Fill in form on `/`; verify validation errors on empty brand name. | **VERIFIED** |
| **FR-002** | Voice Profile Synthesis | Ingests brief and outputs structured brand voice summary, audience, 3-5 themes, 3-5 characteristics, and inference tags. | `server/test/gemini.test.js`<br>`src/test/brand-voice-studio.test.tsx` | Generate campaign; verify "Brand Voice Profile" card renders with themes and traits. | **VERIFIED** |
| **FR-003** | 10-Tweet Batch Generation | Deterministically returns exactly 10 tweets with unique IDs, angle labels, tone badges, and copy under 280 chars. | `server/test/gemini.test.js`<br>`src/test/brand-voice-studio.test.tsx` | Count cards in grid; verify exactly 10 cards render with valid character counts. | **VERIFIED** |
| **FR-004** | Strict Tone Compliance | 100% of generated tweets use only tones selected by user; unselected tones never appear. | `server/test/gemini.test.js`<br>`src/test/brand-voice-studio.test.tsx` | Select only "Bold" and "Witty"; inspect all 10 tweet tone tags. | **VERIFIED** |
| **FR-005** | Emoji Count Engine | Enforces Question 1 (Yes/No) and Question 2 (1-10 count); reconciles excess or deficit emojis. | `server/test/gemini.test.js` | Select "No emojis" &rarr; 0 emojis. Select "4 out of 10" &rarr; exactly 4 tweets with emojis. | **VERIFIED** |
| **FR-006** | Single Tweet Regeneration | In-place regeneration of a single tweet without altering the other 9 tweets or the voice profile. | `server/test/gemini.test.js`<br>`src/test/brand-voice-studio.test.tsx` | Click refresh icon on Tweet #2; verify only Tweet #2 updates. | **VERIFIED** |
| **FR-007** | Batch Regeneration | In-place regeneration of all 10 tweets while retaining the existing brief and voice profile. | `server/test/gemini.test.js`<br>`src/test/brand-voice-studio.test.tsx` | Click "Regenerate All Tweets"; verify all 10 update with new copy. | **VERIFIED** |
| **FR-008** | Clipboard Copying | One-click copy of individual tweets or formatted all-tweet payload with Sonner toast feedback. | `src/test/brand-voice-studio.test.tsx` | Click "Copy" on tweet card; verify toast appears and checkmark icon toggles. | **VERIFIED** |
| **FR-009** | Guest Demo Mode | Allows unauthenticated visitors to generate campaigns and regenerate tweets without signing in. | `server/test/multi-user-isolation.test.js`<br>`src/test/auth-flow.test.tsx` | Open Incognito window; click "Try Demo"; submit brief; verify 10 tweets generate. | **VERIFIED** |
| **FR-010** | Draft Preservation & Transfer | Active guest draft is saved in `sessionStorage` and transferred to user account on Google Sign-In. | `server/test/multi-user-isolation.test.js`<br>`src/test/brand-voice-studio.test.tsx` | Generate in demo mode; sign in; verify transfer offer banner appears. | **VERIFIED** |
| **FR-011** | Google Authentication | Server-side Google ID token verification via `google-auth-library`; upserts user; issues 24h JWT. | `server/test/auth.test.js`<br>`src/test/auth-flow.test.tsx` | Click "Continue with Google"; complete login; verify user avatar renders. | **VERIFIED** |
| **FR-012** | Session Lifecycle | Restores session via `GET /api/auth/me` on refresh; logs out cleanly via `POST /api/auth/logout`. | `server/test/auth.test.js`<br>`src/test/auth-flow.test.tsx` | Refresh page; verify session persists; click "Sign out"; verify session clears. | **VERIFIED** |
| **FR-013** | Notion OAuth 2.0 | Public OAuth handshake; signed CSRF state; stores AES-256-GCM encrypted token in MySQL. | `server/test/notion.test.js`<br>`src/test/notion-integration.test.tsx` | Click "Connect Notion Workspace"; authorize in Notion; verify redirect confirmation. | **VERIFIED** |
| **FR-014** | Notion Destination Selection | Lists accessible workspace pages via Notion search; updates destination page ID in MySQL. | `server/test/notion.test.js`<br>`src/test/notion-integration.test.tsx` | Open destination modal; select parent page; verify destination updates. | **VERIFIED** |
| **FR-015** | Direct Notion Export | Creates formatted Notion page blocks under user's destination using user's encrypted token. | `server/test/notion.test.js`<br>`server/test/multi-user-isolation.test.js` | Click "Save to Notion"; verify button changes to "Open in Notion"; inspect Notion page. | **VERIFIED** |
| **FR-016** | Duplicate Save Protection | Subsequent clicks to "Save to Notion" return cached page URL without creating duplicate Notion pages. | `server/test/multi-user-isolation.test.js` | Re-click save on an already-saved campaign; verify immediate return of cached URL. | **VERIFIED** |
| **FR-017** | Campaign Library | Scoped view displaying user's historical campaigns stored in MySQL with direct Notion deep-links. | `server/test/mysql.test.js`<br>`src/test/brand-voice-studio.test.tsx` | Click "Saved Campaigns"; verify only authenticated user's campaigns display. | **VERIFIED** |
| **FR-018** | Light / Dark Themes | Toggles root `.dark` class, updates icons, and persists preference in `localStorage`. | `src/test/theme.test.tsx` | Click Sun/Moon button; verify background and text tokens invert smoothly. | **VERIFIED** |

---

## 2. Non-Functional & Security Verification Checklist

- [x] **Zero Secrets in Client Bundle**: Inspected `dist/` and `git diff` &rarr; no API keys, client secrets, or encryption keys in frontend code.
- [x] **AES-256-GCM Token Encryption**: Verified in [`server/test/notion.test.js`](file:///C:/Users/surab/brand-voice-wizard-34/server/test/notion.test.js) &rarr; authenticates ciphertext integrity, rejects tampered auth tags.
- [x] **Account-Linking CSRF Protection**: Verified in [`server/test/notion.test.js`](file:///C:/Users/surab/brand-voice-wizard-34/server/test/notion.test.js) &rarr; state token is signed JWT bound to `req.user.id` with 15-minute expiration.
- [x] **Multi-Tenant Row-Level Isolation**: Verified in [`server/test/multi-user-isolation.test.js`](file:///C:/Users/surab/brand-voice-wizard-34/server/test/multi-user-isolation.test.js) &rarr; User A (Alice) cannot view or modify User B's (Bob's) campaigns or Notion credentials.
- [x] **Aiven MySQL TLS Encryption**: Verified in [`server/test/mysql.test.js`](file:///C:/Users/surab/brand-voice-wizard-34/server/test/mysql.test.js) &rarr; `MYSQL_SSL=true` enforces `rejectUnauthorized: true` with `MYSQL_CA_CERT` PEM certificate support.
- [x] **Rate Limiting**: Verified in [`server/test/auth.test.js`](file:///C:/Users/surab/brand-voice-wizard-34/server/test/auth.test.js) &rarr; 50 requests/15m on auth; 10 requests/15m on guest generation.
- [x] **Serverless Connection Capping**: Verified in [`server/src/db.js`](file:///C:/Users/surab/brand-voice-wizard-34/server/src/db.js#L575) &rarr; `connectionLimit = 3` on Vercel to protect database capacity.

---

## 3. Automated Test Execution Commands

Run these commands inside the repository to independently verify the test suite:

```bash
# 1. Run all 63 backend native tests
npm test --prefix server

# 2. Run all 54 frontend Vitest tests
npm test -- --run

# 3. Verify clean production Vite bundle
npm run build
```

**Expected Result**:
- Backend: 63 passing tests across 12 suites (0 failures).
- Frontend: 54 passing tests across 5 test files (0 failures).
- Production Build: ~459 kB client JS bundle built into `dist/` in <1 second.

---

## 4. Unresolved External Prerequisites (For Live Production Deployment)

These items require external cloud credentials and cannot be pre-configured in code:

1. **Google Cloud Console**:
   - Add authorized JavaScript origin: `https://<your-vercel-domain>.vercel.app`
   - Add authorized redirect URI if using redirect mode.
2. **Notion Developer Portal**:
   - Ensure integration is set to **Public**.
   - Add authorized Redirect URI: `https://<your-vercel-domain>.vercel.app/api/notion/oauth/callback`.
3. **Vercel Project Settings**:
   - Enter environment variables in Vercel Dashboard (`GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`, `JWT_SECRET`, `MYSQL_*`, `NOTION_*`).
