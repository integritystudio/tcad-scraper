import { useMemo } from "react";
import styles from "./TimestampList.module.css";

interface TimestampListProps {
	scrapedAt: string;
	updatedAt: string;
	createdAt: string;
	showRelative?: boolean;
}

// Pure utility functions moved outside component to avoid recreation on each render
const formatRelativeTime = (dateString: string): string => {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffMinutes = Math.floor(diffMs / (1000 * 60));

	if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
	if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
	if (diffMinutes > 0)
		return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
	return "Just now";
};

const formatAbsoluteTime = (dateString: string): string => {
	const date = new Date(dateString);
	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
};

export const TimestampList = ({
	scrapedAt,
	updatedAt,
	createdAt,
	showRelative = true,
}: TimestampListProps) => {
	const relativeScraped = useMemo(
		() => formatRelativeTime(scrapedAt),
		[scrapedAt],
	);
	const relativeUpdated = useMemo(
		() => formatRelativeTime(updatedAt),
		[updatedAt],
	);

	return (
		<div className={styles.container}>
			<div className={styles.timestampItem}>
				<span className={styles.label}>Last Scraped</span>
				<div className={styles.timeContainer}>
					{showRelative && (
						<span className={styles.relativeTime}>{relativeScraped}</span>
					)}
					<span className={styles.absoluteTime}>
						({formatAbsoluteTime(scrapedAt)})
					</span>
				</div>
			</div>

			<div className={styles.timestampItem}>
				<span className={styles.label}>Last Updated</span>
				<div className={styles.timeContainer}>
					{showRelative && (
						<span className={styles.relativeTime}>{relativeUpdated}</span>
					)}
					<span className={styles.absoluteTime}>
						({formatAbsoluteTime(updatedAt)})
					</span>
				</div>
			</div>

			<div className={styles.timestampItem}>
				<span className={styles.label}>Created</span>
				<span className={styles.absoluteTime}>
					{formatAbsoluteTime(createdAt)}
				</span>
			</div>
		</div>
	);
};
