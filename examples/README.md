# Examples

This directory contains example projects to demonstrate the SemanticCodeIndexer functionality.

## Sample Project

The `sample-project` directory contains example JavaScript and TypeScript files with various code patterns:

- `auth.js` - Authentication service with classes and methods
- `repository.ts` - Generic repository pattern with TypeScript

## Running the Example

From the project root:

```bash
# Index the sample project
node dist/cli.js --path ./examples/sample-project --output examples/output.json

# View the results
cat examples/output.json
```

## Output

The `output.json` file contains the extracted semantic chunks with metadata for all functions, classes, and methods found in the sample project.
