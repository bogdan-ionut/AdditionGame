# Runtime & Models Dashboard

A minimal, production-ready React + TypeScript + Vite application styled with Tailwind CSS. The single “Runtime & Models” panel
surfaces the status of the AI runtime via the `/v1/ai/status` endpoint and provides resilient error handling.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the development server:

   ```bash
   npm run dev
   ```

   The app is served on the URL printed in the terminal.

3. Type-check or build for production when you are ready:

   ```bash
   npm run typecheck
   npm run build
   ```

4. Preview the production build locally (optional):

   ```bash
   npm run preview
   ```

## API configuration

The app resolves the API base URL from `VITE_API_URL`. If the variable is not set, it falls back to the current origin so the
frontend and backend can be served from the same host.

Create a `.env` file when targeting a remote API:

```bash
VITE_API_URL="https://your-api.example.com"
```

Restart the dev server after changing environment variables. During runtime you can click **Refresh status** to pull the latest
values from `{API_BASE}/v1/ai/status`.
