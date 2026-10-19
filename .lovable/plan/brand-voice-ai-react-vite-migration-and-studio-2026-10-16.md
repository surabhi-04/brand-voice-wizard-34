# Brand Voice AI: React + Vite migration and studio

## Plan for review

- Migrate the template from TanStack Start to a conventional React 19 + TypeScript + Vite client app; do not start implementation until this plan is approved.
- Preserve the Brand Voice AI editorial art direction and build the responsive single-page studio: navigation, hero preview, accessible campaign form, honest integration-pending states, results workspace, how-it-works, campaign-library empty state, and footer.
- Keep Gemini generation, individual/all-tweet regeneration, and n8n/Notion saving behind typed frontend service contracts. Show pending states unless actual endpoints are configured; never fabricate results or save success.

## Migration scope

- Replace the TanStack Vite wrapper with the normal Vite React and Tailwind v4 plugins; add `index.html` and `src/main.tsx` as the client entry, and make `src/App.tsx` the single-page experience. Use in-page anchors rather than adding a router.
- Remove TanStack route files/tree, router/start/server bootstrap, SSR error handling, and their package/build configuration. Move page metadata to `index.html`.
- Retain TypeScript, Tailwind v4, Lucide, shadcn UI files, `clsx`/`tailwind-merge`, Vite, and the existing test/lint setup where compatible. Keep only dependencies the app actually uses; avoid adding React Router or Express to the browser package.
- Add `vercel.json` for a Vite static deployment: build with `npm run build`, publish `dist`, and send SPA paths to `/index.html`.
- Keep the separately deployed Node.js + Express backend outside the frontend runtime (for example, a `server/` package). Store Gemini and n8n secrets only in that backend's environment. Configure the public frontend API origin with `VITE_API_BASE_URL`; restrict backend CORS to the deployed frontend origin.
- Leave the backend integrations as documented contracts until their real Gemini credentials and n8n/Notion endpoints are configured.

## API contracts

- `POST /api/campaigns/generate`: validated campaign input → brand voice profile plus exactly 10 tweets with IDs, labels, text, and inferred-versus-user-supplied provenance.
- `POST /api/campaigns/:campaignId/tweets/:tweetNumber/regenerate`: campaign context and tweet number → replacement for that tweet only.
- `POST /api/campaigns/:campaignId/regenerate`: campaign context → a complete replacement set of exactly 10 tweets; frontend confirms before replacing results.
- `POST /api/campaigns/:campaignId/notion-save`: campaign data → saved Notion reference only after a real successful n8n/Notion response.
- `GET /api/campaigns/history`: campaigns genuinely saved to Notion → library items; return an empty list when none exist, never sample history.
- Validate all payloads in Express with Zod; return actionable non-2xx error responses. The browser never holds Gemini, Notion, or webhook credentials.

## Verification and risks

- Replace the route-tree test with tests for the conventional app entry/service contract and run existing project tests, lint, and production build.
- Verify form validation, tone selection, pending/error states, clipboard actions, keyboard access, reduced motion, and desktop/mobile layout in the running app.
- Main migration risks: the current Vite config is a Lovable TanStack wrapper with Nitro/Cloudflare defaults; generated route-tree imports are framework-specific; the current routing test expects TanStack; and generated shadcn files may need minor compatibility adjustments. Preserve compatible UI files and lockfile consistency rather than rewriting wholesale.
- Vercel serves only the static frontend in this plan. The Express API needs its own Node-capable deployment and URL; generation and Notion saving remain unavailable until that backend is deployed and configured.
