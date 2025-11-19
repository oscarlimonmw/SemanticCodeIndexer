/**
 * Semantic Code Indexer
 * 
 * A tool for parsing JavaScript/TypeScript files using Tree-sitter
 * and extracting semantic chunks (functions, classes, methods).
 */

export { SemanticCodeIndexer } from './indexer';
export { CodeParser } from './parser';
export { scanDirectory } from './scanner';
export { saveChunksToJson } from './output';
export { SemanticChunk, IndexerOptions } from './types';
