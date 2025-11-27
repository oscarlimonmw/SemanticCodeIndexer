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
You can also specify the project type for Playwright or Angular chunking:

```bash
node dist/cli.js --path /path/to/your/project --project-type playwright
```

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
- **chunks**: Array of transformed semantic chunks, each with:
  - `document`: Text representation of the chunk for embedding/search
  - `metadata`: Object containing all chunk properties:
    - `filepath`: **Relative path** from project root to the source file
    - `chunkType`: One of: function, arrow_function, class, method, constructor, locator, action, assert, helper, test, setup, fixture, constant, iife
    - `lines`: Object with `start` and `end` line numbers
    - `code`: Source code (optional, if --include-code was used)
    - For Playwright projects, additional context:
      - `className`, `functionName`, `repository`, `module`, `relatedTestCases`, `docstring`, `testSuiteName`, `testName`

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
      "document": "src/utils/file.js myFunction function lines: {start: 10 end: 15}",
      "metadata": {
        "filepath": "src/utils/file.js",
        "chunkType": "function",
        "lines": {
          "start": 10,
          "end": 15
        },
        "functionName": "myFunction",
        "code": "function myFunction() { ... }"
      }
    }
  ]
}
```

## Chunk Types Explained

### Core Types
- **function**: Regular function declarations
- **arrow_function**: Arrow function expressions  
- **class**: Class declarations
- **method**: Class methods
- **constructor**: Class constructors

### Playwright-Specific Types
- **test**: Test cases from `test()` calls (both in describe blocks and standalone)
- **locator**: Page Object Model locators (e.g., `page.locator()`, `this.page.getByRole()`)
- **action**: Page Object actions (methods that interact with the page)
- **assert**: Assertion and expectation helpers
- **helper**: Utility functions and helper methods
- **setup**: Setup functions from `setup()` or `test.use()` calls
- **fixture**: Fixture definitions from `test.extend()`

### Configuration Types
- **constant**: Exported constant objects/arrays (configuration data)
- **iife**: Immediately Invoked Function Expressions (script utilities)
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
- Playwright and Angular chunking support
- Different output formats
- Integration with vector databases
