import * as path from 'path';
import { scanDirectory } from './scanner';
import { CodeParser } from './parser';
import { SemanticChunk, IndexerOptions } from './types';

/**
 * Main indexer class that coordinates scanning, parsing, and indexing
 */
export class SemanticCodeIndexer {
  private parser: CodeParser;

  constructor() {
    this.parser = new CodeParser();
  }

  /**
   * Index a directory and extract semantic chunks
   * @param options - Indexer options
   * @returns Array of semantic chunks
   */
  index(options: IndexerOptions): SemanticChunk[] {
    const { path: basePath, target, includeCode = false } = options;

    // Determine the directory to scan
    const scanPath = target ? path.join(basePath, target) : basePath;

    console.log(`Scanning directory: ${scanPath}`);

    // Scan for files
    const files = scanDirectory(scanPath);
    console.log(`Found ${files.length} files to process`);

    // Parse files and extract chunks
    const allChunks: SemanticChunk[] = [];

    for (const file of files) {
      try {
        console.log(`Processing: ${file}`);
        const chunks = this.parser.parseFile(file, includeCode);
        allChunks.push(...chunks);
        console.log(`  Extracted ${chunks.length} chunks`);
      } catch (error) {
        console.error(`Error processing ${file}:`, error);
      }
    }

    console.log(`\nTotal chunks extracted: ${allChunks.length}`);

    return allChunks;
  }
}
