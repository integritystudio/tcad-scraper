#!/usr/bin/env tsx

/**
 * Import Path Validator
 *
 * Validates that all import statements in TypeScript/JavaScript files
 * resolve to actual files in the project.
 *
 * Usage: tsx scripts/test-import-paths.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";

interface ImportIssue {
	file: string;
	line: number;
	importPath: string;
	resolvedPath: string;
	reason: string;
}

const EXTENSIONS = [
	".ts",
	".tsx",
	".js",
	".jsx",
	".json",
	".css",
	".module.css",
];
const IGNORE_PATTERNS = [
	/node_modules/,
	/\.git/,
	/dist/,
	/build/,
	/.next/,
	/coverage/,
	/.vite/,
];

// Packages that are external dependencies (not local files)
const _EXTERNAL_PACKAGES = [
	"react",
	"react-dom",
	"react-router-dom",
	"express",
	"prisma",
	"@prisma/client",
	"bullmq",
	"playwright",
	"zod",
	"winston",
	"dotenv",
	"cors",
	"helmet",
	"pino",
	"vite",
];

const issues: ImportIssue[] = [];
let filesScanned = 0;
let importsChecked = 0;

/**
 * Check if a path should be ignored
 */
function shouldIgnore(filePath: string): boolean {
	return IGNORE_PATTERNS.some((pattern) => pattern.test(filePath));
}

/**
 * Get all TypeScript/JavaScript files recursively
 */
function getFiles(dir: string, files: string[] = []): string[] {
	if (shouldIgnore(dir)) return files;

	try {
		const entries = fs.readdirSync(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);

			if (shouldIgnore(fullPath)) continue;

			if (entry.isDirectory()) {
				getFiles(fullPath, files);
			} else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
				files.push(fullPath);
			}
		}
	} catch (_error) {
		// Skip directories we can't read
	}

	return files;
}

/**
 * Extract import statements from a file
 */
function extractImports(
	_filePath: string,
	content: string,
): Array<{ path: string; line: number }> {
	const imports: Array<{ path: string; line: number }> = [];
	const lines = content.split("\n");

	lines.forEach((line, index) => {
		// Skip comment lines
		const trimmed = line.trim();
		if (
			trimmed.startsWith("//") ||
			trimmed.startsWith("*") ||
			trimmed.startsWith("/*")
		) {
			return;
		}

		// Match ES6 imports: import ... from 'path'
		const es6Match = line.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/);
		if (es6Match) {
			imports.push({ path: es6Match[1], line: index + 1 });
		}

		// Match require statements: require('path')
		const requireMatch = line.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
		if (requireMatch) {
			imports.push({ path: requireMatch[1], line: index + 1 });
		}
	});

	return imports;
}

/**
 * Check if an import is an external package
 */
function isExternalPackage(importPath: string): boolean {
	// Check if it's a node built-in
	if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
		return true;
	}
	return false;
}

/**
 * Resolve an import path to an actual file
 */
function resolveImport(
	fromFile: string,
	importPath: string,
): { exists: boolean; resolvedPath: string; reason?: string } {
	// Skip external packages
	if (isExternalPackage(importPath)) {
		return { exists: true, resolvedPath: importPath };
	}

	const fromDir = path.dirname(fromFile);

	// Handle relative imports
	if (importPath.startsWith(".")) {
		const basePath = path.resolve(fromDir, importPath);

		// Check if the path exists as-is (for directories with index files)
		if (fs.existsSync(basePath)) {
			const stat = fs.statSync(basePath);
			if (stat.isDirectory()) {
				// Check for index files
				for (const ext of EXTENSIONS) {
					const indexPath = path.join(basePath, `index${ext}`);
					if (fs.existsSync(indexPath)) {
						return { exists: true, resolvedPath: indexPath };
					}
				}
				return {
					exists: false,
					resolvedPath: basePath,
					reason: "Directory has no index file",
				};
			}
			return { exists: true, resolvedPath: basePath };
		}

		// Try adding extensions
		for (const ext of EXTENSIONS) {
			const pathWithExt = `${basePath}${ext}`;
			if (fs.existsSync(pathWithExt)) {
				return { exists: true, resolvedPath: pathWithExt };
			}
		}

		return { exists: false, resolvedPath: basePath, reason: "File not found" };
	}

	// Handle absolute imports (from project root)
	if (importPath.startsWith("/")) {
		const projectRoot = process.cwd();
		const absolutePath = path.join(projectRoot, importPath);

		if (fs.existsSync(absolutePath)) {
			return { exists: true, resolvedPath: absolutePath };
		}

		for (const ext of EXTENSIONS) {
			const pathWithExt = `${absolutePath}${ext}`;
			if (fs.existsSync(pathWithExt)) {
				return { exists: true, resolvedPath: pathWithExt };
			}
		}

		return {
			exists: false,
			resolvedPath: absolutePath,
			reason: "File not found",
		};
	}

	return {
		exists: true,
		resolvedPath: importPath,
		reason: "Assumed external package",
	};
}

/**
 * Validate imports in a file
 */
function validateFile(filePath: string): void {
	filesScanned++;

	try {
		const content = fs.readFileSync(filePath, "utf-8");
		const imports = extractImports(filePath, content);

		for (const { path: importPath, line } of imports) {
			importsChecked++;

			const result = resolveImport(filePath, importPath);

			if (!result.exists) {
				issues.push({
					file: filePath.replace(process.cwd(), "."),
					line,
					importPath,
					resolvedPath: result.resolvedPath.replace(process.cwd(), "."),
					reason: result.reason || "Unknown",
				});
			}
		}
	} catch (error) {
		console.error(`Error processing ${filePath}:`, error);
	}
}

/**
 * Main execution
 */
function main() {
	console.log("🔍 Scanning project for import path issues...\n");

	const projectRoot = process.cwd();

	// Scan src directory (frontend)
	const srcFiles = getFiles(path.join(projectRoot, "src"));

	// Scan server directory (backend)
	const serverFiles = getFiles(path.join(projectRoot, "server", "src"));

	const allFiles = [...srcFiles, ...serverFiles];

	console.log(`📁 Found ${allFiles.length} files to check\n`);

	// Validate all files
	allFiles.forEach(validateFile);

	// Report results
	console.log(`\n${"=".repeat(80)}`);
	console.log("📊 RESULTS");
	console.log("=".repeat(80));
	console.log(`Files scanned: ${filesScanned}`);
	console.log(`Imports checked: ${importsChecked}`);
	console.log(`Issues found: ${issues.length}`);
	console.log(`${"=".repeat(80)}\n`);

	if (issues.length === 0) {
		console.log("✅ All import paths are valid!\n");
		process.exit(0);
	}

	console.log("❌ Found import path issues:\n");

	// Group issues by file
	const issuesByFile = new Map<string, ImportIssue[]>();
	issues.forEach((issue) => {
		if (!issuesByFile.has(issue.file)) {
			issuesByFile.set(issue.file, []);
		}
		issuesByFile.get(issue.file)?.push(issue);
	});

	// Print issues
	issuesByFile.forEach((fileIssues, file) => {
		console.log(`\n📄 ${file}`);
		fileIssues.forEach((issue) => {
			console.log(`   Line ${issue.line}: "${issue.importPath}"`);
			console.log(`   → Resolved to: ${issue.resolvedPath}`);
			console.log(`   → Reason: ${issue.reason}`);
		});
	});

	console.log(`\n${"=".repeat(80)}`);
	console.log(
		`\n❌ Test failed: ${issues.length} import path issue(s) found\n`,
	);
	process.exit(1);
}

// Run the validator
main();
