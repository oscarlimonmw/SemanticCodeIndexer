#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import { SemanticCodeIndexer } from './indexer';
import { saveChunksToJson } from './output';

const program = new Command();


program
  .name('semantic-indexer')
  .description('A semantic code indexer that parses JavaScript/TypeScript files using ts-morph')
  .version('1.0.0')
  .requiredOption('--path <path>', 'Base directory path to scan')
  .option('--target <target>', 'Optional subdirectory within base path')
  .option('--output <output>', 'Output JSON file path', 'semantic-chunks.json')
  .option('--include-code', 'Include source code in the output chunks', false)
  .option('--project-type <type>', 'Project type: angular or playwright', 'angular')
  .action((options) => {
    try {
      const basePath = path.resolve(options.path);
      const outputPath = path.resolve(options.output);

      console.log('=== Semantic Code Indexer ===');
      console.log(`Base path: ${basePath}`);
      if (options.target) {
        console.log(`Target subdirectory: ${options.target}`);
      }
      console.log(`Output file: ${outputPath}`);
      console.log(`Include code: ${options.includeCode}`);
      console.log(`Project type: ${options.projectType}`);
      console.log('');

      const indexer = new SemanticCodeIndexer();
      const chunks = indexer.index({
        path: basePath,
        target: options.target,
        includeCode: options.includeCode,
        projectType: options.projectType
      });

      saveChunksToJson(chunks, outputPath);

      console.log('\n=== Indexing Complete ===');
      console.log(`Summary by type:`);
      
      const summary = new Map<string, number>();
      chunks.forEach(chunk => {
        summary.set(chunk.type, (summary.get(chunk.type) || 0) + 1);
      });

      summary.forEach((count, type) => {
        console.log(`  ${type}: ${count}`);
      });

    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program.parse();
