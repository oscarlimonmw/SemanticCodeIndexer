# SemanticCodeIndexer

A semantic code indexer that parses JavaScript and TypeScript files using Tree-sitter to extract semantic chunks (functions, classes, methods) with metadata.

## Features

- 🔍 Scans directories for `.js`, `.ts`, and `.tsx` files
- 🌳 Uses Tree-sitter for accurate AST parsing
- 📦 Extracts semantic chunks: functions, classes, methods, constructors, and arrow functions
- 📊 Collects metadata: name, type, file path, line numbers, and column positions
- 💾 Saves results in structured JSON format
- 🎯 Supports optional subdirectory targeting
- 🔧 Modular structure ready for future vectorization

## Installation

```bash
npm install
npm run build
```

## Usage

### Command Line Interface

```bash
node dist/cli.js --path <directory> [options]
```

### Options

- `--path <path>` (required): Base directory path to scan
- `--target <subdirectory>` (optional): Subdirectory within base path to scan
- `--output <file>` (optional): Output JSON file path (default: `semantic-chunks.json`)
- `--include-code` (optional): Include source code snippets in the output

### Examples

Scan a directory:
```bash
node dist/cli.js --path ./src
```

Scan a specific subdirectory:
```bash
node dist/cli.js --path ./project --target src/utils
```

Include source code in output:
```bash
node dist/cli.js --path ./src --include-code --output chunks-with-code.json
```

## Output Format

The tool generates a JSON file with the following structure:

```json
{
  "metadata": {
    "timestamp": "2025-11-19T22:30:00.000Z",
    "totalChunks": 42,
    "version": "1.0.0"
  },
  "chunks": [
    {
      "name": "functionName",
      "type": "function",
      "filePath": "/path/to/file.js",
      "startLine": 10,
      "endLine": 15,
      "startColumn": 0,
      "endColumn": 1,
      "code": "optional source code"
    }
  ]
}
```

### Chunk Types

- `function`: Regular function declarations
- `arrow_function`: Arrow function expressions
- `class`: Class declarations
- `method`: Class methods
- `constructor`: Class constructors

## Programmatic Usage

```typescript
import { SemanticCodeIndexer } from './src/indexer';
import { saveChunksToJson } from './src/output';

const indexer = new SemanticCodeIndexer();
const chunks = indexer.index({
  path: '/path/to/project',
  target: 'src',
  includeCode: false
});

saveChunksToJson(chunks, 'output.json');
```

## Project Structure

```
SemanticCodeIndexer/
├── src/
│   ├── cli.ts          # Command-line interface
│   ├── indexer.ts      # Main indexer coordinator
│   ├── parser.ts       # Tree-sitter parser wrapper
│   ├── scanner.ts      # File system scanner
│   ├── output.ts       # JSON output handler
│   ├── types.ts        # TypeScript type definitions
│   └── index.ts        # Public API exports
├── dist/               # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
└── README.md
```

## Future Enhancements

The modular architecture is designed to support future enhancements:

- 🔮 Vector embeddings for semantic search
- 🗄️ Database integration for large codebases
- 🔌 Plugin system for custom extractors
- 📈 Code complexity metrics
- 🔗 Cross-reference analysis

## License

ISC
