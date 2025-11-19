# Quick Start Guide

## Installation

1. Clone the repository:
```bash
git clone https://github.com/oscarlimonmw/SemanticCodeIndexer.git
cd SemanticCodeIndexer
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Basic Usage

### Index a directory
```bash
node dist/cli.js --path /path/to/your/project
```

This will scan all `.js`, `.ts`, and `.tsx` files in the directory and create a `semantic-chunks.json` file.

### Index a specific subdirectory
```bash
node dist/cli.js --path /path/to/project --target src/components
```

### Specify output file
```bash
node dist/cli.js --path ./myproject --output myproject-chunks.json
```

### Include source code in output
```bash
node dist/cli.js --path ./src --include-code
```

## Understanding the Output

The output JSON contains:
- **metadata**: Timestamp, total chunks count, and version
- **chunks**: Array of semantic chunks with:
  - `name`: Function/class/method name
  - `type`: One of: function, arrow_function, class, method, constructor
  - `filePath`: Absolute path to the source file
  - `startLine`, `endLine`: Line numbers in the source
  - `startColumn`, `endColumn`: Column positions
  - `code`: Source code (if --include-code was used)

## Example Output Structure

```json
{
  "metadata": {
    "timestamp": "2025-11-19T22:30:00.000Z",
    "totalChunks": 42,
    "version": "1.0.0"
  },
  "chunks": [
    {
      "name": "myFunction",
      "type": "function",
      "filePath": "/absolute/path/to/file.js",
      "startLine": 10,
      "endLine": 15,
      "startColumn": 0,
      "endColumn": 1
    }
  ]
}
```

## Try the Examples

Run the indexer on the included examples:
```bash
node dist/cli.js --path ./examples/sample-project
```

View the results:
```bash
cat semantic-chunks.json
```

## Next Steps

The JSON output is designed to be used as input for:
- Vector embedding generation
- Code search systems
- Documentation generators
- Code analysis tools
- AI/ML training data

The modular architecture makes it easy to extend with additional features like:
- Custom chunk types
- Additional metadata extraction
- Different output formats
- Integration with vector databases
