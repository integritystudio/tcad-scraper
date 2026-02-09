/**
 * App Routes - Serves the frontend application with secure data passing
 */

import { type Request, type Response, Router } from "express";
import logger from "../lib/logger";
import { getErrorMessage } from "../utils/error-helpers";
import {
	cspMiddleware,
	generateSecureHtml,
	getInitialAppData,
	nonceMiddleware,
} from "../middleware/xcontroller.middleware";

const router = Router();

/**
 * Serve the main application with secure initial data
 */
router.get(
	"/",
	nonceMiddleware,
	cspMiddleware,
	(_req: Request, res: Response) => {
		try {
			const nonce = res.locals.nonce;
			const initialData = getInitialAppData();

			const html = generateSecureHtml({
				title: "TCAD Property Analytics",
				nonce,
				initialData,
				scriptSrc: "/src/main.tsx",
				styleSrc: "/src/App.css",
			});

			res.setHeader("Content-Type", "text/html; charset=utf-8");
			res.send(html);
		} catch (error) {
			logger.error(
				`Error serving app: ${getErrorMessage(error)}`,
			);
			res.status(500).send("Internal Server Error");
		}
	},
);

/**
 * Health check endpoint
 */
router.get("/health", (_req: Request, res: Response) => {
	res.json({
		status: "healthy",
		timestamp: new Date().toISOString(),
	});
});

export { router as appRouter };
