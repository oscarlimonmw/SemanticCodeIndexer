/**
 * Represents a semantic chunk extracted from source code
 */

export type ChunkType =
  | 'function'
  | 'class'
  | 'method'
  | 'arrow_function'
  | 'constructor'
  | 'locator'
  | 'action'
  | 'assert'
  | 'helper'
  | 'test'
  | 'setup'
  | 'fixture'
  | 'constant'
  | 'iife';

export interface SemanticChunk {
  name: string;
  type: ChunkType;
  filePath: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  code?: string;
  className?: string;
  functionName?: string;
  chunkType?: ChunkType;
  repository?: string;
  module?: string;
  relatedTestCases?: string[];
  docstring?: string;
  testSuiteName?: string;
  testName?: string;
}

/**
 * Configuration options for the indexer
 */
export interface IndexerOptions {
  path: string;
  target?: string;
  includeCode?: boolean;
  projectType?: 'angular' | 'playwright';
}
