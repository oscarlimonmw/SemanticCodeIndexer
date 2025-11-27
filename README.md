# SemanticCodeIndexer


A semantic code indexer that parses JavaScript and TypeScript files using ts-morph to extract semantic chunks (functions, classes, methods, Playwright Page Objects, and tests) with rich metadata.

## Features

- 🔍 Scans directories for `.js`, `.ts`, and `.tsx` files
- 🌳 Uses **ts-morph** for accurate TypeScript/JavaScript AST parsing
- 📦 Extracts **14 chunk types**: functions, classes, methods, constructors, arrow functions, tests, locators, actions, asserts, helpers, setup, fixtures, constants, and IIFEs
- 📊 Collects rich metadata: name, type, **relative file paths**, line numbers, column positions, and relationships
- 💾 Saves results in structured JSON format with **portable relative paths**
- 🎯 Supports Playwright and Angular project types with specialized extraction
- 🎭 **Playwright**: Comprehensive support for Page Object Models, test files, fixtures, and setup patterns
- 🔗 **Relationship tracking**: Links Page Objects to their test files
- ⚡ **Two-pass analysis**: Builds complete relationship graphs for Playwright projects
- 🔧 Modular structure ready for vectorization and custom chunking rules

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
- `--project-type <type>` (optional): Project type, either `angular` or `playwright` (default: `angular`)

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
      "document": "src/utils/file.js functionName function lines: {start: 10 end: 15}",
      "metadata": {
        "filepath": "src/utils/file.js",
        "chunkType": "function",
        "lines": {
          "start": 10,
          "end": 15
        },
        "functionName": "functionName",
        "code": "optional source code"
      }
    }
  ]
}
```

**Note:** All file paths are **relative** to the project root for portability across environments. Each chunk includes a `document` field (text representation for embedding/search) and a `metadata` object with all chunk properties including nested `lines` and optional `code`.

### Chunk Types

#### Core Types
- `function`: Regular function declarations
- `arrow_function`: Arrow function expressions
- `class`: Class declarations
- `method`: Class methods
- `constructor`: Class constructors

#### Playwright-Specific Types
- `test`: Test cases from `test()` or `it()` calls (standalone and in describe blocks)
- `locator`: Page Object Model locators
- `action`: Page Object action methods
- `assert`: Assertion and expectation helpers
- `helper`: Utility functions and helper methods
- `setup`: Setup functions from `setup()` or `test.use()` calls
- `fixture`: Fixture definitions from `test.extend()`

#### Configuration Types
- `constant`: Exported configuration objects/arrays
- `iife`: Immediately Invoked Function Expressions

### Playwright Support

When using `--project-type playwright`, the indexer provides comprehensive extraction:

#### Test Files (`.spec.ts`, `.spec.js`, `.api-spec.ts`, `.api-spec.js`)
- **Test cases**: Extracts both standalone `test()` calls and tests within `test.describe()` blocks
- **Describe blocks with options**: Handles `test.describe("name", { tag: ["@smoke"] }, callback)` pattern
- **Setup files**: Extracts `setup()` and `test.use()` configurations from `.setup.ts` files
- **Metadata includes**: `testSuiteName`, `testName`, `repository`, `module`, `docstring`

#### Page Object Model Files
- **Locators**: Extracts locator definitions from class properties and constructor
- **Actions**: Groups related methods as action chunks
- **Simple properties**: Captures non-locator properties (e.g., `gotoURL`)
- **Relationships**: Tracks which test files import each Page Object
- **Metadata includes**: `className`, `functionName`, `relatedTestCases`, `repository`, `module`

#### Edge Case Patterns
- **Fixture definitions**: Extracts individual fixtures from `test.extend()` calls
- **Constants**: Captures exported configuration objects and arrays
- **IIFEs**: Extracts Immediately Invoked Function Expressions from utility scripts
- **Utility files**: Falls back to generic extraction for files without classes

#### Two-Pass Analysis
The indexer performs a two-pass analysis:
1. **First pass**: Analyzes imports to build Page Object ↔ Test relationships
2. **Second pass**: Extracts chunks with full relationship metadata

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
- 🧪 Advanced Playwright and Angular chunking

## License

ISC
