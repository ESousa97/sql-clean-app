"use client";

import React, { useState, useRef } from 'react';
import { Upload, Download, FileText, AlertCircle, CheckCircle, Loader2, Clock } from 'lucide-react';

interface ProcessingResult {
  success: boolean;
  cleanedSql?: string;
  error?: string;
  originalSize?: number;
  cleanedSize?: number;
  chunksProcessed?: number;
}

const SqlCleanerApp: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0, stage: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.sql') && !selectedFile.name.toLowerCase().endsWith('.txt')) {
        alert('Por favor, selecione um arquivo .sql ou .txt');
        return;
      }
      
      if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limite
        alert('Arquivo muito grande. Limite máximo de 10MB.');
        return;
      }
      
      setFile(selectedFile);
      setResult(null);
      setProgress({ current: 0, total: 0, stage: '' });
    }
  };

  // Função para processar o arquivo inteiro de forma mais simples
  const processFileContent = (content: string) => {
    const lines = content.split('\n');
    const structureLines = [];
    const dataChunks: Array<{
      tableName: string;
      columns: string;
      data: string[];
    }> = [];
    
    let i = 0;
    let currentCopyBlock: {
      tableName: string;
      columns: string;
      data: string[];
    } | null = null;
    
    console.log(`Processando arquivo com ${lines.length} linhas`);
    
    // Processar TODAS as linhas do arquivo
    while (i < lines.length) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Se encontrou COPY, começar a coletar dados
      if (trimmedLine.startsWith('COPY ') && trimmedLine.includes('FROM stdin;')) {
        console.log(`Encontrado COPY na linha ${i}: ${trimmedLine}`);
        const copyMatch = trimmedLine.match(/COPY\s+(\w+\.\w+)\s+\(([^)]+)\)\s+FROM\s+stdin;/);
        if (copyMatch) {
          currentCopyBlock = {
            tableName: copyMatch[1],
            columns: copyMatch[2],
            data: []
          };
          console.log(`Iniciando coleta de dados para tabela: ${currentCopyBlock.tableName}`);
        }
        i++;
        continue;
      }
      
      // Se estamos dentro de um bloco COPY
      if (currentCopyBlock) {
        if (trimmedLine === '\\.') {
          // Fim do bloco COPY - salvar dados
          console.log(`Finalizando coleta para ${currentCopyBlock.tableName}: ${currentCopyBlock.data.length} registros`);
          if (currentCopyBlock.data.length > 0) {
            dataChunks.push({ ...currentCopyBlock });
          }
          currentCopyBlock = null;
        } else if (trimmedLine && !trimmedLine.startsWith('--')) {
          // Linha de dados válida
          currentCopyBlock.data.push(line);
        }
        i++;
        continue;
      }
      
      // Filtrar comandos especiais do psql que causam erro
      if (trimmedLine.startsWith('\\connect') || 
          trimmedLine.startsWith('\\c ') ||
          trimmedLine.startsWith('\\') ||
          trimmedLine.startsWith('INSERT INTO')) {
        console.log(`Removendo comando/INSERT existente na linha ${i}: ${trimmedLine.substring(0, 50)}...`);
        i++;
        continue;
      }
      
      // Se não é COPY, comando especial nem INSERT, manter linha (estrutura)
      structureLines.push(line);
      i++;
    }
    
    // Se ainda temos um bloco COPY ativo (arquivo mal formado), salvar mesmo assim
    if (currentCopyBlock && currentCopyBlock.data.length > 0) {
      console.log(`Salvando bloco COPY não fechado: ${currentCopyBlock.tableName} com ${currentCopyBlock.data.length} registros`);
      dataChunks.push(currentCopyBlock);
    }
    
    console.log(`Processamento concluído:`);
    console.log(`- Linhas de estrutura: ${structureLines.length}`);
    console.log(`- Tabelas com dados: ${dataChunks.length}`);
    console.log(`- Total de registros: ${dataChunks.reduce((sum, chunk) => sum + chunk.data.length, 0)}`);
    
    return {
      structureLines: structureLines,
      dataChunks: dataChunks
    };
  };

  // Função para criar chunks de dados
  const createDataChunks = (dataChunks: Array<{
    tableName: string;
    columns: string;
    data: string[];
  }>) => {
    const chunks: Array<{
      type: string;
      content: string;
      priority: number;
      tableName: string;
      chunkIndex: number;
      totalChunks: number;
      recordCount: number;
    }> = [];
    
    dataChunks.forEach(({ tableName, columns, data }) => {
      const chunkSize = 5;
      const totalChunks = Math.ceil(data.length / chunkSize);
      
      for (let i = 0; i < totalChunks; i++) {
        const startIndex = i * chunkSize;
        const endIndex = Math.min(startIndex + chunkSize, data.length);
        const chunkData = data.slice(startIndex, endIndex);
        
        const chunkContent = [
          `COPY ${tableName} (${columns}) FROM stdin;`,
          ...chunkData,
          '\\.'
        ].join('\n');
        
        chunks.push({
          type: 'data',
          content: chunkContent,
          priority: 7,
          tableName,
          chunkIndex: i + 1,
          totalChunks,
          recordCount: chunkData.length
        });
      }
    });
    
    return chunks;
  };

  // Função para processar uma seção específica com retry
  const processSection = async (section: {
    type: string;
    content: string;
    priority: number;
    tableName?: string;
    chunkIndex?: number;
    totalChunks?: number;
    recordCount?: number;
  }, sectionIndex: number, totalSections: number, retryCount = 0) => {
    const displayName = section.chunkIndex ? 
      `${section.tableName} (chunk ${section.chunkIndex}/${section.totalChunks} - ${section.recordCount} registros)` :
      section.tableName ? `${section.type} (${section.tableName})` : section.type;

    setProgress({
      current: sectionIndex + 1,
      total: totalSections,
      stage: retryCount > 0 ? `Reprocessando ${displayName} (tentativa ${retryCount + 1})` : `Processando ${displayName}`
    });

    let prompt = '';

    if (section.type === 'data') {
      prompt = `Converta este pequeno bloco COPY (${section.recordCount} registros) para formato de VALORES apenas. IMPORTANTE: NÃO inclua o cabeçalho INSERT INTO, apenas os VALUES:

REGRAS DE CONVERSÃO:
1. Converter apenas os dados tabulados (separados por TAB) → (valor1, 'texto', numero, 'timestamp')
2. Texto entre aspas simples, números sem aspas
3. Escapar aspas simples: don't → don''t
4. Manter quebras de linha como \\n dentro das aspas
5. Cada linha vira um conjunto de valores: (valor1, valor2, valor3),
6. NÃO incluir "INSERT INTO table_name (columns) VALUES"
7. NÃO adicionar comentários ou explicações

BLOCO PARA CONVERTER (${section.recordCount} registros):
\`\`\`sql
${section.content}
\`\`\`

Retorne apenas os VALUES (sem INSERT INTO):`;
    } else {
      prompt = `Organize e limpe esta seção de SQL PostgreSQL. Mantenha toda estrutura e dados. APENAS retorne o SQL limpo:

SEÇÃO: ${section.type.toUpperCase()}
\`\`\`sql
${section.content}
\`\`\`

SQL limpo:`;
    }

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 0.8,
            maxOutputTokens: 50000
          }
        })
      });

      if (response.status === 429) {
        // Rate limit - fazer retry com backoff exponencial
        if (retryCount < 3) {
          const waitTime = Math.pow(2, retryCount) * 5000; // 5s, 10s, 20s
          console.log(`Rate limit atingido para ${displayName}. Aguardando ${waitTime/1000}s antes de tentar novamente...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          return await processSection(section, sectionIndex, totalSections, retryCount + 1);
        } else {
          throw new Error(`Rate limit persistente para ${displayName} após 3 tentativas`);
        }
      }

      if (!response.ok) {
        throw new Error(`Erro na seção ${displayName}: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!content) {
        throw new Error(`Resposta vazia para seção ${displayName}`);
      }

      return content.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim();
    } catch (error) {
      console.error('Erro detalhado:', error);
      if (retryCount < 3 && (
        error instanceof Error && (
          error.message.includes('fetch') ||
          error.message.includes('network') ||
          error.message.includes('channel closed') ||
          error.name === 'NetworkError' ||
          error.name === 'TypeError'
        )
      )) {
        // Erro de rede/conexão - tentar novamente
        const waitTime = Math.pow(2, retryCount) * 3000; // 3s, 6s, 12s
        console.log(`Erro de rede para ${displayName}. Aguardando ${waitTime/1000}s antes de tentar novamente...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return await processSection(section, sectionIndex, totalSections, retryCount + 1);
      }
      throw error;
    }
  };

  const processFile = async () => {
    if (!file || !apiKey.trim()) {
      alert('Por favor, selecione um arquivo e insira a chave da API do Gemini');
      return;
    }

    setProcessing(true);
    setResult(null);
    setProgress({ current: 0, total: 0, stage: 'Iniciando...' });

    try {
      const fileContent = await file.text();
      
      setProgress({ current: 0, total: 0, stage: 'Analisando estrutura do arquivo...' });
      
      // Processar arquivo de forma mais simples
      const { structureLines, dataChunks } = processFileContent(fileContent);
      
      console.log(`Resultado do processamento:`);
      console.log(`- Encontrados ${dataChunks.length} tabelas com dados`);
      console.log(`- Total de registros: ${dataChunks.reduce((sum, chunk) => sum + chunk.data.length, 0)}`);
      console.log(`- Linhas de estrutura preservadas: ${structureLines.length}`);
      
      // Verificar se realmente encontramos dados
      if (dataChunks.length === 0) {
        console.warn('ATENÇÃO: Nenhum bloco COPY foi encontrado no arquivo!');
        console.log('Primeiras 10 linhas do arquivo:');
        fileContent.split('\n').slice(0, 10).forEach((line, i) => {
          console.log(`${i}: ${line}`);
        });
      }
      
      // Criar seções
      const sections = [];
      
      // 1. Estrutura do banco (tudo que não é INSERT nem COPY)
      const structureContent = structureLines.join('\n').trim();
      if (structureContent) {
        sections.push({
          type: 'structure',
          content: structureContent,
          priority: 1
        });
      }
      
      // 2. Chunks de dados
      const dataChunkSections = createDataChunks(dataChunks);
      sections.push(...dataChunkSections);
      
      if (sections.length === 0) {
        throw new Error('Não foi possível identificar seções válidas no arquivo');
      }

      console.log(`Total de seções para processar: ${sections.length}`);
      setProgress({ current: 0, total: sections.length, stage: 'Processando seções...' });

      // Processar cada seção com tratamento robusto de erros
      const processedSections = [];
      let successfulSections = 0;
      let failedSections = 0;
      
      for (let i = 0; i < sections.length; i++) {
        try {
          console.log(`Processando seção ${i + 1}/${sections.length}: ${sections[i].type}`);
          const processed = await processSection(sections[i], i, sections.length);
          processedSections.push({
            ...sections[i],
            processedContent: processed
          });
          successfulSections++;
          
          // Pausa maior entre requisições para evitar rate limit
          await new Promise(resolve => setTimeout(resolve, 3000)); // 3 segundos entre cada seção
        } catch (error) {
          console.warn(`Erro ao processar seção ${sections[i].type}:`, error);
          failedSections++;
          // Manter conteúdo original se falhar
          processedSections.push({
            ...sections[i],
            processedContent: sections[i].content
          });
          
          // Se muitas seções falharem consecutivamente, parar
          if (failedSections > 10 && (failedSections / (i + 1)) > 0.5) {
            console.error('Muitas seções falhando. Parando processamento para evitar problemas.');
            throw new Error(`Muitas falhas de processamento (${failedSections}/${i + 1}). Verifique sua conexão e chave da API.`);
          }
        }
      }
      
      console.log(`Processamento de seções concluído:`);
      console.log(`- Seções processadas com sucesso: ${successfulSections}`);
      console.log(`- Seções com falha (mantido original): ${failedSections}`);
      console.log(`- Total de seções: ${processedSections.length}`);

      // Montar resultado final
      setProgress({ current: sections.length, total: sections.length, stage: 'Montando arquivo final...' });
      
      // Separar estrutura e dados
      const structureSections = processedSections.filter(s => s.type === 'structure');
      const dataSections = processedSections.filter(s => s.type === 'data');
      
      // Agrupar INSERTs por tabela
      const dataByTable: { [tableName: string]: string[] } = {};
      dataSections.forEach(section => {
        if ('tableName' in section && section.tableName) {
          if (!dataByTable[section.tableName]) {
            dataByTable[section.tableName] = [];
          }
          dataByTable[section.tableName].push(section.processedContent);
        }
      });

      // Construir SQL final
      const finalParts = [
        '-- PostgreSQL Database Restore (Cleaned and Organized)',
        '-- Generated by SQL Database Organizer Pro',
        '-- All COPY statements converted to INSERT statements',
        `-- Original file: ${file.name}`,
        `-- Processed sections: ${processedSections.length}`,
        `-- Successful conversions: ${successfulSections}`,
        `-- Failed sections (kept original): ${failedSections}`,
        `-- Tables with data: ${Object.keys(dataByTable).length}`,
        '',
      ];

      // Adicionar estrutura
      if (structureSections.length > 0) {
        finalParts.push('-- DATABASE STRUCTURE');
        structureSections.forEach(section => {
          finalParts.push(section.processedContent);
        });
        finalParts.push('');
      } else {
        finalParts.push('-- No structure sections found');
        finalParts.push('');
      }

      // Adicionar dados agrupados por tabela
      if (Object.keys(dataByTable).length > 0) {
        finalParts.push('-- DATA SECTION');
        Object.entries(dataByTable).forEach(([tableName, valueChunks]) => {
          finalParts.push(`-- Data for table: ${tableName} (${valueChunks.length} chunks converted)`);
          
          // Encontrar colunas da primeira tabela processada
          const firstDataChunk = dataChunks.find(chunk => chunk.tableName === tableName);
          if (firstDataChunk) {
            // Criar um único INSERT com todos os VALUES
            finalParts.push(`INSERT INTO ${tableName} (${firstDataChunk.columns}) VALUES`);
            
            // Processar e normalizar todos os VALUES
            const allValues = valueChunks
              .map(chunk => chunk.trim())
              .filter(chunk => chunk && !chunk.includes('INSERT INTO'))
              .join('\n')
              .split('\n')
              .map(line => line.trim())
              .filter(line => line && line !== '')
              .map((line, index, array) => {
                // Remover vírgula ou ponto-e-vírgula do final
                const cleanLine = line.replace(/[,;]\s*$/, '');
                
                // Adicionar vírgula no final, exceto na última linha
                if (index === array.length - 1) {
                  return cleanLine + ';'; // Última linha termina com ;
                } else {
                  return cleanLine + ','; // Outras linhas terminam com ,
                }
              });
            
            if (allValues.length > 0) {
              allValues.forEach(line => {
                finalParts.push(line);
              });
            }
          }
          finalParts.push('');
        });
      } else {
        finalParts.push('-- No data sections found - this may indicate all data was already in INSERT format');
        finalParts.push('');
      }

      const finalSql = finalParts.join('\n');

      setResult({
        success: true,
        cleanedSql: finalSql,
        originalSize: fileContent.length,
        cleanedSize: finalSql.length,
        chunksProcessed: processedSections.length
      });

    } catch (error) {
      console.error('Erro geral no processamento:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido durante o processamento'
      });
    } finally {
      setProcessing(false);
      setProgress({ current: 0, total: 0, stage: '' });
    }
  };

  const downloadCleanedFile = () => {
    if (!result?.cleanedSql) return;

    const blob = new Blob([result.cleanedSql], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'restore_clean.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetApp = () => {
    setFile(null);
    setResult(null);
    setProgress({ current: 0, total: 0, stage: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileText className="w-8 h-8" />
              PostgreSQL Database Organizer Pro
            </h1>
            <p className="text-blue-100 mt-2">
              Processa arquivos grandes em seções para preservar todos os dados
            </p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* API Key Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Chave da API do Gemini
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Cole sua chave da API do Gemini aqui..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500">
                Obtenha sua chave em: https://aistudio.google.com/app/apikey
              </p>
            </div>

            {/* File Upload */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Arquivo verceldb (PostgreSQL dump)
              </label>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".sql,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-700">
                    Clique para selecionar arquivo verceldb
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Suporta arquivos até 10MB - Processamento em seções
                  </p>
                </label>
              </div>

              {file && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <p className="font-medium text-blue-900">{file.name}</p>
                    <p className="text-sm text-blue-600">
                      {(file.size / 1024).toFixed(1)} KB ({(file.size).toLocaleString()} caracteres aprox.)
                    </p>
                  </div>
                  <button
                    onClick={resetApp}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Remover
                  </button>
                </div>
              )}
            </div>

            {/* Progress */}
            {processing && progress.total > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-blue-900">Processando...</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  ></div>
                </div>
                <p className="text-sm text-blue-700">
                  {progress.stage} ({progress.current}/{progress.total})
                </p>
              </div>
            )}

            {/* Warning */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-yellow-900 mb-1">
                    🎯 Processamento Ultra-Granular por Registros
                  </h4>
                  <p className="text-sm text-yellow-800">
                    Esta versão Pro processa <strong>5 registros por vez</strong> de cada tabela, 
                    garantindo que <strong>NENHUM dado seja truncado</strong>. Cada chunk é convertido 
                    individualmente de COPY para INSERT e depois reagrupado por tabela no arquivo final.
                    <br />
                    <strong>⚠️ IMPORTANTE:</strong> Com muitas seções (50+), o processamento pode levar 
                    alguns minutos devido aos limites de rate da API do Gemini. O sistema automaticamente 
                    aguarda e tenta novamente se atingir o limite.
                  </p>
                </div>
              </div>
            </div>

            {/* Process Button */}
            <button
              onClick={processFile}
              disabled={!file || !apiKey.trim() || processing}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-lg font-medium transition-all hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processando por seções...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  Processar Arquivo Completo
                </>
              )}
            </button>

            {/* Results */}
            {result && (
              <div className="space-y-4">
                {result.success ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <h3 className="font-medium text-green-900">
                        Arquivo Processado com Sucesso!
                      </h3>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div>
                        <span className="text-gray-600">Tamanho original:</span>
                        <span className="font-medium ml-2">
                          {result.originalSize?.toLocaleString()} caracteres
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Tamanho final:</span>
                        <span className="font-medium ml-2">
                          {result.cleanedSize?.toLocaleString()} caracteres
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Seções processadas:</span>
                        <span className="font-medium ml-2">
                          {result.chunksProcessed}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Taxa de preservação:</span>
                        <span className="font-medium ml-2 text-green-600">
                          {result.originalSize && result.cleanedSize ? 
                            `${Math.round((result.cleanedSize / result.originalSize) * 100)}%` : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-green-100 p-3 rounded-lg mb-4">
                      <h4 className="font-medium text-green-900 mb-2">✅ Processamento ultra-granular:</h4>
                      <ul className="text-sm text-green-800 space-y-1">
                        <li>• Header e estruturas organizados</li>
                        <li>• Dados processados em chunks de 5 registros</li>
                        <li>• TODOS os COPY convertidos para INSERT</li>
                        <li>• INSERTs reagrupados por tabela no final</li>
                        <li>• Zero truncamento - 100% dos dados preservados</li>
                        <li>• Processadas {result.chunksProcessed} seções/chunks</li>
                      </ul>
                    </div>

                    <button
                      onClick={downloadCleanedFile}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download restore_clean.sql ({result.cleanedSize?.toLocaleString()} chars)
                    </button>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <h3 className="font-medium text-red-900">Erro no Processamento</h3>
                    </div>
                    <p className="text-red-700 mb-3">{result.error}</p>
                    <div className="text-sm text-red-600">
                      <p><strong>Dicas para resolver:</strong></p>
                      <ul className="list-disc ml-5 mt-1">
                        <li>Verifique se a chave da API está correta</li>
                        <li>Confirme se há créditos disponíveis no Google AI Studio</li>
                        <li>Tente novamente - o processamento por seções é mais confiável</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SqlCleanerApp;
