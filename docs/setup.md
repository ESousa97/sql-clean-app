# Setup Guide

## Local setup

```bash
git clone https://github.com/enoquesousa/sql-clean-app.git
cd sql-clean-app
npm install
cp .env.example .env.local
```

Set environment variable:

```bash
GEMINI_API_KEY=your-key
```

Run application:

```bash
npm run dev
```

## Validation commands

```bash
npm run lint
npm run test
npm run build
npm run validate
```
