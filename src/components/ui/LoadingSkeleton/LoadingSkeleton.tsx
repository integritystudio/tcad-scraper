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
			// biome-ignore lint/a11y/useSemanticElements: role="status" on div is correct for loading skeletons
			<div
				className={styles.searchSkeleton}
				role="status"
				aria-busy="true"
				data-testid="search-skeleton"
			>
				<div className={styles.heroSkeleton} data-testid="hero-skeleton">
					<div className={styles.titleSkeleton} data-testid="title-skeleton" />
					<div
						className={styles.subtitleSkeleton}
						data-testid="subtitle-skeleton"
					/>
					<div
						className={styles.searchBoxSkeleton}
						data-testid="searchbox-skeleton"
					/>
				</div>
				<span className={styles.srOnly}>Loading search interface...</span>
			</div>
		);
	}

	if (variant === "card") {
		return (
			// biome-ignore lint/a11y/useSemanticElements: role="status" on div is correct for loading skeletons
			<div
				className={styles.cardsSkeleton}
				role="status"
				aria-busy="true"
				data-testid="cards-skeleton"
			>
				{Array.from({ length: count }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton items never reorder
					<div
						key={`skeleton-${i}`}
						className={styles.cardSkeleton}
						data-testid="card-skeleton"
					>
						<div className={styles.cardHeader} />
						<div className={styles.cardBody} data-testid="card-body">
							<div className={styles.line} data-testid="skeleton-line" />
							<div className={styles.lineShort} data-testid="skeleton-line" />
							<div className={styles.line} data-testid="skeleton-line" />
						</div>
					</div>
				))}
				<span className={styles.srOnly}>Loading property cards...</span>
			</div>
		);
	}

	// Default: full page skeleton
	return (
		// biome-ignore lint/a11y/useSemanticElements: role="status" on div is correct for loading skeletons
		<div
			className={styles.pageSkeleton}
			role="status"
			aria-busy="true"
			data-testid="page-skeleton"
		>
			<div className={styles.heroSkeleton} data-testid="hero-skeleton">
				<div className={styles.titleSkeleton} />
				<div className={styles.subtitleSkeleton} />
				<div className={styles.searchBoxSkeleton} />
			</div>
			<div className={styles.contentSkeleton} data-testid="content-skeleton">
				<div className={styles.cardSkeleton} data-testid="card-skeleton">
					<div className={styles.cardHeader} />
					<div className={styles.cardBody} data-testid="card-body">
						<div className={styles.line} data-testid="skeleton-line" />
						<div className={styles.lineShort} data-testid="skeleton-line" />
					</div>
				</div>
			</div>
			<span className={styles.srOnly}>Loading application...</span>
		</div>
	);
};
