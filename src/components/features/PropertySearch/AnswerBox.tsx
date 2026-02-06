import type { AnswerBoxProps, AnswerStatistics } from "../../../types";
import { formatCurrency } from "../../../utils/formatters";
import { Icon } from "../../ui/Icon";
import styles from "./AnswerBox.module.css";

/**
 * Loading skeleton for the answer box
 */
const LoadingState = () => (
	<div className={styles.loadingContent}>
		<div className={styles.skeleton} style={{ width: "80%", height: "24px" }} />
		<div className={styles.skeleton} style={{ width: "60%", height: "24px" }} />
		<div className={styles.loadingIndicator}>
			<Icon name="loader" size={16} className={styles.spin} />
			<span>Processing your query...</span>
		</div>
	</div>
);

/**
 * Success state showing the answer and statistics
 */
const SuccessState = ({
	answer,
	totalResults,
	statistics,
}: {
	answer: string;
	totalResults: number;
	statistics?: AnswerStatistics;
}) => (
	<>
		<p className={styles.answerText}>{answer}</p>

		{statistics && (
			<div className={styles.statisticsGrid}>
				{statistics.avgValue !== undefined && (
					<div className={styles.statCard}>
						<span className={styles.statLabel}>Average Value</span>
						<span className={styles.statValue}>
							{formatCurrency(statistics.avgValue)}
						</span>
					</div>
				)}

				{statistics.totalValue !== undefined && (
					<div className={styles.statCard}>
						<span className={styles.statLabel}>Total Value</span>
						<span className={styles.statValue}>
							{formatCurrency(statistics.totalValue)}
						</span>
					</div>
				)}

				{statistics.priceRange && (
					<div className={styles.statCard}>
						<span className={styles.statLabel}>Value Range</span>
						<span className={styles.statValue}>
							{formatCurrency(statistics.priceRange.min)} -{" "}
							{formatCurrency(statistics.priceRange.max)}
						</span>
					</div>
				)}

				{statistics.topCity && (
					<div className={styles.statCard}>
						<span className={styles.statLabel}>Top City</span>
						<span className={styles.statValue}>
							{statistics.topCity.name} (
							{statistics.topCity.count.toLocaleString()})
						</span>
					</div>
				)}
			</div>
		)}

		<div className={styles.answerMeta}>
			<div className={styles.aiIndicator}>
				<Icon name="sparkles" size={14} />
				<span>AI Answer</span>
			</div>
			<span className={styles.resultsBadge}>
				{totalResults.toLocaleString()} results
			</span>
		</div>
	</>
);

/**
 * Error state with retry option
 */
const ErrorState = ({ error }: { error?: string }) => (
	<div className={styles.errorContent}>
		<Icon name="alertCircle" size={20} />
		<div>
			<strong>Unable to process query</strong>
			<p>{error || "An error occurred while processing your question."}</p>
		</div>
	</div>
);

/**
 * No results found state
 */
const NoResultsState = ({ searchQuery }: { searchQuery: string }) => (
	<div className={styles.noResultsContent}>
		<Icon name="search" size={20} />
		<div>
			<strong>No properties found</strong>
			<p>
				We couldn&apos;t find any properties matching &quot;{searchQuery}&quot;.
				Try adjusting your search with common property attributes like address,
				owner name, or value range.
			</p>
		</div>
	</div>
);

/**
 * AnswerBox Component
 *
 * Displays a prominent natural language answer to quantitative questions
 * about property data, with supporting statistics.
 */
export const AnswerBox = ({
	answer,
	totalResults,
	statistics,
	searchQuery,
	state,
	error,
}: AnswerBoxProps) => {
	// Don't render if idle or no answer
	if (
		state === "idle" ||
		(!answer &&
			state !== "loading" &&
			state !== "error" &&
			state !== "no-results")
	) {
		return null;
	}

	const getStateClass = () => {
		switch (state) {
			case "error":
				return styles.error;
			case "no-results":
				return styles.warning;
			default:
				return "";
		}
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: section with role="status" is appropriate for this complex, dynamically-updated AI answer container
		<section
			className={`${styles.answerBox} ${getStateClass()}`}
			aria-label={`AI-generated answer for "${searchQuery}"`}
			role="status"
			aria-live="polite"
			aria-atomic="true"
		>
			<div className={styles.answerHeader}>
				<Icon name="sparkles" size={20} />
				<h2>Answer</h2>
			</div>

			{state === "loading" && <LoadingState />}
			{state === "success" && (
				<SuccessState
					answer={answer}
					totalResults={totalResults}
					statistics={statistics}
				/>
			)}
			{state === "error" && <ErrorState error={error} />}
			{state === "no-results" && <NoResultsState searchQuery={searchQuery} />}
		</section>
	);
};
