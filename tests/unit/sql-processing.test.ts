import { describe, expect, it } from 'vitest';

import {
  buildFinalSql,
  createDataSections,
  normalizeValuesBlock,
  parseSqlDump,
} from '@/features/sql-cleaner/sql-processing';

describe('parseSqlDump', () => {
  it('extracts structure and COPY data blocks', () => {
    const source = [
      '-- header',
      'CREATE TABLE public.users (id bigint, name text);',
      'COPY public.users (id, name) FROM stdin;',
      '1\tAlice',
      '2\tBob',
      '\\.',
      '',
    ].join('\n');

    const parsed = parseSqlDump(source);

    expect(parsed.structureLines).toContain(
      'CREATE TABLE public.users (id bigint, name text);',
    );
    expect(parsed.dataBlocks).toHaveLength(1);
    expect(parsed.dataBlocks[0].tableName).toBe('public.users');
    expect(parsed.dataBlocks[0].data).toEqual(['1\tAlice', '2\tBob']);
  });
});

describe('createDataSections', () => {
  it('splits data by chunk size', () => {
    const sections = createDataSections(
      [
        {
          tableName: 'public.users',
          columns: 'id, name',
          data: ['1\tAlice', '2\tBob', '3\tCarol'],
        },
      ],
      2,
    );

    expect(sections).toHaveLength(2);
    expect(sections[0].recordCount).toBe(2);
    expect(sections[1].recordCount).toBe(1);
  });
});

describe('normalizeValuesBlock', () => {
  it('keeps only SQL tuple rows', () => {
    const values = normalizeValuesBlock(`
      INSERT INTO users VALUES
      (1, 'Alice'),
      (2, 'Bob');
    `);

    expect(values).toEqual(["(1, 'Alice')", "(2, 'Bob')"]);
  });

  it('handles markdown fenced SQL and strips suffix punctuation', () => {
    const values = normalizeValuesBlock(`
      \`\`\`sql
      VALUES
      (3, 'Carol'),
      (4, 'Dave');
      \`\`\`
    `);

    expect(values).toEqual(["(3, 'Carol')", "(4, 'Dave')"]);
  });
});

describe('buildFinalSql', () => {
  it('assembles structure and grouped table values', () => {
    const sql = buildFinalSql({
      fileName: 'dump.sql',
      structureSections: [
        {
          type: 'structure',
          priority: 1,
          content: 'CREATE TABLE public.users (id bigint, name text);',
        },
      ],
      valuesByTable: {
        'public.users': ["(1, 'Alice')", "(2, 'Bob')"],
      },
      dataBlocks: [
        {
          tableName: 'public.users',
          columns: 'id, name',
          data: ['1\tAlice', '2\tBob'],
        },
      ],
      processedSections: 2,
      successfulSections: 2,
      failedSections: 0,
    });

    expect(sql).toContain('CREATE TABLE public.users (id bigint, name text);');
    expect(sql).toContain('INSERT INTO public.users (id, name) VALUES');
    expect(sql).toContain("(1, 'Alice'),");
    expect(sql).toContain("(2, 'Bob');");
  });
});
