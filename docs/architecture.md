# Architecture

## Context

SQL Cleaner is a Next.js App Router project that processes PostgreSQL dump files and converts COPY data blocks into INSERT statements using a Gemini model.

## High-level flow

1. User uploads dump file in the client UI
2. Client parses file into:
   - structure sections
   - data sections split in chunks
3. Client sends each section to `POST /api/clean-sql-section`
4. Server prompts Gemini and returns cleaned SQL fragment
5. Client normalizes values and assembles final SQL output

## Design decisions

- **Server-side key management**: `GEMINI_API_KEY` only on server
- **Chunk-based processing**: reduces failure blast radius and improves resiliency
- **Shared domain utilities**: parsing, chunking, normalization and assembly are centralized in `src/features/sql-cleaner`
- **Fail-safe behavior**: if one chunk fails, fallback strategy keeps original content-derived values

## Trade-offs

- Sequential chunk processing is more reliable than aggressive parallelization, but can be slower
- LLM output quality depends on prompt behavior and model consistency
