import { Project, SyntaxKind, SourceFile, Node } from 'ts-morph';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SemanticChunk } from './types';

/**
 * Parses a source file and extracts semantic chunks
 */
export class CodeParser {
  private readonly project: Project;
  // Map: className -> array of test file paths that import it
  private pageObjectToTests: Map<string, Set<string>> = new Map();
  // Map: test file path -> array of imported page object classes
  private testToPageObjects: Map<string, Set<string>> = new Map();
  private rootDir: string = '';

  constructor() {
    this.project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        allowJs: true,
        target: 2,
        module: 1,
      },
    });
  }

  /**
   * Analyze imports in test files to build page object relationships
   * This should be called before parseFile for Playwright projects
   * @param testFiles - Array of test file paths
   * @param rootDir - Root directory of the project
   */
  analyzeImports(testFiles: string[], rootDir: string): void {
    this.rootDir = rootDir;
    console.log(`Analyzing imports in ${testFiles.length} test files...`);
    
    for (const testFile of testFiles) {
      try {
        const sourceCode = fs.readFileSync(testFile, 'utf-8');
        this.project.createSourceFile(testFile, sourceCode, { overwrite: true });
        const sourceFile = this.project.getSourceFile(testFile);
        if (sourceFile) {
          this.analyzeImportsForFile(sourceFile, testFile);
        }
      } catch (error) {
        console.error(`Error analyzing imports in ${testFile}:`, error);
      }
    }
    
    console.log(`Found ${this.pageObjectToTests.size} page objects with test relationships`);
  }

  /**
   * Parse a file and extract semantic chunks
   * @param filePath - Path to the file to parse
   * @param includeCode - Whether to include the source code in chunks
   * @param projectType - Project type: 'angular' | 'playwright'
   * @returns Array of semantic chunks
   */
  parseFile(filePath: string, includeCode: boolean = false, projectType: 'angular' | 'playwright' = 'angular'): SemanticChunk[] {
    const sourceCode = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    this.project.createSourceFile(filePath, sourceCode, { overwrite: true });
    const sourceFile = this.project.getSourceFile(filePath);
    if (!sourceFile) return [];

    // Set root directory for relationship tracking
    if (!this.rootDir) {
      this.rootDir = this.findRootDir(filePath);
    }

    // Convert to relative path for storage
    const relativeFilePath = this.getRelativePath(filePath);

    if (projectType === 'playwright') {
      // Check if it's a test file (.spec.ts/.js, .api-spec.ts/.js, .setup.ts/.js, etc.)
      if (fileName.endsWith('.spec.ts') || fileName.endsWith('.spec.js') ||
          fileName.endsWith('.api-spec.ts') || fileName.endsWith('.api-spec.js') ||
          fileName.includes('.setup') || fileName.includes('.setup-')) {
        const chunks = this.extractPlaywrightSpecChunks(sourceFile, relativeFilePath, sourceCode, includeCode);
        // Also extract setup/fixture patterns if no chunks found
        if (chunks.length === 0) {
          return this.extractEdgeCasePatterns(sourceFile, relativeFilePath, sourceCode, includeCode);
        }
        return chunks;
      } else {
        return this.extractPlaywrightPOMChunks(sourceFile, relativeFilePath, sourceCode, includeCode);
      }
    } else {
      return this.extractGenericChunks(sourceFile, relativeFilePath, sourceCode, includeCode);
    }
  }

  /**
   * Convert absolute file path to relative path from rootDir
   */
  private getRelativePath(absolutePath: string): string {
    if (!this.rootDir) {
      return absolutePath;
    }
    return path.relative(this.rootDir, absolutePath);
  }

  private extractPlaywrightPOMChunks(
    sourceFile: SourceFile,
    filePath: string,
    sourceCode: string,
    includeCode: boolean
  ): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    const classes = sourceFile.getClasses();
    
    // If no classes found, check for fixtures/constants or fall back to generic extraction
    if (classes.length === 0) {
      const edgeCaseChunks = this.extractEdgeCasePatterns(sourceFile, filePath, sourceCode, includeCode);
      if (edgeCaseChunks.length > 0) {
        return edgeCaseChunks;
      }
      return this.extractGenericChunks(sourceFile, filePath, sourceCode, includeCode);
    }
    
    const repository = this.extractRepository(filePath);
    const module = this.extractModule(filePath);
    
    for (const cls of classes) {
      const className = cls.getName() || '<anonymous>';
      const relatedTestCases = this.getRelatedTestCases(className);
      
      // Extract locators from properties and constructor
      const locatorChunks = this.extractLocatorsFromClass(cls, filePath, className, repository, module, relatedTestCases, sourceCode, includeCode);
      chunks.push(...locatorChunks);
      
      // Extract simple properties and constructor assignments (like gotoURL)
      const simplePropertyChunks = this.extractSimpleProperties(cls, filePath, className, repository, module, relatedTestCases, sourceCode, includeCode);
      chunks.push(...simplePropertyChunks);
      
      // Extract functions: keep all methods in a single chunk
      const methods = cls.getMethods();
      if (methods.length > 0) {
        const startLine = methods[0].getStartLineNumber();
        const endLine = methods[methods.length - 1].getEndLineNumber();
        const code = includeCode ? methods.map(m => m.getText()).join('\n\n') : undefined;
        const methodNames = methods.map(m => m.getName());
        const chunkType = this.determineChunkType(methodNames, code || '');
        
        chunks.push({
          name: `${className}_actions`,
          type: chunkType,
          filePath,
          className,
          functionName: methodNames.join(', '),
          chunkType,
          repository,
          module,
          relatedTestCases,
          startLine,
          endLine,
          startColumn: methods[0].getStartLinePos(),
          endColumn: getColumnFromPos(sourceCode, methods[methods.length - 1].getEnd()),
          code,
        });
      }
      
      // If no chunks were extracted, create a basic class chunk
      if (chunks.length === 0) {
        const constructor = cls.getConstructors()[0];
        if (constructor) {
          const docstring = this.extractDocstringFromJSDocs(cls.getJsDocs());
          chunks.push({
            name: `${className}_class`,
            type: 'helper',
            filePath,
            className,
            chunkType: 'helper',
            repository,
            module,
            relatedTestCases,
            docstring,
            startLine: cls.getStartLineNumber(),
            endLine: cls.getEndLineNumber(),
            startColumn: cls.getStartLinePos(),
            endColumn: getColumnFromPos(sourceCode, cls.getEnd()),
            code: includeCode ? cls.getText() : undefined,
          });
        }
      }
    }
    return chunks;
  }

  private extractPlaywrightSpecChunks(
    sourceFile: SourceFile,
    filePath: string,
    sourceCode: string,
    includeCode: boolean
  ): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    const repository = this.extractRepository(filePath);
    const module = this.extractModule(filePath);
    
    // Find describe blocks (test suites) - support both test.describe and describe
    const describeCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call => {
      const exprText = call.getExpression().getText();
      return exprText === 'describe' || exprText.includes('test.describe');
    });

    for (const describeCall of describeCalls) {
      const args = describeCall.getArguments();
      if (args.length < 2) continue;

      const suiteName = this.extractStringValue(args[0].getText());
      
      // The callback can be args[1] or args[2] if there's an options object
      // test.describe("name", callback) or test.describe("name", { options }, callback)
      const callback = args.length >= 3 && args[1].getKind() === SyntaxKind.ObjectLiteralExpression
        ? args[2]
        : args[1];

      // Find all test() calls within this describe
      const testCalls = callback.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call => {
        const exprText = call.getExpression().getText();
        return exprText === 'test' || exprText === 'it' || exprText.startsWith('test.only') || exprText.startsWith('it.only');
      });

      for (const testCall of testCalls) {
        const testArgs = testCall.getArguments();
        if (testArgs.length < 2) continue;

        const testName = this.extractStringValue(testArgs[0].getText());
        
        // Skip before/after hooks
        if (/^(before|after)/i.test(testName)) continue;
        
        // Extract docstring from comments above the test
        const docstring = this.extractTestDocstring(testCall) || testName;
        
        // All test cases use 'test' chunk type
        chunks.push({
          name: testName,
          type: 'test',
          filePath,
          testSuiteName: suiteName,
          testName,
          chunkType: 'test',
          repository,
          module,
          docstring,
          startLine: testCall.getStartLineNumber(),
          endLine: testCall.getEndLineNumber(),
          startColumn: testCall.getStartLinePos(),
          endColumn: getColumnFromPos(sourceCode, testCall.getEnd()),
          code: includeCode ? testCall.getText() : undefined,
        });
      }
    }

    // Also extract standalone test() calls not inside describe blocks
    const allTestCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call => {
      const exprText = call.getExpression().getText();
      return exprText === 'test' || exprText === 'it' || exprText.startsWith('test.only') || exprText.startsWith('it.only');
    });

    for (const testCall of allTestCalls) {
      // Skip if this test is already inside a describe block (already processed)
      const ancestors = testCall.getAncestors();
      const isInsideDescribe = ancestors.some(ancestor => {
        if (ancestor.getKind() === SyntaxKind.CallExpression) {
          const exprText = ancestor.asKind(SyntaxKind.CallExpression)?.getExpression().getText() || '';
          return exprText === 'describe' || exprText.includes('test.describe');
        }
        return false;
      });

      if (isInsideDescribe) continue;

      const args = testCall.getArguments();
      if (args.length < 2) continue;

      const testName = this.extractStringValue(args[0].getText());
      if (/^(before|after)/i.test(testName)) continue;

      const docstring = this.extractTestDocstring(testCall) || testName;

      chunks.push({
        name: testName,
        type: 'test',
        filePath,
        testName,
        chunkType: 'test',
        repository,
        module,
        docstring,
        startLine: testCall.getStartLineNumber(),
        endLine: testCall.getEndLineNumber(),
        startColumn: testCall.getStartLinePos(),
        endColumn: getColumnFromPos(sourceCode, testCall.getEnd()),
        code: includeCode ? testCall.getText() : undefined,
      });
    }

    return chunks;
  }

  private extractEdgeCasePatterns(
    sourceFile: SourceFile,
    filePath: string,
    sourceCode: string,
    includeCode: boolean
  ): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    const fileName = path.basename(filePath);

    // 1. Extract setup() calls (Playwright setup files)
    const setupCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call => {
      const expr = call.getExpression();
      return expr.getText() === 'setup' || expr.getText().includes('test.use');
    });

    for (const setupCall of setupCalls) {
      const args = setupCall.getArguments();
      if (args.length >= 1) {
        const testName = args[0].getKind() === SyntaxKind.StringLiteral 
          ? this.extractStringValue(args[0].getText())
          : 'Setup';
        
        chunks.push({
          name: testName,
          type: 'setup',
          filePath,
          startLine: setupCall.getStartLineNumber(),
          endLine: setupCall.getEndLineNumber(),
          startColumn: setupCall.getStartLinePos(),
          endColumn: getColumnFromPos(sourceCode, setupCall.getEnd()),
          code: includeCode ? setupCall.getText() : undefined,
        });
      }
    }

    // 2. Extract test.extend() fixture definitions
    const extendCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call => {
      const expr = call.getExpression();
      return expr.getText().includes('test.extend') || expr.getText().includes('base.extend');
    });

    for (const extendCall of extendCalls) {
      const args = extendCall.getArguments();
      if (args.length > 0 && args[0].getKind() === SyntaxKind.ObjectLiteralExpression) {
        const objLiteral = args[0].asKind(SyntaxKind.ObjectLiteralExpression);
        if (objLiteral) {
          const properties = objLiteral.getProperties();
          for (const prop of properties) {
            if (Node.isPropertyAssignment(prop)) {
              const propName = prop.getName();
              chunks.push({
                name: propName,
                type: 'fixture',
                filePath,
                startLine: prop.getStartLineNumber(),
                endLine: prop.getEndLineNumber(),
                startColumn: prop.getStartLinePos(),
                endColumn: getColumnFromPos(sourceCode, prop.getEnd()),
                code: includeCode ? prop.getText() : undefined,
              });
            }
          }
        }
      }
    }

    // 3. Extract exported constants (objects/arrays)
    const variableStatements = sourceFile.getVariableStatements();
    for (const statement of variableStatements) {
      if (statement.hasExportKeyword()) {
        const declarations = statement.getDeclarations();
        for (const decl of declarations) {
          const initializer = decl.getInitializer();
          if (initializer && 
              (initializer.getKind() === SyntaxKind.ObjectLiteralExpression ||
               initializer.getKind() === SyntaxKind.ArrayLiteralExpression)) {
            chunks.push({
              name: decl.getName(),
              type: 'constant',
              filePath,
              startLine: decl.getStartLineNumber(),
              endLine: decl.getEndLineNumber(),
              startColumn: decl.getStartLinePos(),
              endColumn: getColumnFromPos(sourceCode, decl.getEnd()),
              code: includeCode ? decl.getText() : undefined,
            });
          }
        }
      }
    }

    // 4. Extract IIFEs (Immediately Invoked Function Expressions)
    const iifes = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call => {
      const expr = call.getExpression();
      // Check if it's calling a parenthesized function/arrow function
      if (expr.getKind() === SyntaxKind.ParenthesizedExpression) {
        const inner = expr.asKind(SyntaxKind.ParenthesizedExpression)?.getExpression();
        return inner && (
          inner.getKind() === SyntaxKind.FunctionExpression ||
          inner.getKind() === SyntaxKind.ArrowFunction
        );
      }
      return false;
    });

    for (const iife of iifes) {
      const parent = iife.getParent();
      // Only extract top-level IIFEs
      if (parent?.getKind() === SyntaxKind.ExpressionStatement) {
        chunks.push({
          name: `IIFE in ${fileName}`,
          type: 'iife',
          filePath,
          startLine: iife.getStartLineNumber(),
          endLine: iife.getEndLineNumber(),
          startColumn: iife.getStartLinePos(),
          endColumn: getColumnFromPos(sourceCode, iife.getEnd()),
          code: includeCode ? iife.getText() : undefined,
        });
      }
    }

    // 5. If still no chunks, fallback to generic extraction
    if (chunks.length === 0) {
      return this.extractGenericChunks(sourceFile, filePath, sourceCode, includeCode);
    }

    return chunks;
  }

  private extractGenericChunks(
    sourceFile: SourceFile,
    filePath: string,
    sourceCode: string,
    includeCode: boolean
  ): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    
    // Functions
    for (const func of sourceFile.getFunctions()) {
      const docstring = func.getJsDocs().map(doc => doc.getDescription()).join('\n').trim() || undefined;
      chunks.push({
        name: func.getName() || '<anonymous>',
        type: 'function',
        filePath,
        startLine: func.getStartLineNumber(),
        endLine: func.getEndLineNumber(),
        startColumn: func.getStartLinePos(),
        endColumn: getColumnFromPos(sourceCode, func.getEnd()),
        docstring,
        code: includeCode ? func.getText() : undefined,
      });
    }
    
    // Classes
    for (const cls of sourceFile.getClasses()) {
      const docstring = cls.getJsDocs().map(doc => doc.getDescription()).join('\n').trim() || undefined;
      chunks.push({
        name: cls.getName() || '<anonymous>',
        type: 'class',
        filePath,
        className: cls.getName() || '<anonymous>',
        startLine: cls.getStartLineNumber(),
        endLine: cls.getEndLineNumber(),
        startColumn: cls.getStartLinePos(),
        endColumn: getColumnFromPos(sourceCode, cls.getEnd()),
        docstring,
        code: includeCode ? cls.getText() : undefined,
      });
      
      // Methods
      for (const method of cls.getMethods()) {
        const methodDocstring = method.getJsDocs().map(doc => doc.getDescription()).join('\n').trim() || undefined;
        chunks.push({
          name: method.getName() || '<anonymous>',
          type: method.getName() === 'constructor' ? 'constructor' : 'method',
          filePath,
          className: cls.getName() || '<anonymous>',
          functionName: method.getName() || '<anonymous>',
          startLine: method.getStartLineNumber(),
          endLine: method.getEndLineNumber(),
          startColumn: method.getStartLinePos(),
          endColumn: getColumnFromPos(sourceCode, method.getEnd()),
          docstring: methodDocstring,
          code: includeCode ? method.getText() : undefined,
        });
      }
    }
    
    // Arrow functions (variable declarations)
    for (const variable of sourceFile.getVariableDeclarations()) {
      const initializer = variable.getInitializer();
      if (initializer && initializer.getKind() === SyntaxKind.ArrowFunction) {
        chunks.push({
          name: variable.getName(),
          type: 'arrow_function',
          filePath,
          startLine: variable.getStartLineNumber(),
          endLine: variable.getEndLineNumber(),
          startColumn: variable.getStartLinePos(),
          endColumn: getColumnFromPos(sourceCode, variable.getEnd()),
          code: includeCode ? variable.getText() : undefined,
        });
      }
    }
    return chunks;
  }

  /**
   * Extract repository name from file path
   */
  private extractRepository(filePath: string): string {
    // Try to extract from git repository or use a default
    const parts = filePath.split(path.sep);
    // Look for common repository patterns
    const repoIndex = parts.findIndex(p => p === 'projects' || p === 'repos' || p === 'src');
    if (repoIndex > 0 && parts[repoIndex + 1]) {
      return parts[repoIndex + 1];
    }
    return 'unknown';
  }

  /**
   * Extract module name from file path
   */
  private extractModule(filePath: string): string {
    // Extract module from path structure
    const parts = filePath.split(path.sep);
    const srcIndex = parts.findIndex(p => p === 'src' || p === 'tests' || p === 'page-objects');
    if (srcIndex >= 0 && parts[srcIndex + 1]) {
      return parts[srcIndex + 1];
    }
    // Fallback: use parent directory name
    return path.basename(path.dirname(filePath));
  }

  /**
   * Determine chunk type based on method names and content
   */
  private determineChunkType(methodNames: string[], content: string): 'action' | 'assert' | 'helper' {
    const contentLower = content.toLowerCase();
    const namesLower = methodNames.join(' ').toLowerCase();

    // Check for assertions
    if (contentLower.includes('expect') || contentLower.includes('assert') || 
        namesLower.includes('verify') || namesLower.includes('check') ||
        namesLower.includes('should') || namesLower.includes('assert')) {
      return 'assert';
    }

    // Check for actions - comprehensive keywords from chunk-generator
    if (contentLower.includes('click') || contentLower.includes('fill') || 
        contentLower.includes('goto') || contentLower.includes('.selectoption') ||
        namesLower.includes('click') || namesLower.includes('navigate') || 
        namesLower.includes('select') || namesLower.includes('type') ||
        namesLower.includes('submit') || namesLower.includes('open') ||
        namesLower.includes('close') || namesLower.includes('drag') ||
        namesLower.includes('drop')) {
      return 'action';
    }

    // Default to helper
    return 'helper';
  }

  /**
   * Extract docstring from comments above a test node
   */
  private extractTestDocstring(node: Node): string {
    // Try to get JSDoc comments
    if (Node.isJSDocable(node)) {
      const jsDocs = node.getJsDocs();
      if (jsDocs.length > 0) {
        const descriptions = jsDocs.map(doc => {
          const description = doc.getDescription().trim();
          // Remove @tag lines
          const lines = description.split('\n');
          const commentLines = lines.filter(line => !line.trim().startsWith('@'));
          return commentLines.join('\n').trim();
        });
        return descriptions.filter(d => d.length > 0).join('\n');
      }
    }

    // Try to get leading comments
    const leadingComments = node.getLeadingCommentRanges();
    if (leadingComments.length > 0) {
      const sourceFile = node.getSourceFile();
      return leadingComments
        .map(comment => sourceFile.getFullText().substring(comment.getPos(), comment.getEnd()))
        .join('\n')
        .replace(/\/\*\*?|\*\/|\/\/|\*/g, '')
        .trim();
    }

    return '';
  }

  /**
   * Find root directory for the project
   */
  private findRootDir(filePath: string): string {
    const parts = filePath.split(path.sep);
    const srcIndex = parts.findIndex(p => p === 'src' || p === 'tests' || p === 'page-objects');
    if (srcIndex > 0) {
      return parts.slice(0, srcIndex).join(path.sep);
    }
    return path.dirname(filePath);
  }

  /**
   * Analyze imports in a test file to build relationships with page objects
   */
  private analyzeImportsForFile(sourceFile: SourceFile, testFilePath: string): void {
    const imports = sourceFile.getImportDeclarations();
    const relativeTestPath = this.getRelativePath(testFilePath);

    for (const importDecl of imports) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();

      // Check if it's importing from page-objects
      if (moduleSpecifier.includes('page-objects') || moduleSpecifier.includes('page-object')) {
        const namedImports = importDecl.getNamedImports();

        for (const namedImport of namedImports) {
          const className = namedImport.getName();

          // Add to pageObjectToTests map
          if (!this.pageObjectToTests.has(className)) {
            this.pageObjectToTests.set(className, new Set());
          }
          this.pageObjectToTests.get(className)!.add(relativeTestPath);

          // Add to testToPageObjects map
          if (!this.testToPageObjects.has(relativeTestPath)) {
            this.testToPageObjects.set(relativeTestPath, new Set());
          }
          this.testToPageObjects.get(relativeTestPath)!.add(className);
        }
      }
    }
  }

  /**
   * Get related test cases for a page object class
   */
  private getRelatedTestCases(className: string): string[] {
    const testFiles = this.pageObjectToTests.get(className);
    return testFiles ? Array.from(testFiles) : [];
  }

  /**
   * Extract string value from quotes
   */
  private extractStringValue(text: string): string {
    return text.replace(/^["'`]/g, '').replace(/["'`]$/g, '').trim();
  }

  /**
   * Extract docstring from JSDoc comments (only comments, no tags)
   */
  private extractDocstringFromJSDocs(jsDocs: any[]): string | undefined {
    if (jsDocs.length === 0) return undefined;
    
    const descriptions = jsDocs.map((doc: any) => {
      const description = doc.getDescription().trim();
      const lines = description.split('\n');
      const commentLines = lines.filter((line: string) => !line.trim().startsWith('@'));
      return commentLines.join('\n').trim();
    });
    
    const result = descriptions.filter((d: string) => d.length > 0).join('\n');
    return result || undefined;
  }

  /**
   * Extract simple properties (non-Locator) from class and constructor
   * This includes properties like gotoURL
   */
  private extractSimpleProperties(
    cls: any,
    filePath: string,
    className: string,
    repository: string,
    module: string,
    relatedTestCases: string[],
    sourceCode: string,
    includeCode: boolean
  ): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    const properties = cls.getProperties();
    const constructor = cls.getConstructors()[0];

    // Track which properties we've already processed as locators
    const processedProps = new Set<string>();

    if (constructor) {
      const constructorBody = constructor.getBodyText();
      const constructorStart = constructor.getStartLineNumber();

      // Look for assignments in constructor like: this.gotoURL = '...'
      const assignmentRegex = /this\.(\w+)\s*=\s*([^;]+);/g;
      let match;

      while ((match = assignmentRegex.exec(constructorBody)) !== null) {
        const propName = match[1];
        const propValue = match[2];

        // Skip if it's a locator assignment (handled by extractLocatorsFromClass)
        if (propValue.includes('page.locator') || propValue.includes('page.getBy')) {
          continue;
        }

        // Find the property declaration if it exists
        const prop = properties.find((p: any) => p.getName() === propName);
        
        // Skip if already processed
        if (processedProps.has(propName)) continue;
        processedProps.add(propName);

        const initCode = match[0];
        const beforeInit = constructorBody.substring(0, match.index);
        const linesBeforeInit = (beforeInit.match(/\n/g) || []).length;
        const initLines = (initCode.match(/\n/g) || []).length;

        const propDeclaration = prop ? prop.getText() : `${propName}: any;`;
        const chunkCode = `${propDeclaration}\n\n// Initialization:\n${initCode}`;
        const docstring = prop ? this.extractDocstringFromJSDocs(prop.getJsDocs()) : undefined;

        chunks.push({
          name: propName,
          type: 'helper',
          filePath,
          className,
          functionName: propName,
          chunkType: 'helper',
          repository,
          module,
          relatedTestCases,
          docstring,
          startLine: constructorStart + linesBeforeInit,
          endLine: constructorStart + linesBeforeInit + initLines,
          startColumn: constructor.getStartLinePos(),
          endColumn: getColumnFromPos(sourceCode, constructor.getEnd()),
          code: includeCode ? chunkCode : undefined,
        });
      }
    }

    // Also check for properties with direct initializers (non-Locator)
    for (const prop of properties) {
      const propName = prop.getName();
      if (processedProps.has(propName)) continue;

      const initializer = prop.getInitializer();
      const propType = prop.getType().getText();

      // Skip Locator properties (handled by extractLocatorsFromClass)
      if (propType.includes('Locator')) continue;

      // Only process if it has an initializer or is a simple property
      if (initializer && !initializer.getText().includes('page.locator') && !initializer.getText().includes('page.getBy')) {
        processedProps.add(propName);
        const docstring = this.extractDocstringFromJSDocs(prop.getJsDocs());

        chunks.push({
          name: propName,
          type: 'helper',
          filePath,
          className,
          functionName: propName,
          chunkType: 'helper',
          repository,
          module,
          relatedTestCases,
          docstring,
          startLine: prop.getStartLineNumber(),
          endLine: prop.getEndLineNumber(),
          startColumn: prop.getStartLinePos(),
          endColumn: getColumnFromPos(sourceCode, prop.getEnd()),
          code: includeCode ? prop.getText() : undefined,
        });
      }
    }

    return chunks;
  }

  /**
   * Extract locators from class properties and constructor
   */
  private extractLocatorsFromClass(
    cls: any,
    filePath: string,
    className: string,
    repository: string,
    module: string,
    relatedTestCases: string[],
    sourceCode: string,
    includeCode: boolean
  ): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    const properties = cls.getProperties();
    const constructor = cls.getConstructors()[0];

    // Extract locators from property declarations and constructor initialization
    if (constructor) {
      const constructorBody = constructor.getBodyText();
      const constructorStart = constructor.getStartLineNumber();

      for (const prop of properties) {
        const propName = prop.getName();
        const propType = prop.getType().getText();

        // Only process Locator properties
        if (!propType.includes('Locator')) {
          continue;
        }

        // Find initialization in constructor
        const initRegex = new RegExp(`this\\.${propName}\\s*=([^;]+);`, 's');
        const match = constructorBody.match(initRegex);

        if (match) {
          const propDeclaration = prop.getText();
          const initCode = match[0];

          // Calculate lines for initialization in constructor
          const beforeInit = constructorBody.substring(0, match.index);
          const linesBeforeInit = (beforeInit.match(/\n/g) || []).length;
          const initLines = (initCode.match(/\n/g) || []).length;

          const chunkCode = `${propDeclaration}\n\n// Initialization:\n${initCode}`;
          const docstring = this.extractDocstringFromJSDocs(prop.getJsDocs());

          chunks.push({
            name: propName,
            type: 'locator',
            filePath,
            className,
            functionName: propName,
            chunkType: 'locator',
            repository,
            module,
            relatedTestCases,
            docstring,
            startLine: constructorStart + linesBeforeInit,
            endLine: constructorStart + linesBeforeInit + initLines,
            startColumn: prop.getStartLinePos(),
            endColumn: getColumnFromPos(sourceCode, prop.getEnd()),
            code: includeCode ? chunkCode : undefined,
          });
        } else {
          // Fallback to property initializer if not in constructor
          const initializer = prop.getInitializer();
          if (initializer?.getText().includes('page.locator') || initializer?.getText().includes('page.getByRole')) {
            const docstring = this.extractDocstringFromJSDocs(prop.getJsDocs());

            chunks.push({
              name: propName,
              type: 'locator',
              filePath,
              className,
              functionName: propName,
              chunkType: 'locator',
              repository,
              module,
              relatedTestCases,
              docstring,
              startLine: prop.getStartLineNumber(),
              endLine: prop.getEndLineNumber(),
              startColumn: prop.getStartLinePos(),
              endColumn: getColumnFromPos(sourceCode, prop.getEnd()),
              code: includeCode ? prop.getText() : undefined,
            });
          }
        }
      }
    } else {
      // If no constructor, fallback to property initializers
      for (const prop of properties) {
        const initializer = prop.getInitializer();
        if (initializer?.getText().includes('page.locator') || initializer?.getText().includes('page.getByRole')) {
          const docstring = this.extractDocstringFromJSDocs(prop.getJsDocs());

          chunks.push({
            name: prop.getName(),
            type: 'locator',
            filePath,
            className,
            functionName: prop.getName(),
            chunkType: 'locator',
            repository,
            module,
            relatedTestCases,
            docstring,
            startLine: prop.getStartLineNumber(),
            endLine: prop.getEndLineNumber(),
            startColumn: prop.getStartLinePos(),
            endColumn: getColumnFromPos(sourceCode, prop.getEnd()),
            code: includeCode ? prop.getText() : undefined,
          });
        }
      }
    }

    return chunks;
  }
}

// Helper to get column from position in source code
function getColumnFromPos(source: string, pos: number): number {
  const lastNewline = source.lastIndexOf('\n', pos - 1);
  return pos - lastNewline - 1;
}

