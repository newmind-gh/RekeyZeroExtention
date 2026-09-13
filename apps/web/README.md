# RekeyZero Web

React operator application for the RekeyZero MVP.

Stack:

- React + TypeScript
- Vite
- React Router
- TanStack Query
- shadcn/ui conventions with Base UI primitives
- Tailwind CSS

## Status

This repository does not bundle the Workspace API. The Personal extension and the synthetic extension test pages do not depend on this application. Use this source only with an independently supplied, compatible API.

## Run with an external API

```bash
npm ci
npm run dev
```

Set `VITE_API_BASE` to the compatible API origin before starting the app. If it is omitted, the development default is `http://localhost:8000`.
