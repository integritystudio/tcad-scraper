import { useState, useEffect } from 'react';
import { Property } from './types';
import PropertyTable from './components/PropertyTable';
import Analytics from './components/Analytics';
import Filters from './components/Filters';
import Charts from './components/Charts';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function App() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch properties from the API
      const response = await fetch(`${API_URL}/properties?limit=1000`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const fetchedProperties = data.data || [];

      setProperties(fetchedProperties);
      setFilteredProperties(fetchedProperties);
    } catch (err) {
      console.error('Failed to fetch properties:', err);
      setError(err instanceof Error ? err.message : 'Failed to load properties');
      // Set empty arrays on error
      setProperties([]);
      setFilteredProperties([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>TCAD Property Analytics</h1>
        <p>Explore, analyze, and filter property tax data from Travis Central Appraisal District</p>
      </header>

      {error && (
        <div className="error-banner">
          <span>Error: {error}</span>
          <button onClick={fetchProperties}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading property data...</p>
        </div>
      ) : (
        <>
          <Analytics properties={filteredProperties} />
          <Charts properties={filteredProperties} />
          <Filters
            properties={properties}
            onFilterChange={setFilteredProperties}
          />
          <PropertyTable properties={filteredProperties} />
        </>
      )}
    </div>
  );
}

export default App;
