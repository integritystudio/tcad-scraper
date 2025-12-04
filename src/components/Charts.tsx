import { useMemo } from "react";
import type { Property } from "../types";
import "./Charts.css";

interface ChartsProps {
	properties: Property[];
}

function Charts({ properties }: ChartsProps) {
	const valueDistribution = useMemo(() => {
		const ranges = [
			{ label: "$0-100k", min: 0, max: 100000, count: 0 },
			{ label: "$100k-250k", min: 100000, max: 250000, count: 0 },
			{ label: "$250k-500k", min: 250000, max: 500000, count: 0 },
			{ label: "$500k-1M", min: 500000, max: 1000000, count: 0 },
			{ label: "$1M+", min: 1000000, max: Infinity, count: 0 },
		];

		properties.forEach((p) => {
			const range = ranges.find(
				(r) => p.appraised_value >= r.min && p.appraised_value < r.max,
			);
			if (range) range.count++;
		});

		const maxCount = Math.max(...ranges.map((r) => r.count));

		return ranges.map((r) => ({
			...r,
			percentage: maxCount > 0 ? (r.count / maxCount) * 100 : 0,
		}));
	}, [properties]);

	const propertyTypeDistribution = useMemo(() => {
		const types: Record<string, number> = {};

		properties.forEach((p) => {
			types[p.prop_type] = (types[p.prop_type] || 0) + 1;
		});

		const sorted = Object.entries(types)
			.map(([type, count]) => ({ type, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 8);

		const maxCount = Math.max(...sorted.map((t) => t.count));

		return sorted.map((t) => ({
			...t,
			percentage: maxCount > 0 ? (t.count / maxCount) * 100 : 0,
		}));
	}, [properties]);

	const cityDistribution = useMemo(() => {
		const cities: Record<string, { count: number; totalValue: number }> = {};

		properties.forEach((p) => {
			if (p.city) {
				if (!cities[p.city]) {
					cities[p.city] = { count: 0, totalValue: 0 };
				}
				cities[p.city].count++;
				cities[p.city].totalValue += p.appraised_value;
			}
		});

		const sorted = Object.entries(cities)
			.map(([city, data]) => ({
				city,
				count: data.count,
				avgValue: data.totalValue / data.count,
			}))
			.sort((a, b) => b.count - a.count)
			.slice(0, 10);

		const maxCount = Math.max(...sorted.map((c) => c.count));

		return sorted.map((c) => ({
			...c,
			percentage: maxCount > 0 ? (c.count / maxCount) * 100 : 0,
		}));
	}, [properties]);

	return (
		<div className="charts">
			<div className="chart-card">
				<h3>Property Value Distribution</h3>
				<div className="chart-content">
					{valueDistribution.map((range) => (
						<div key={range.label} className="bar-group">
							<div className="bar-label">{range.label}</div>
							<div className="bar-container">
								<div className="bar" style={{ width: `${range.percentage}%` }}>
									<span className="bar-value">{range.count}</span>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>

			<div className="chart-card">
				<h3>Top Property Types</h3>
				<div className="chart-content">
					{propertyTypeDistribution.map((type) => (
						<div key={type.type} className="bar-group">
							<div className="bar-label">{type.type}</div>
							<div className="bar-container">
								<div
									className="bar secondary"
									style={{ width: `${type.percentage}%` }}
								>
									<span className="bar-value">{type.count}</span>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>

			<div className="chart-card full-width">
				<h3>Properties by City</h3>
				<div className="chart-content">
					{cityDistribution.map((city) => (
						<div key={city.city} className="bar-group">
							<div className="bar-label">{city.city}</div>
							<div className="bar-container">
								<div
									className="bar accent"
									style={{ width: `${city.percentage}%` }}
								>
									<span className="bar-value">{city.count}</span>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

export default Charts;
