/**
 * Code Complexity Analyzer Service
 *
 * Analyzes TypeScript/JavaScript codebase for complexity metrics
 * Updates Prometheus metrics with code quality indicators
 *
 * Features:
 * - Cyclomatic complexity calculation
 * - Lines of code counting (total, code, comments)
 * - File and function size tracking
 * - Class and function counting
 * - Maintainability index calculation
 *
 * Usage:
 * - Run periodically via cron job (e.g., hourly or daily)
 * - Provides early warning for code quality degradation
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { glob } from "glob";
import logger from "../lib/logger";
import {
	type CodeComplexityMetrics,
	updateCodeComplexityMetrics,
} from "../lib/metrics.service";

// ============================================================================
// Configuration
// ============================================================================

interface AnalyzerConfig {
	/** Root directory to analyze (default: server/src) */
	rootDir: string;
	/** File patterns to include */
	include: string[];
	/** File patterns to exclude */
	exclude: string[];
	/** Update interval in milliseconds */
	updateIntervalMs: number;
}

const DEFAULT_CONFIG: AnalyzerConfig = {
	rootDir: path.join(__dirname, ".."),
	include: ["**/*.ts", "**/*.js"],
	exclude: [
		"**/node_modules/**",
		"**/dist/**",
		"**/*.test.ts",
		"**/*.test.js",
		"**/*.spec.ts",
		"**/*.spec.js",
	],
	updateIntervalMs: 3600000, // 1 hour
};

// ============================================================================
// Complexity Analysis
// ============================================================================

interface FileMetrics {
	file: string;
	totalLines: number;
	codeLines: number;
	commentLines: number;
	blankLines: number;
	functions: number;
	classes: number;
	maxFunctionLines: number;
	avgCyclomatic: number;
	maxCyclomatic: number;
}

/**
 * Analyze a single file for complexity metrics
 */
