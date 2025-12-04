const {
	tokenRefreshService,
} = require("./dist/services/token-refresh.service");

(async () => {
	try {
		console.log("Refreshing TCAD authentication token...");
		const token = await tokenRefreshService.refreshToken();

		if (token) {
			console.log("✓ Token refreshed successfully");
			console.log("Token preview:", `${token.substring(0, 50)}...`);
			console.log("Token length:", token.length);

			// Update .env file
			const fs = require("node:fs");
			const envPath = ".env";
			let envContent = fs.readFileSync(envPath, "utf8");

			// Update or add TCAD_API_KEY
			if (envContent.includes("TCAD_API_KEY=")) {
				envContent = envContent.replace(
					/TCAD_API_KEY=.*/g,
					`TCAD_API_KEY=${token}`,
				);
			} else {
				envContent += `\nTCAD_API_KEY=${token}\n`;
			}

			fs.writeFileSync(envPath, envContent);
			console.log("✓ Updated .env with new token");

			await tokenRefreshService.cleanup();
			process.exit(0);
		} else {
			console.error("✗ Failed to refresh token");
			await tokenRefreshService.cleanup();
			process.exit(1);
		}
	} catch (error) {
		console.error("Error:", error);
		await tokenRefreshService.cleanup();
		process.exit(1);
	}
})();
