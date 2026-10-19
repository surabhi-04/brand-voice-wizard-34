<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Architecture

- Use a conventional React + Vite static single-page frontend without TanStack runtime or client-side routing, because the studio is deployed as static files on Vercel.
- Keep Gemini and Notion/n8n calls behind typed frontend service contracts to a separately deployed Node.js + Express backend, so provider credentials never enter browser code.
- Keep page composition in `src/components/studio`, validated request/response schemas in `src/lib`, and the Vite client entry at `src/main.tsx` to separate presentation, integration contracts, and bootstrapping.
