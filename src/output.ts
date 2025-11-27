import * as fs from 'fs';
import * as path from 'path';
import { SemanticChunk } from './types';

interface TransformedChunk {
  document: string;
  metadata: {
    filepath: string;
    className?: string;
    functionName?: string;
    chunkType: string;
    repository?: string;
    module?: string;
    relatedTestCases?: string[];
    testSuiteName?: string;
    testName?: string;
    lines: {
      start: number;
      end: number;
    };
    code?: string;
  };
}

/**
 * Transform a semantic chunk into the payload format
 */
function transformChunk(chunk: SemanticChunk): TransformedChunk {
  // Build document string
  let document: string;
  
  if (chunk.docstring) {
    // If docstring exists, use it as the document
    document = chunk.docstring;
  } else {
    // Build concatenated summary: filepath className functionName chunkType repository module relatedTestCases lines
    const parts: string[] = [chunk.filePath];
    
    if (chunk.className) parts.push(chunk.className);
    if (chunk.functionName) parts.push(chunk.functionName);
    parts.push(chunk.type);
    if (chunk.repository) parts.push(chunk.repository);
    if (chunk.module) parts.push(chunk.module);
    if (chunk.relatedTestCases && chunk.relatedTestCases.length > 0) {
      parts.push(`[${chunk.relatedTestCases.join(',')}]`);
    }
    parts.push(`lines: {start: ${chunk.startLine} end: ${chunk.endLine}}`);
    
    document = parts.join(' ');
  }

  // Build metadata object
  const metadata: TransformedChunk['metadata'] = {
    filepath: chunk.filePath,
    chunkType: chunk.type,
    lines: {
      start: chunk.startLine,
      end: chunk.endLine
    }
  };

  // Add optional fields only if they exist
  if (chunk.className) metadata.className = chunk.className;
  if (chunk.functionName) metadata.functionName = chunk.functionName;
  if (chunk.repository) metadata.repository = chunk.repository;
  if (chunk.module) metadata.module = chunk.module;
  if (chunk.relatedTestCases && chunk.relatedTestCases.length > 0) {
    metadata.relatedTestCases = chunk.relatedTestCases;
  }
  if (chunk.testSuiteName) metadata.testSuiteName = chunk.testSuiteName;
  if (chunk.testName) metadata.testName = chunk.testName;
  if (chunk.code) metadata.code = chunk.code;

  // Build the payload with top-level: document, metadata
  const result: TransformedChunk = {
    document,
    metadata
  };

  return result;
}

/**
 * Save semantic chunks to a JSON file
 * @param chunks - Array of semantic chunks to save
 * @param outputPath - Path where to save the JSON file
 */
export function saveChunksToJson(chunks: SemanticChunk[], outputPath: string): void {
  const outputDir = path.dirname(outputPath);
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Transform chunks to new payload format
  const transformedChunks = chunks.map(transformChunk);

  const jsonData = {
    metadata: {
      timestamp: new Date().toISOString(),
      totalChunks: transformedChunks.length,
      version: '1.0.0'
    },
    chunks: transformedChunks
  };

  fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2), 'utf-8');
  console.log(`\nChunks saved to: ${outputPath}`);
}
