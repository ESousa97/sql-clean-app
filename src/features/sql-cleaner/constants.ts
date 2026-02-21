import type { ProgressState } from './types';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const DEFAULT_CHUNK_SIZE = 5;

export const EMPTY_PROGRESS: ProgressState = {
  current: 0,
  total: 0,
  stage: '',
};

export const ACCEPTED_FILE_EXTENSIONS = ['.sql', '.txt'];
