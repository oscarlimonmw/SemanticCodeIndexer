/**
 * Represents a semantic chunk extracted from source code
 */
export interface SemanticChunk {
  name: string;
  type: 'function' | 'class' | 'method' | 'arrow_function' | 'constructor';
  filePath: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  code?: string;
}

/**
 * Configuration options for the indexer
 */
export interface IndexerOptions {
  path: string;
  target?: string;
  includeCode?: boolean;
}
