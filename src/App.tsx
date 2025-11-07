import { useEffect } from 'react';
import { PropertySearchContainer } from './components/features/PropertySearch';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAnalytics } from './hooks';
import './App.css';

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
      </div>
    </ErrorBoundary>
  );
}

export default App;
