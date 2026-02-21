# Deployment

## Recommended target

Vercel is the recommended deployment platform for this Next.js project.

## Environment variables

Configure in deployment platform:

- `GEMINI_API_KEY` (required)
- `NODE_ENV=production`

## Production checks

Before deployment, run:

```bash
npm ci
npm run validate
npm audit --omit=dev --audit-level=high
```

## Rollback strategy

- Keep immutable deployment artifacts by commit SHA
- Roll back by promoting previous successful deployment
- Monitor API failures for `/api/clean-sql-section` after release