async function analyzeFile(filePath: string): Promise<FileMetrics> {
	const content = await fs.readFile(filePath, "utf-8");
	const lines = content.split("\n");

	let codeLines = 0;
	let commentLines = 0;
	let blankLines = 0;
	let inBlockComment = false;

	// Count line types
	for (const line of lines) {
		const trimmed = line.trim();

		if (trimmed === "") {
			blankLines++;
		} else if (trimmed.startsWith("//")) {
			commentLines++;
		} else if (trimmed.startsWith("/*") || trimmed.startsWith("*")) {
			commentLines++;
			if (trimmed.startsWith("/*")) {
				inBlockComment = true;
			}
			if (trimmed.endsWith("*/")) {
				inBlockComment = false;
			}
		} else if (inBlockComment) {
			commentLines++;
			if (trimmed.endsWith("*/")) {
				inBlockComment = false;
			}
		} else {
			codeLines++;
		}
	}

	// Count functions (simple regex-based approach)
	const functionMatches =
		content.match(/\bfunction\s+\w+|=>\s*{|\basync\s+function/g) || [];
	const functions = functionMatches.length;

	// Count classes
	const classMatches = content.match(/\bclass\s+\w+/g) || [];
	const classes = classMatches.length;

	// Calculate cyclomatic complexity (simplified)
	const cyclomaticComplexity = calculateCyclomaticComplexity(content);

	// Calculate max function lines (simplified - estimate based on braces)
	const maxFunctionLines = estimateMaxFunctionLines(content);

	return {
		file: filePath,
		totalLines: lines.length,
		codeLines,
		commentLines,
		blankLines,
		functions,
		classes,
		maxFunctionLines,
		avgCyclomatic: cyclomaticComplexity.avg,
		maxCyclomatic: cyclomaticComplexity.max,
	};
}

/**
 * Calculate cyclomatic complexity (simplified)
 * Counts decision points: if, else, for, while, case, catch, &&, ||, ?
 */
function calculateCyclomaticComplexity(content: string): {
	avg: number;
	max: number;
} {
	// Split into functions (simplified)
	const functionBodies = content.split(/\bfunction\s+\w+|=>\s*{/);

	const complexities: number[] = [];

	for (const body of functionBodies) {
		if (body.trim().length === 0) continue;

		// Count decision points
		const ifCount = (body.match(/\bif\s*\(/g) || []).length;
		const elseCount = (body.match(/\belse\b/g) || []).length;
		const forCount = (body.match(/\bfor\s*\(/g) || []).length;
		const whileCount = (body.match(/\bwhile\s*\(/g) || []).length;
		const caseCount = (body.match(/\bcase\s+/g) || []).length;
		const catchCount = (body.match(/\bcatch\s*\(/g) || []).length;
		const ternaryCount = (body.match(/\?[^:]+:/g) || []).length;
		const andCount = (body.match(/&&/g) || []).length;
		const orCount = (body.match(/\|\|/g) || []).length;

		const complexity =
			1 + // Base complexity
			ifCount +
			elseCount +
			forCount +
			whileCount +
			caseCount +
			catchCount +
			ternaryCount +
			andCount +
			orCount;

		complexities.push(complexity);
	}

	if (complexities.length === 0) {
		return { avg: 0, max: 0 };
	}

	const avg = complexities.reduce((a, b) => a + b, 0) / complexities.length;
	const max = Math.max(...complexities);

	return { avg, max };
}

/**
 * Estimate maximum function lines (simplified)
 */
function estimateMaxFunctionLines(content: string): number {
	const lines = content.split("\n");
	let currentFunctionLines = 0;
	let maxLines = 0;
	let braceDepth = 0;
	let inFunction = false;

	for (const line of lines) {
		const trimmed = line.trim();

		// Detect function start
		if (trimmed.match(/\bfunction\s+\w+|=>\s*{|\basync\s+function/)) {
			inFunction = true;
			currentFunctionLines = 0;
		}

		if (inFunction) {
			currentFunctionLines++;

			// Track brace depth
			braceDepth += (trimmed.match(/{/g) || []).length;
			braceDepth -= (trimmed.match(/}/g) || []).length;

			// Function ended
			if (braceDepth === 0 && trimmed.includes("}")) {
				maxLines = Math.max(maxLines, currentFunctionLines);
				inFunction = false;
				currentFunctionLines = 0;
			}
		}
	}

	return maxLines;
}

/**
 * Calculate maintainability index
 * Formula: 171 - 5.2 * ln(HV) - 0.23 * CC - 16.2 * ln(LOC)
 * Where: HV = Halstead Volume, CC = Cyclomatic Complexity, LOC = Lines of Code
 * Simplified version using code lines and cyclomatic complexity
 */
function calculateMaintainabilityIndex(
	codeLines: number,
	avgCyclomatic: number,
): number {
	if (codeLines === 0) return 100;

	// Simplified formula (without Halstead Volume)
	const mi = Math.max(
		0,
		Math.min(100, 171 - 0.23 * avgCyclomatic - 16.2 * Math.log(codeLines)),
	);

	return Math.round(mi);
}

/**
 * Calculate technical debt ratio
 * Based on code complexity and maintainability
 */
function calculateTechnicalDebtRatio(
	maintainabilityIndex: number,
	avgCyclomatic: number,
): number {
	// Higher complexity and lower maintainability = higher debt
	const complexityFactor = Math.min(avgCyclomatic / 10, 5); // Max 5
	const maintainabilityFactor = (100 - maintainabilityIndex) / 10; // 0-10

	const debtRatio = (complexityFactor + maintainabilityFactor) * 2;

	return Math.round(Math.min(debtRatio, 100));
}

// ============================================================================
// Codebase Analysis
// ============================================================================

/**
 * Analyze entire codebase
 */
export async function analyzeCodebase(
	config: Partial<AnalyzerConfig> = {},
): Promise<CodeComplexityMetrics> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	logger.info(
		{
			rootDir: finalConfig.rootDir,
			include: finalConfig.include,
		},
		"Starting code complexity analysis",
	);

	try {
		// Find all files matching patterns
		const files = await glob(finalConfig.include, {
			cwd: finalConfig.rootDir,
			ignore: finalConfig.exclude,
			absolute: true,
		});

		logger.info(`Found ${files.length} files to analyze`);

		// Analyze each file
		const fileMetrics: FileMetrics[] = [];
		for (const file of files) {
			try {
				const metrics = await analyzeFile(file);
				fileMetrics.push(metrics);
			} catch (error) {
				logger.warn({ error, file }, `Failed to analyze file`);
			}
		}

		// Aggregate metrics
		const totalLines = fileMetrics.reduce((sum, m) => sum + m.totalLines, 0);
		const codeLines = fileMetrics.reduce((sum, m) => sum + m.codeLines, 0);
		const commentLines = fileMetrics.reduce(
			(sum, m) => sum + m.commentLines,
			0,
		);
		const totalFunctions = fileMetrics.reduce((sum, m) => sum + m.functions, 0);
		const totalClasses = fileMetrics.reduce((sum, m) => sum + m.classes, 0);

		// Calculate average cyclomatic complexity
		const complexities = fileMetrics
			.filter((m) => m.avgCyclomatic > 0)
			.map((m) => m.avgCyclomatic);
		const avgCyclomatic =
			complexities.length > 0
				? complexities.reduce((a, b) => a + b, 0) / complexities.length
				: 0;

		// Find max cyclomatic complexity
		const maxCyclomatic = Math.max(
			...fileMetrics.map((m) => m.maxCyclomatic),
			0,
		);

		// Find max function lines
		const maxFunctionLines = Math.max(
			...fileMetrics.map((m) => m.maxFunctionLines),
			0,
		);

		// Calculate maintainability index
		const maintainabilityIndex = calculateMaintainabilityIndex(
			codeLines,
			avgCyclomatic,
		);

		// Calculate technical debt ratio
		const technicalDebtRatio = calculateTechnicalDebtRatio(
			maintainabilityIndex,
			avgCyclomatic,
		);

		// Top 10 largest files for detailed tracking
		const topFiles = fileMetrics
			.sort((a, b) => b.totalLines - a.totalLines)
			.slice(0, 10)
			.map((m) => ({
				file: path.relative(finalConfig.rootDir, m.file),
				lines: m.totalLines,
			}));

		const metrics: CodeComplexityMetrics = {
			avgCyclomatic: Math.round(avgCyclomatic * 10) / 10,
			maxCyclomatic,
			totalLines,
			codeLines,
			commentLines,
			totalFiles: fileMetrics.length,
			totalFunctions,
			totalClasses,
			maxFunctionLines,
			fileMetrics: topFiles,
			maintainabilityIndex,
			technicalDebtRatio,
		};

		logger.info(metrics, "Code complexity analysis complete");

		return metrics;
	} catch (error) {
		logger.error({ error }, "Failed to analyze codebase");
		throw error;
	}
}

/**
 * Update Prometheus metrics with latest complexity data
 */
export async function updateComplexityMetrics(
	config?: Partial<AnalyzerConfig>,
): Promise<void> {
	try {
		const metrics = await analyzeCodebase(config);
		updateCodeComplexityMetrics(metrics);
		logger.info("Code complexity metrics updated successfully");
	} catch (error) {
		logger.error({ error }, "Failed to update code complexity metrics");
		throw error;
	}
}

/**
 * Start periodic complexity analysis
 */
let analysisInterval: NodeJS.Timeout | null = null;

export function startPeriodicAnalysis(config?: Partial<AnalyzerConfig>): void {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	// Run immediately on start
	updateComplexityMetrics(finalConfig).catch((error) => {
		logger.error({ error }, "Initial complexity analysis failed");
	});

	// Schedule periodic updates
	analysisInterval = setInterval(() => {
		updateComplexityMetrics(finalConfig).catch((error) => {
			logger.error({ error }, "Periodic complexity analysis failed");
		});
	}, finalConfig.updateIntervalMs);

	logger.info(
		{
			intervalMs: finalConfig.updateIntervalMs,
		},
		"Started periodic code complexity analysis",
	);
}

export function stopPeriodicAnalysis(): void {
	if (analysisInterval) {
		clearInterval(analysisInterval);
		analysisInterval = null;
		logger.info("Stopped periodic code complexity analysis");
	}
}

// ============================================================================
// Exports
// ============================================================================

export default {
	analyzeCodebase,
	updateComplexityMetrics,
	startPeriodicAnalysis,
	stopPeriodicAnalysis,
};
