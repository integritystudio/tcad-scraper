import { useMemo, useState } from "react";
import type { Property } from "../types";
import "./PropertyTable.css";

interface PropertyTableProps {
	properties: Property[];
}

type SortField =
	| "name"
	| "property_address"
	| "city"
	| "appraised_value"
	| "prop_type";
type SortDirection = "asc" | "desc";

function PropertyTable({ properties }: PropertyTableProps) {
	const [sortField, setSortField] = useState<SortField>("appraised_value");
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
	const [currentPage, setCurrentPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);

	const sortedProperties = useMemo(() => {
		const sorted = [...properties].sort((a, b) => {
			let aVal: string | number = a[sortField] ?? "";
			let bVal: string | number = b[sortField] ?? "";

			if (typeof aVal === "string") aVal = aVal.toLowerCase();
			if (typeof bVal === "string") bVal = bVal.toLowerCase();

			if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
			if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
			return 0;
		});

		return sorted;
	}, [properties, sortField, sortDirection]);

	const paginatedProperties = useMemo(() => {
		const startIndex = (currentPage - 1) * pageSize;
		return sortedProperties.slice(startIndex, startIndex + pageSize);
	}, [sortedProperties, currentPage, pageSize]);

	const totalPages = Math.ceil(sortedProperties.length / (pageSize || 1));

	const handleSort = (field: SortField) => {
		if (sortField === field) {
			setSortDirection(sortDirection === "asc" ? "desc" : "asc");
		} else {
			setSortField(field);
			setSortDirection("asc");
		}
		setCurrentPage(1);
	};

	const formatCurrency = (value: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(value);
	};

	const _formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	const SortIcon = ({ field }: { field: SortField }) => {
		if (sortField !== field) {
			return <span className="sort-icon">⇅</span>;
		}
		return (
			<span className="sort-icon active">
				{sortDirection === "asc" ? "↑" : "↓"}
			</span>
		);
	};

	return (
		<div className="property-table-container">
			<div className="table-header">
				<h2>Property Records</h2>
				<div className="table-controls">
					<div className="page-size-control">
						<label htmlFor="pageSize">Show:</label>
						<select
							id="pageSize"
							value={pageSize}
							onChange={(e) => {
								setPageSize(Number(e.target.value));
								setCurrentPage(1);
							}}
						>
							<option value={10}>10</option>
							<option value={25}>25</option>
							<option value={50}>50</option>
							<option value={100}>100</option>
						</select>
					</div>
					<div className="results-info">
						Showing{" "}
						{paginatedProperties.length > 0
							? (currentPage - 1) * pageSize + 1
							: 0}{" "}
						- {Math.min(currentPage * pageSize, sortedProperties.length)} of{" "}
						{sortedProperties.length} properties
					</div>
				</div>
			</div>

			<div className="table-wrapper">
				<table className="property-table">
					<thead>
						<tr>
							<th onClick={() => handleSort("name")} className="sortable">
								Owner Name <SortIcon field="name" />
							</th>
							<th
								onClick={() => handleSort("property_address")}
								className="sortable"
							>
								Address <SortIcon field="property_address" />
							</th>
							<th onClick={() => handleSort("city")} className="sortable">
								City <SortIcon field="city" />
							</th>
							<th onClick={() => handleSort("prop_type")} className="sortable">
								Type <SortIcon field="prop_type" />
							</th>
							<th
								onClick={() => handleSort("appraised_value")}
								className="sortable numeric"
							>
								Appraised Value <SortIcon field="appraised_value" />
							</th>
							<th>Property ID</th>
						</tr>
					</thead>
					<tbody>
						{paginatedProperties.length === 0 ? (
							<tr>
								<td colSpan={6} className="no-data">
									No properties found matching your filters
								</td>
							</tr>
						) : (
							paginatedProperties.map((property) => (
								<tr key={property.id}>
									<td className="owner-name">{property.name}</td>
									<td>{property.property_address}</td>
									<td>{property.city || "-"}</td>
									<td>
										<span className="property-type-badge">
											{property.prop_type}
										</span>
									</td>
									<td className="numeric">
										{formatCurrency(property.appraised_value)}
									</td>
									<td className="property-id">{property.property_id}</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{totalPages > 1 && (
				<div className="pagination">
					<button
						type="button"
						onClick={() => setCurrentPage(1)}
						disabled={currentPage === 1}
						className="page-btn"
					>
						First
					</button>
					<button
						type="button"
						onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
						disabled={currentPage === 1}
						className="page-btn"
					>
						Previous
					</button>

					<div className="page-numbers">
						{Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
							let pageNum: number;
							if (totalPages <= 5) {
								pageNum = i + 1;
							} else if (currentPage <= 3) {
								pageNum = i + 1;
							} else if (currentPage >= totalPages - 2) {
								pageNum = totalPages - 4 + i;
							} else {
								pageNum = currentPage - 2 + i;
							}

							return (
								<button
									type="button"
									key={pageNum}
									onClick={() => setCurrentPage(pageNum)}
									className={`page-btn ${currentPage === pageNum ? "active" : ""}`}
								>
									{pageNum}
								</button>
							);
						})}
					</div>

					<button
						type="button"
						onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
						disabled={currentPage === totalPages}
						className="page-btn"
					>
						Next
					</button>
					<button
						type="button"
						onClick={() => setCurrentPage(totalPages)}
						disabled={currentPage === totalPages}
						className="page-btn"
					>
						Last
					</button>
				</div>
			)}
		</div>
	);
}

export default PropertyTable;
