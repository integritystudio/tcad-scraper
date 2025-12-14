/**
 * LoadingSkeleton - Displays a loading state while components are being lazy loaded
 * Used as fallback for React.lazy() Suspense boundaries
 */
import styles from "./LoadingSkeleton.module.css";

interface LoadingSkeletonProps {
	/** Type of skeleton to display */
	variant?: "search" | "card" | "page";
	/** Number of skeleton items to show (for card variant) */
	count?: number;
}

export const LoadingSkeleton = ({
	variant = "page",
	count = 3,
}: LoadingSkeletonProps) => {
	if (variant === "search") {
		return (
			<div className={styles.searchSkeleton} role="status" aria-busy="true">
				<div className={styles.heroSkeleton}>
					<div className={styles.titleSkeleton} />
					<div className={styles.subtitleSkeleton} />
					<div className={styles.searchBoxSkeleton} />
				</div>
				<span className={styles.srOnly}>Loading search interface...</span>
			</div>
		);
	}

	if (variant === "card") {
		return (
			<div className={styles.cardsSkeleton} role="status" aria-busy="true">
				{Array.from({ length: count }).map((_, i) => (
					<div key={`skeleton-${i}`} className={styles.cardSkeleton}>
						<div className={styles.cardHeader} />
						<div className={styles.cardBody}>
							<div className={styles.line} />
							<div className={styles.lineShort} />
							<div className={styles.line} />
						</div>
					</div>
				))}
				<span className={styles.srOnly}>Loading property cards...</span>
			</div>
		);
	}

	// Default: full page skeleton
	return (
		<div className={styles.pageSkeleton} role="status" aria-busy="true">
			<div className={styles.heroSkeleton}>
				<div className={styles.titleSkeleton} />
				<div className={styles.subtitleSkeleton} />
				<div className={styles.searchBoxSkeleton} />
			</div>
			<div className={styles.contentSkeleton}>
				<div className={styles.cardSkeleton}>
					<div className={styles.cardHeader} />
					<div className={styles.cardBody}>
						<div className={styles.line} />
						<div className={styles.lineShort} />
					</div>
				</div>
			</div>
			<span className={styles.srOnly}>Loading application...</span>
		</div>
	);
};
