import { NextResponse } from 'next/server';

import type { DataSection, ProcessingSection } from '@/features/sql-cleaner/types';

function isDataSection(section: ProcessingSection): section is DataSection {
  return section.type === 'data';
}

function getPrompt(section: ProcessingSection): string {
  if (isDataSection(section)) {
    return `Converta este bloco COPY (${section.recordCount} registros) para formato de VALORES apenas. IMPORTANTE: não inclua INSERT INTO.

REGRAS:
1. Converter dados tabulados em registros SQL no formato (valor1, 'texto', numero)
2. Strings entre aspas simples e números sem aspas
3. Escapar aspas simples no conteúdo textual (ex: don't => don''t)
4. Manter quebras de linha como \\n quando necessário
5. Cada linha deve gerar um tuple SQL
6. Não adicionar comentários ou explicações

BLOCO:
\`\`\`sql
${section.content}
\`\`\`

Retorne apenas os VALUES.`;
  }

  return `Organize e limpe esta seção de SQL PostgreSQL. Preserve o conteúdo funcional e retorne somente SQL válido.

SEÇÃO:
\`\`\`sql
${section.content}
\`\`\`

SQL limpo:`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { section?: ProcessingSection };

    if (!body.section || !body.section.content || body.section.content.length > 500_000) {
      return NextResponse.json(
        { error: { code: 'INVALID_SECTION', message: 'Invalid processing section payload.' } },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_GEMINI_API_KEY',
            message: 'GEMINI_API_KEY is not configured on the server.',
          },
        },
        { status: 500 },
      );
    }

    const prompt = getPrompt(body.section);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 0.8,
            maxOutputTokens: 50_000,
          },
        }),
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          error: {
            code: 'GEMINI_REQUEST_FAILED',
            message: `Gemini request failed with status ${response.status}.`,
          },
        },
        { status: response.status },
      );
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!content) {
      return NextResponse.json(
        { error: { code: 'EMPTY_GEMINI_RESPONSE', message: 'Gemini returned an empty content block.' } },
        { status: 502 },
      );
    }

    return NextResponse.json({ content });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unexpected processing error.' } },
      { status: 500 },
    );
  }
}
