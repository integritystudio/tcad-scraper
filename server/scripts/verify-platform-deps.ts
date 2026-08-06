import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
const platform = `${process.platform}-${process.arch}`;
const projectRoot = join(__dirname, "..");

console.log("\n=== Platform Verification ===");
console.log(`   Platform: ${platform}`);
console.log(`   Environment: ${isCI ? "CI" : "Local"}`);
console.log("");

let hasErrors = false;

// Check 1: Node.js Version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0], 10);
if (majorVersion >= 18) {
	console.log(`[OK] Node.js ${nodeVersion}`);
} else {
	console.log(`[ERROR] Node.js ${nodeVersion} (requires >=18)`);
	hasErrors = true;
}

// Check 2: Rollup Platform Module
const rollupDir = join(projectRoot, "node_modules/@rollup");
if (existsSync(rollupDir)) {
	const modules = readdirSync(rollupDir).filter((d) => d.startsWith("rollup-"));
	const hasPlatformModule = modules.some((m) => m.includes(process.platform));

	if (hasPlatformModule || isCI) {
		console.log(
			`[OK] Rollup modules: ${modules.join(", ") || "none (expected in CI with --omit=optional)"}`,
		);
	} else {
		console.log(`[ERROR] Rollup missing ${platform} module`);
		console.log(`   Found: ${modules.join(", ")}`);
		console.log(`   Fix: rm -rf node_modules package-lock.json && npm install`);
		hasErrors = true;
	}
} else {
	console.log(
		"[WARN] @rollup directory not found - may need to install dependencies first",
	);
}

// Check 3: TypeScript
try {
	execSync("npx tsc --version", { stdio: "pipe", cwd: projectRoot });
	console.log("[OK] TypeScript installed");
} catch {
	console.log("[ERROR] TypeScript not installed");
	hasErrors = true;
}

// Check 4: Prisma Client
const prismaClientDir = join(projectRoot, "node_modules/.prisma/client");
if (existsSync(prismaClientDir)) {
	console.log("[OK] Prisma client generated");
} else {
	console.log("[WARN] Prisma client not generated");
	console.log("   Fix: npx prisma generate");
}

console.log("");
if (hasErrors && !isCI) {
	console.log("=== Platform verification FAILED ===");
	process.exit(1);
} else {
	console.log("=== Platform verification passed! ===");
}
