import type React from "react";
import { useCallback, useEffect, useState } from "react";
import {
	type JobStatus,
	type MonitoredSearch,
	propertyAPI,
	type ScrapeHistory,
} from "../services/api.service";
import "./ScrapeManager.css";
import logger from "../lib/logger";

interface ScrapeManagerProps {
	onScrapeComplete?: () => void;
}

export const ScrapeManager: React.FC<ScrapeManagerProps> = ({
	onScrapeComplete,
}) => {
	const [searchTerm, setSearchTerm] = useState("");
	const [currentJob, setCurrentJob] = useState<JobStatus | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [scrapeHistory, setScrapeHistory] = useState<ScrapeHistory[]>([]);
	const [monitoredSearches, setMonitoredSearches] = useState<MonitoredSearch[]>(
		[],
	);
	const [showHistory, setShowHistory] = useState(false);
	const [showMonitored, setShowMonitored] = useState(false);

	const loadScrapeHistory = useCallback(async () => {
		try {
			const response = await propertyAPI.getScrapeHistory(10, 0);
			setScrapeHistory(response.data);
		} catch (err) {
			logger.error("Failed to load scrape history:", err);
		}
	}, []);

	const loadMonitoredSearches = useCallback(async () => {
		try {
			const searches = await propertyAPI.getMonitoredSearches();
			setMonitoredSearches(searches);
		} catch (err) {
			logger.error("Failed to load monitored searches:", err);
		}
	}, []);

	useEffect(() => {
		loadScrapeHistory();
		loadMonitoredSearches();
	}, [loadMonitoredSearches, loadScrapeHistory]);

	const handleScrape = async () => {
		if (!searchTerm.trim()) {
			setError("Please enter a search term");
			return;
		}

		setLoading(true);
		setError(null);
		setCurrentJob(null);

		try {
			// Trigger the scrape job
			const { jobId } = await propertyAPI.triggerScrape(searchTerm);

			// Poll for job status
			const finalStatus = await propertyAPI.pollJobStatus(jobId, (status) => {
				setCurrentJob(status);
			});

			if (finalStatus.status === "completed") {
				setError(null);
				if (onScrapeComplete) {
					onScrapeComplete();
				}
				// Reload history
				await loadScrapeHistory();
			} else if (finalStatus.status === "failed") {
				setError(finalStatus.error || "Scraping failed");
			}
		} catch (err: unknown) {
			setError(
				err.response?.data?.error || err.message || "Failed to start scraping",
			);
		} finally {
			setLoading(false);
		}
	};

	const handleAddMonitored = async () => {
		if (!searchTerm.trim()) {
			setError("Please enter a search term");
			return;
		}

		try {
			await propertyAPI.addMonitoredSearch(searchTerm, "daily");
			await loadMonitoredSearches();
			setSearchTerm("");
			setError(null);
		} catch (err: unknown) {
			setError(err.response?.data?.error || "Failed to add monitored search");
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "completed":
				return "#10b981";
			case "failed":
				return "#ef4444";
			case "processing":
			case "active":
				return "#3b82f6";
			default:
				return "#6b7280";
		}
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleString();
	};

	return (
		<div className="scrape-manager">
			<div className="scrape-input-section">
				<h2>Property Search & Scraping</h2>
				<div className="search-controls">
					<input
						type="text"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						onKeyPress={(e) => e.key === "Enter" && handleScrape()}
						placeholder="Enter search term (e.g., owner name, address)"
						className="search-input"
						disabled={loading}
					/>
					<button
						type="button"
						onClick={handleScrape}
						disabled={loading || !searchTerm.trim()}
						className="scrape-button primary"
					>
						{loading ? "Scraping..." : "Start Scraping"}
					</button>
					<button
						type="button"
						onClick={handleAddMonitored}
						disabled={loading || !searchTerm.trim()}
						className="scrape-button secondary"
						title="Add to daily monitoring"
					>
						Monitor Daily
					</button>
				</div>

				{error && (
					<div className="error-message">
						<span>⚠️ {error}</span>
					</div>
				)}

				{currentJob && (
					<div className="job-status-card">
						<h3>Current Job Status</h3>
						<div className="status-info">
							<div
								className="status-badge"
								style={{ backgroundColor: getStatusColor(currentJob.status) }}
							>
								{currentJob.status.toUpperCase()}
							</div>
							{currentJob.progress !== undefined && currentJob.progress > 0 && (
								<div className="progress-bar-container">
									<div
										className="progress-bar-fill"
										style={{ width: `${currentJob.progress}%` }}
									/>
									<span className="progress-text">{currentJob.progress}%</span>
								</div>
							)}
							{currentJob.resultCount !== undefined && (
								<div className="result-count">
									Found {currentJob.resultCount} properties
								</div>
							)}
							{currentJob.error && (
								<div className="job-error">Error: {currentJob.error}</div>
							)}
						</div>
					</div>
				)}
			</div>

			<div className="scrape-tabs">
				<button
					type="button"
					className={`tab-button ${showHistory ? "active" : ""}`}
					onClick={() => {
						setShowHistory(!showHistory);
						setShowMonitored(false);
					}}
				>
					Recent Scrapes ({scrapeHistory.length})
				</button>
				<button
					type="button"
					className={`tab-button ${showMonitored ? "active" : ""}`}
					onClick={() => {
						setShowMonitored(!showMonitored);
						setShowHistory(false);
					}}
				>
					Monitored Searches ({monitoredSearches.length})
				</button>
			</div>

			{showHistory && (
				<div className="history-section">
					<h3>Recent Scrape History</h3>
					{scrapeHistory.length === 0 ? (
						<p className="no-data">No scraping history yet</p>
					) : (
						<div className="history-list">
							{scrapeHistory.map((job) => (
								<div key={job.id} className="history-item">
									<div className="history-header">
										<span className="search-term">{job.searchTerm}</span>
										<span
											className="status-badge small"
											style={{ backgroundColor: getStatusColor(job.status) }}
										>
											{job.status}
										</span>
									</div>
									<div className="history-details">
										<span>Started: {formatDate(job.startedAt)}</span>
										{job.resultCount !== null && (
											<span>Results: {job.resultCount}</span>
										)}
										{job.completedAt && (
											<span>Completed: {formatDate(job.completedAt)}</span>
										)}
									</div>
									{job.error && (
										<div className="history-error">Error: {job.error}</div>
									)}
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{showMonitored && (
				<div className="monitored-section">
					<h3>Monitored Searches</h3>
					{monitoredSearches.length === 0 ? (
						<p className="no-data">No monitored searches configured</p>
					) : (
						<div className="monitored-list">
							{monitoredSearches.map((search) => (
								<div key={search.id} className="monitored-item">
									<div className="monitored-header">
										<span className="search-term">{search.searchTerm}</span>
										<span className="frequency-badge">{search.frequency}</span>
									</div>
									<div className="monitored-details">
										{search.lastRun && (
											<span>Last run: {formatDate(search.lastRun)}</span>
										)}
										<span>Added: {formatDate(search.createdAt)}</span>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
};

export default ScrapeManager;
