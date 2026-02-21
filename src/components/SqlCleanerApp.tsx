"use client";

import { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Download,
  FileText,
  Loader2,
  Upload,
} from 'lucide-react';

import {
  ACCEPTED_FILE_EXTENSIONS,
  EMPTY_PROGRESS,
  MAX_FILE_SIZE_BYTES,
} from '@/features/sql-cleaner/constants';
import {
  buildFinalSql,
  createDataSections,
  normalizeValuesBlock,
  parseSqlDump,
} from '@/features/sql-cleaner/sql-processing';
import type {
  ProcessingResult,
  ProcessingSection,
  ProgressState,
} from '@/features/sql-cleaner/types';

function isValidExtension(fileName: string): boolean {
  const normalizedName = fileName.toLowerCase();
  return ACCEPTED_FILE_EXTENSIONS.some((extension) =>
    normalizedName.endsWith(extension),
  );
}

async function processSection(section: ProcessingSection): Promise<string> {
  const response = await fetch('/api/clean-sql-section', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ section }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao processar seção (${response.status}).`);
  }

  const body = (await response.json()) as {
    content?: string;
    error?: { message?: string };
  };

  if (!body.content) {
    throw new Error(body.error?.message ?? 'Resposta vazia da API de processamento.');
  }

  return body.content;
}

export default function SqlCleanerApp() {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [progress, setProgress] = useState<ProgressState>(EMPTY_PROGRESS);

  const inputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setResult(null);
    setProgress(EMPTY_PROGRESS);
    setErrorMessage(null);
  };

  const resetApp = () => {
    setFile(null);
    resetState();
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    if (!isValidExtension(selectedFile.name)) {
      setErrorMessage('Selecione um arquivo .sql ou .txt.');
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage('Arquivo muito grande. Limite de 10MB.');
      return;
    }

    setFile(selectedFile);
    resetState();
  };

  const processFile = async () => {
    if (!file) {
      setErrorMessage('Selecione um arquivo para processar.');
      return;
    }

    setProcessing(true);
    setResult(null);
    setErrorMessage(null);
    setProgress({ ...EMPTY_PROGRESS, stage: 'Analisando arquivo...' });

    try {
      const sourceSql = await file.text();
      const { structureLines, dataBlocks } = parseSqlDump(sourceSql);
      const structureContent = structureLines.join('\n').trim();

      const sections: ProcessingSection[] = [];
      if (structureContent) {
        sections.push({
          type: 'structure',
          content: structureContent,
          priority: 1,
        });
      }

      sections.push(...createDataSections(dataBlocks));

      if (sections.length === 0) {
        throw new Error('Nenhuma seção processável foi encontrada no arquivo.');
      }

      let successfulSections = 0;
      let failedSections = 0;
      const structureSections: ProcessingSection[] = [];
      const valuesByTable: Record<string, string[]> = {};

      for (let index = 0; index < sections.length; index += 1) {
        const section = sections[index];
        const sectionLabel =
          section.type === 'data'
            ? `${section.tableName} (${section.chunkIndex}/${section.totalChunks})`
            : 'estrutura';

        setProgress({
          current: index + 1,
          total: sections.length,
          stage: `Processando ${sectionLabel}...`,
        });

        try {
          const processed = await processSection(section);

          if (section.type === 'structure') {
            structureSections.push({ ...section, content: processed });
          } else {
            const normalizedValues = normalizeValuesBlock(processed);
            const existingValues = valuesByTable[section.tableName] ?? [];
            valuesByTable[section.tableName] = [...existingValues, ...normalizedValues];
          }

          successfulSections += 1;
        } catch {
          failedSections += 1;
          if (section.type === 'structure') {
            structureSections.push(section);
          } else {
            const existingValues = valuesByTable[section.tableName] ?? [];
            const fallbackValues = normalizeValuesBlock(section.content);
            valuesByTable[section.tableName] = [...existingValues, ...fallbackValues];
          }
        }
      }

      const finalSql = buildFinalSql({
        fileName: file.name,
        structureSections,
        valuesByTable,
        dataBlocks,
        processedSections: sections.length,
        successfulSections,
        failedSections,
      });

      setResult({
        success: true,
        cleanedSql: finalSql,
        originalSize: sourceSql.length,
        cleanedSize: finalSql.length,
        chunksProcessed: sections.length,
      });
    } catch (error) {
      setResult({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erro desconhecido durante o processamento.',
      });
    } finally {
      setProcessing(false);
      setProgress(EMPTY_PROGRESS);
    }
  };

  const downloadCleanedFile = () => {
    if (!result?.cleanedSql) {
      return;
    }

    const blob = new Blob([result.cleanedSql], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'restore_clean.sql';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-shell">
      <main className="app-card">
        <header className="app-header">
          <h1 className="app-title">
            <FileText className="icon-lg" />
            SQL Cleaner
          </h1>
          <p className="app-subtitle">
            Converte blocos COPY para INSERT preservando estrutura e dados.
          </p>
        </header>

        <section className="app-content">
          <div className="form-block">
            <label className="field-label" htmlFor="file-upload">
              Arquivo PostgreSQL dump
            </label>
            <div className="upload-box">
              <input
                ref={inputRef}
                id="file-upload"
                type="file"
                accept=".sql,.txt"
                onChange={handleFileChange}
                className="sr-only"
              />
              <label htmlFor="file-upload" className="upload-label">
                <Upload className="icon-xl" />
                <span>Selecionar arquivo</span>
                <small>Extensões suportadas: .sql e .txt (máx. 10MB)</small>
              </label>
            </div>
          </div>

          {file && (
            <div className="file-meta" role="status" aria-live="polite">
              <FileText className="icon-md" />
              <div>
                <p>{file.name}</p>
                <small>{(file.size / 1024).toFixed(1)} KB</small>
              </div>
              <button type="button" className="button-link" onClick={resetApp}>
                Remover
              </button>
            </div>
          )}

          {processing && progress.total > 0 && (
            <div className="progress-card">
              <div className="progress-header">
                <Loader2 className="icon-md spin" />
                <span>{progress.stage}</span>
              </div>
              <progress value={progress.current} max={progress.total} className="progress" />
              <small>
                {progress.current}/{progress.total}
              </small>
            </div>
          )}

          {errorMessage && (
            <div className="alert warning" role="alert">
              <AlertCircle className="icon-md" />
              <p>{errorMessage}</p>
            </div>
          )}

          <button
            type="button"
            className="button-primary"
            onClick={processFile}
            disabled={!file || processing}
          >
            {processing ? (
              <>
                <Loader2 className="icon-sm spin" /> Processando...
              </>
            ) : (
              <>
                <FileText className="icon-sm" /> Processar arquivo
              </>
            )}
          </button>

          <div className="platform-description" aria-label="Descrição da plataforma">
            <p>
              Esta plataforma limpa dumps PostgreSQL para facilitar restauração e migração.
            </p>
            <p>
              O processo lê o arquivo, separa estrutura e dados, converte blocos COPY em
              instruções INSERT e mantém o conteúdo organizado por tabela.
            </p>
            <p>
              O objetivo é reduzir erros em processos de importação, padronizar o SQL final e
              acelerar tarefas de suporte, auditoria e recuperação de banco.
            </p>
          </div>

          {result && result.success && (
            <div className="alert success" role="status">
              <CheckCircle className="icon-md" />
              <div>
                <p>Arquivo processado com sucesso.</p>
                <small>
                  {result.chunksProcessed} seções • {result.cleanedSize?.toLocaleString()} caracteres
                </small>
              </div>
              <button
                type="button"
                className="button-secondary"
                onClick={downloadCleanedFile}
              >
                <Download className="icon-sm" /> Download
              </button>
            </div>
          )}

          {result && !result.success && (
            <div className="alert error" role="alert">
              <AlertCircle className="icon-md" />
              <p>{result.error}</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
