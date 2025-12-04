import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initializeSentry } from "./lib/sentry";
import "./lib/mixpanel"; // Initialize Mixpanel
import App from "./App";

// Initialize Sentry FIRST before rendering
initializeSentry();

const rootElement = document.getElementById("root");

if (!rootElement) {
	throw new Error("Root element not found");
}

createRoot(rootElement).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
