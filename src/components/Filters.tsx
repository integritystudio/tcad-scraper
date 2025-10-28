import { useState, useEffect, useMemo } from 'react';
import { Property } from '../types';
import './Filters.css';

interface FiltersProps {
  properties: Property[];
  onFilterChange: (filtered: Property[]) => void;
}

function Filters({ properties, onFilterChange }: FiltersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');

  const cities = useMemo(() => {
    const citySet = new Set(properties.map(p => p.city).filter(Boolean));
    return Array.from(citySet).sort();
  }, [properties]);

  const propertyTypes = useMemo(() => {
    const typeSet = new Set(properties.map(p => p.prop_type).filter(Boolean));
    return Array.from(typeSet).sort();
  }, [properties]);

  useEffect(() => {
    let filtered = [...properties];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.property_address.toLowerCase().includes(term) ||
        p.property_id.toLowerCase().includes(term) ||
        (p.description && p.description.toLowerCase().includes(term))
      );
    }

    if (selectedCity) {
      filtered = filtered.filter(p => p.city === selectedCity);
    }

    if (selectedType) {
      filtered = filtered.filter(p => p.prop_type === selectedType);
    }

    if (minValue) {
      const min = parseFloat(minValue);
      filtered = filtered.filter(p => p.appraised_value >= min);
    }

    if (maxValue) {
      const max = parseFloat(maxValue);
      filtered = filtered.filter(p => p.appraised_value <= max);
    }

    onFilterChange(filtered);
  }, [searchTerm, selectedCity, selectedType, minValue, maxValue, properties, onFilterChange]);

  const handleReset = () => {
    setSearchTerm('');
    setSelectedCity('');
    setSelectedType('');
    setMinValue('');
    setMaxValue('');
  };

  const hasActiveFilters = searchTerm || selectedCity || selectedType || minValue || maxValue;

  return (
    <div className="filters">
      <div className="filters-header">
        <h2>Filter & Search</h2>
        {hasActiveFilters && (
          <button className="reset-btn" onClick={handleReset}>
            Reset All
          </button>
        )}
      </div>

      <div className="filters-grid">
        <div className="filter-group">
          <label htmlFor="search">Search</label>
          <input
            id="search"
            type="text"
            placeholder="Search by name, address, or property ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="city">City</label>
          <select
            id="city"
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
          >
            <option value="">All Cities</option>
            {cities.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="type">Property Type</label>
          <select
            id="type"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="">All Types</option>
            {propertyTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="minValue">Min Appraised Value</label>
          <input
            id="minValue"
            type="number"
            placeholder="0"
            value={minValue}
            onChange={(e) => setMinValue(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="maxValue">Max Appraised Value</label>
          <input
            id="maxValue"
            type="number"
            placeholder="No limit"
            value={maxValue}
            onChange={(e) => setMaxValue(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

export default Filters;
