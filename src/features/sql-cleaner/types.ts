export interface ProcessingResult {
  success: boolean;
  cleanedSql?: string;
  error?: string;
  originalSize?: number;
  cleanedSize?: number;
  chunksProcessed?: number;
}

export interface ProgressState {
  current: number;
  total: number;
  stage: string;
}

export interface CopyDataBlock {
  tableName: string;
  columns: string;
  data: string[];
}

export interface ParsedDump {
  structureLines: string[];
  dataBlocks: CopyDataBlock[];
}

export interface StructureSection {
  type: 'structure';
  content: string;
  priority: number;
}

export interface DataSection {
  type: 'data';
  content: string;
  priority: number;
  tableName: string;
  chunkIndex: number;
  totalChunks: number;
  recordCount: number;
}

export type ProcessingSection = StructureSection | DataSection;
