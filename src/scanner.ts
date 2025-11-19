import * as fs from 'fs';
import * as path from 'path';

/**
 * Recursively scans a directory for JavaScript and TypeScript files
 * @param dirPath - The directory path to scan
 * @param extensions - File extensions to include
 * @returns Array of file paths
 */
export function scanDirectory(
  dirPath: string,
  extensions: string[] = ['.js', '.ts', '.tsx']
): string[] {
  const files: string[] = [];

  function scan(currentPath: string): void {
    const stats = fs.statSync(currentPath);

    if (stats.isDirectory()) {
      // Skip node_modules and hidden directories
      const basename = path.basename(currentPath);
      if (basename === 'node_modules' || basename.startsWith('.')) {
        return;
      }

      const entries = fs.readdirSync(currentPath);
      for (const entry of entries) {
        scan(path.join(currentPath, entry));
      }
    } else if (stats.isFile()) {
      const ext = path.extname(currentPath);
      if (extensions.includes(ext)) {
        files.push(currentPath);
      }
    }
  }

  scan(dirPath);
  return files;
}
