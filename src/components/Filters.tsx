import { useState, useMemo } from 'react';
import { Property } from '../types';
import './Filters.css';

interface FiltersProps {
  properties: Property[];
  onFilterChange: (filtered: Property[]) => void;
}

interface FilterState {
  searchTerm: string;
  selectedCity: string;
  selectedType: string;
  minValue: string;
  maxValue: string;
}

const initialFilterState: FilterState = {
  searchTerm: '',
  selectedCity: '',
  selectedType: '',
  minValue: '',
  maxValue: '',
};

function applyFilters(properties: Property[], filters: FilterState): Property[] {
  return properties.filter(property => {
    // Search filter
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      const matchesSearch =
        property.name.toLowerCase().includes(term) ||
        property.property_address.toLowerCase().includes(term) ||
        property.property_id.toLowerCase().includes(term) ||
        (property.description && property.description.toLowerCase().includes(term));

      if (!matchesSearch) return false;
    }

    // City filter
    if (filters.selectedCity && property.city !== filters.selectedCity) {
      return false;
    }

    // Property type filter
    if (filters.selectedType && property.prop_type !== filters.selectedType) {
      return false;
    }

    // Min value filter
    if (filters.minValue) {
      const min = parseFloat(filters.minValue);
      if (property.appraised_value < min) return false;
    }

    // Max value filter
    if (filters.maxValue) {
      const max = parseFloat(filters.maxValue);
      if (property.appraised_value > max) return false;
    }

    return true;
  });
}

function Filters({ properties, onFilterChange }: FiltersProps) {
  const [filters, setFilters] = useState<FilterState>(initialFilterState);

  const cities = useMemo(() => {
    const citySet = new Set(properties.map(p => p.city).filter(Boolean));
    return Array.from(citySet).sort();
  }, [properties]);

  const propertyTypes = useMemo(() => {
    const typeSet = new Set(properties.map(p => p.prop_type).filter(Boolean));
    return Array.from(typeSet).sort();
  }, [properties]);

  const filteredProperties = useMemo(() => {
    const filtered = applyFilters(properties, filters);
    onFilterChange(filtered);
    return filtered;
  }, [properties, filters, onFilterChange]);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setFilters(initialFilterState);
  };

  const hasActiveFilters = Object.values(filters).some(value => value !== '');

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
            value={filters.searchTerm}
            onChange={(e) => updateFilter('searchTerm', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="city">City</label>
          <select
            id="city"
            value={filters.selectedCity}
            onChange={(e) => updateFilter('selectedCity', e.target.value)}
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
            value={filters.selectedType}
            onChange={(e) => updateFilter('selectedType', e.target.value)}
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
            value={filters.minValue}
            onChange={(e) => updateFilter('minValue', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="maxValue">Max Appraised Value</label>
          <input
            id="maxValue"
            type="number"
            placeholder="No limit"
            value={filters.maxValue}
            onChange={(e) => updateFilter('maxValue', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

export default Filters;
