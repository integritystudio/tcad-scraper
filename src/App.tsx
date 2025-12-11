import { useEffect } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PropertySearchContainer } from "./components/features/PropertySearch";
import { Footer } from "./components/layout";
import { useAnalytics } from "./hooks";
import "./App.css";

function App() {
	const { logPageView } = useAnalytics();

	// Track initial page view
	useEffect(() => {
		logPageView(window.location.pathname, document.title);
	}, [logPageView]);

	return (
		<ErrorBoundary>
			<div className="app">
				<PropertySearchContainer />
				<Footer />
			</div>
		</ErrorBoundary>
	);
}

export default App;
