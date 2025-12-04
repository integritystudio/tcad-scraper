import { useMemo } from "react";
import type { Property } from "../types";
import "./Analytics.css";

interface AnalyticsProps {
	properties: Property[];
}

function Analytics({ properties }: AnalyticsProps) {
	const stats = useMemo(() => {
		if (properties.length === 0) {
			return {
				totalProperties: 0,
				totalAppraised: 0,
				totalAssessed: 0,
				avgAppraised: 0,
				avgAssessed: 0,
				maxAppraised: 0,
				minAppraised: 0,
				propertyTypes: {},
				cities: {},
			};
		}

		const totalAppraised = properties.reduce(
			(sum, p) => sum + p.appraised_value,
			0,
		);
		const totalAssessed = properties.reduce(
			(sum, p) => sum + p.assessed_value,
			0,
		);
		const appraisedValues = properties
			.map((p) => p.appraised_value)
			.filter((v) => v > 0);

		const propertyTypes: Record<string, number> = {};
		const cities: Record<string, number> = {};

		properties.forEach((p) => {
			propertyTypes[p.prop_type] = (propertyTypes[p.prop_type] || 0) + 1;
			if (p.city) {
				cities[p.city] = (cities[p.city] || 0) + 1;
			}
		});

		return {
			totalProperties: properties.length,
			totalAppraised,
			totalAssessed,
			avgAppraised: totalAppraised / properties.length,
			avgAssessed: totalAssessed / properties.length,
			maxAppraised: Math.max(...appraisedValues),
			minAppraised: Math.min(...appraisedValues),
			propertyTypes,
			cities,
		};
	}, [properties]);

	const formatCurrency = (value: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(value);
	};

	const topPropertyTypes = Object.entries(stats.propertyTypes)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5);

	const topCities = Object.entries(stats.cities)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5);

	return (
		<div className="analytics">
			<div className="analytics-grid">
				<div className="stat-card primary">
					<div className="stat-label">Total Properties</div>
					<div className="stat-value">
						{stats.totalProperties.toLocaleString()}
					</div>
				</div>

				<div className="stat-card">
					<div className="stat-label">Total Appraised Value</div>
					<div className="stat-value">
						{formatCurrency(stats.totalAppraised)}
					</div>
				</div>

				<div className="stat-card">
					<div className="stat-label">Average Appraised Value</div>
					<div className="stat-value">{formatCurrency(stats.avgAppraised)}</div>
				</div>

				<div className="stat-card">
					<div className="stat-label">Total Assessed Value</div>
					<div className="stat-value">
						{formatCurrency(stats.totalAssessed)}
					</div>
				</div>
			</div>

			<div className="analytics-details">
				<div className="detail-card">
					<h3>Value Range</h3>
					<div className="detail-content">
						<div className="detail-item">
							<span className="detail-label">Highest Value:</span>
							<span className="detail-value">
								{formatCurrency(stats.maxAppraised)}
							</span>
						</div>
						<div className="detail-item">
							<span className="detail-label">Lowest Value:</span>
							<span className="detail-value">
								{formatCurrency(stats.minAppraised)}
							</span>
						</div>
					</div>
				</div>

				<div className="detail-card">
					<h3>Top Property Types</h3>
					<div className="detail-content">
						{topPropertyTypes.map(([type, count]) => (
							<div key={type} className="detail-item">
								<span className="detail-label">{type || "Unknown"}:</span>
								<span className="detail-value">{count} properties</span>
							</div>
						))}
					</div>
				</div>

				<div className="detail-card">
					<h3>Top Cities</h3>
					<div className="detail-content">
						{topCities.map(([city, count]) => (
							<div key={city} className="detail-item">
								<span className="detail-label">{city}:</span>
								<span className="detail-value">{count} properties</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

export default Analytics;
