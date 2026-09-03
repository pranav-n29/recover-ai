# RecoverAI Frontend

Professional RecoverAI Revenue Recovery OS frontend, rebuilt around the supplied fintech SaaS/Figma design while preserving the existing backend integration.

## Important
- No demo/customer/recovery data is hard-coded into the application.
- All case, AI decision, guardrail and audit values come from the backend APIs.
- If the backend exposes `customerName` or `customer`, it is shown in case tables/drawers; otherwise the UI uses a neutral `Customer #<caseId>` fallback rather than inventing a person.

## Backend URL
By default the app calls:

`http://localhost:5000`

To change it, create `.env`:

`VITE_API_URL=http://localhost:5000`

## Expected API endpoints
- `GET /api/dashboard/summary`
- `GET /api/dashboard/cases`
- `GET /api/recovery/cases/:caseId`
- `POST /api/recovery/run-agent`
- `GET /api/guardrails`
- `GET /api/audit?limit=100`

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
