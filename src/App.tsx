import { Suspense, lazy, useEffect } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Footer } from "./components/layout";
import { LoadingSkeleton } from "./components/ui/LoadingSkeleton";
import { useAnalytics } from "./hooks";
import "./App.css";

// Lazy load the main PropertySearch feature for code splitting
// This reduces initial bundle size by ~40-50%
const PropertySearchContainer = lazy(
	() =>
		import("./components/features/PropertySearch/PropertySearchContainer").then(
			(module) => ({ default: module.PropertySearchContainer }),
		),
);

function App() {
	const { logPageView } = useAnalytics();

	// Track initial page view
	useEffect(() => {
		logPageView(window.location.pathname, document.title);
	}, [logPageView]);

	return (
		<ErrorBoundary>
			<div className="app">
				<Suspense fallback={<LoadingSkeleton variant="search" />}>
					<PropertySearchContainer />
				</Suspense>
				<Footer />
			</div>
		</ErrorBoundary>
	);
}

export default App;
