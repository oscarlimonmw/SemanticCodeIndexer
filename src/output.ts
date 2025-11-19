import * as fs from 'fs';
import * as path from 'path';
import { SemanticChunk } from './types';

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

  const jsonData = {
    metadata: {
      timestamp: new Date().toISOString(),
      totalChunks: chunks.length,
      version: '1.0.0'
    },
    chunks
  };

  fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2), 'utf-8');
  console.log(`\nChunks saved to: ${outputPath}`);
}
