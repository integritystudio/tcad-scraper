import { useState, useEffect } from 'react';
import { Property } from './types';
import PropertyTable from './components/PropertyTable';
import Analytics from './components/Analytics';
import Filters from './components/Filters';
import Charts from './components/Charts';
import './App.css';

// Mock data for demonstration
const mockProperties: Property[] = [
  {
    id: '1',
    property_id: 'R123456',
    name: 'John Smith',
    prop_type: 'Single Family',
    city: 'Austin',
    property_address: '123 Main St',
    assessed_value: 450000,
    appraised_value: 475000,
    geo_id: 'GEO001',
    description: 'Residential property',
    search_term: null,
    scraped_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    property_id: 'R234567',
    name: 'Jane Doe',
    prop_type: 'Condo',
    city: 'Austin',
    property_address: '456 Oak Ave',
    assessed_value: 325000,
    appraised_value: 340000,
    geo_id: 'GEO002',
    description: 'Condominium unit',
    search_term: null,
    scraped_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    property_id: 'R345678',
    name: 'Bob Johnson',
    prop_type: 'Townhouse',
    city: 'Round Rock',
    property_address: '789 Elm St',
    assessed_value: 280000,
    appraised_value: 295000,
    geo_id: 'GEO003',
    description: 'Townhouse property',
    search_term: null,
    scraped_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

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
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Use mock data instead of Supabase
      setProperties(mockProperties);
      setFilteredProperties(mockProperties);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
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
