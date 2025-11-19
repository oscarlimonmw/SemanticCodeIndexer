import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import * as fs from 'fs';
import * as path from 'path';
import { SemanticChunk } from './types';

/**
 * Parses a source file and extracts semantic chunks
 */
export class CodeParser {
  private jsParser: Parser;
  private tsParser: Parser;
  private tsxParser: Parser;

  constructor() {
    // Initialize JavaScript parser
    this.jsParser = new Parser();
    this.jsParser.setLanguage(JavaScript as any);

    // Initialize TypeScript parser
    this.tsParser = new Parser();
    this.tsParser.setLanguage(TypeScript.typescript as any);

    // Initialize TSX parser
    this.tsxParser = new Parser();
    this.tsxParser.setLanguage(TypeScript.tsx as any);
  }

  /**
   * Parse a file and extract semantic chunks
   * @param filePath - Path to the file to parse
   * @param includeCode - Whether to include the source code in chunks
   * @returns Array of semantic chunks
   */
  parseFile(filePath: string, includeCode: boolean = false): SemanticChunk[] {
    const sourceCode = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath);

    let parser: Parser;
    if (ext === '.ts') {
      parser = this.tsParser;
    } else if (ext === '.tsx') {
      parser = this.tsxParser;
    } else {
      parser = this.jsParser;
    }

    const tree = parser.parse(sourceCode);
    const chunks: SemanticChunk[] = [];

    this.extractChunks(tree.rootNode, filePath, sourceCode, chunks, includeCode);

    return chunks;
  }

  /**
   * Recursively extract semantic chunks from AST nodes
   */
  private extractChunks(
    node: Parser.SyntaxNode,
    filePath: string,
    sourceCode: string,
    chunks: SemanticChunk[],
    includeCode: boolean
  ): void {
    // Check if this node is a semantic chunk we care about
    const chunk = this.createChunkFromNode(node, filePath, sourceCode, includeCode);
    if (chunk) {
      chunks.push(chunk);
    }

    // Recursively process children
    for (const child of node.children) {
      this.extractChunks(child, filePath, sourceCode, chunks, includeCode);
    }
  }

  /**
   * Create a semantic chunk from an AST node if applicable
   */
  private createChunkFromNode(
    node: Parser.SyntaxNode,
    filePath: string,
    sourceCode: string,
    includeCode: boolean
  ): SemanticChunk | null {
    let chunkType: SemanticChunk['type'] | null = null;
    let name: string | null = null;

    switch (node.type) {
      case 'function_declaration':
      case 'function':
        chunkType = 'function';
        name = this.getFunctionName(node);
        break;
      case 'arrow_function':
        chunkType = 'arrow_function';
        name = this.getArrowFunctionName(node);
        break;
      case 'class_declaration':
      case 'class':
        chunkType = 'class';
        name = this.getClassName(node);
        break;
      case 'method_definition':
        chunkType = node.childForFieldName('name')?.text === 'constructor' ? 'constructor' : 'method';
        name = this.getMethodName(node);
        break;
    }

    if (chunkType && name) {
      const chunk: SemanticChunk = {
        name,
        type: chunkType,
        filePath,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        startColumn: node.startPosition.column,
        endColumn: node.endPosition.column,
      };

      if (includeCode) {
        chunk.code = sourceCode.substring(node.startIndex, node.endIndex);
      }

      return chunk;
    }

    return null;
  }

  /**
   * Extract function name from function node
   */
  private getFunctionName(node: Parser.SyntaxNode): string {
    const nameNode = node.childForFieldName('name');
    return nameNode?.text || '<anonymous>';
  }

  /**
   * Extract arrow function name (from parent variable declarator if available)
   */
  private getArrowFunctionName(node: Parser.SyntaxNode): string {
    // Try to get name from parent variable declarator
    let parent = node.parent;
    while (parent) {
      if (parent.type === 'variable_declarator') {
        const nameNode = parent.childForFieldName('name');
        if (nameNode) {
          return nameNode.text;
        }
      }
      if (parent.type === 'pair') {
        const keyNode = parent.childForFieldName('key');
        if (keyNode) {
          return keyNode.text;
        }
      }
      parent = parent.parent;
    }
    return '<anonymous>';
  }

  /**
   * Extract class name from class node
   */
  private getClassName(node: Parser.SyntaxNode): string {
    const nameNode = node.childForFieldName('name');
    return nameNode?.text || '<anonymous>';
  }

  /**
   * Extract method name from method node
   */
  private getMethodName(node: Parser.SyntaxNode): string {
    const nameNode = node.childForFieldName('name');
    return nameNode?.text || '<anonymous>';
  }
}
