import { Component, type ErrorInfo, type ReactNode } from "react";
import { trackError } from "../lib/analytics";
import mixpanel from "../lib/mixpanel";
import { addBreadcrumb, captureException } from "../lib/sentry";
import styles from "./ErrorBoundary.module.css";
import { Button } from "./ui/Button";

interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: ReactNode;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
	eventId: string | null;
}

export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			eventId: null,
		};
	}

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		return {
			hasError: true,
			error,
		};
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		// Add breadcrumb for context
		addBreadcrumb({
			message: "Error boundary triggered",
			category: "error",
			level: "error",
			data: {
				errorName: error.name,
				errorMessage: error.message,
			},
		});

		// Capture error to Sentry with component stack
		const eventId = captureException(error, {
			componentStack: errorInfo.componentStack,
			errorName: error.name,
			errorBoundary: true,
		});

		this.setState({ eventId });

		// Track error to analytics (legacy)
		trackError(error.message, "error_boundary", {
			componentStack: errorInfo.componentStack,
			errorName: error.name,
		});

		// Track error to Mixpanel
		mixpanel.track("Error", {
			error_type: "error_boundary",
			error_message: error.message,
			error_code: error.name,
			page_url: window.location.href,
		});

		// Log to console in development
		if (import.meta.env.DEV) {
			console.error("ErrorBoundary caught error:", error, errorInfo);
		}
	}

	render(): ReactNode {
		if (this.state.hasError) {
			// Show custom fallback UI if provided
			if (this.props.fallback) {
				return this.props.fallback;
			}

			// Default error UI
			return (
				<div className={styles.container}>
					<h1 className={styles.heading}>Something went wrong</h1>
					<p className={styles.message}>
						We've been notified about this error and will fix it as soon as
						possible.
					</p>
					<Button variant="primary" onClick={() => window.location.reload()}>
						Reload Page
					</Button>
				</div>
			);
		}

		return this.props.children;
	}
}
