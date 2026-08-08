import { usePagination } from "../../../hooks";
import type {
	AnswerBoxState,
	AnswerStatistics,
	Property,
} from "../../../types";
import { Button } from "../../ui/Button";
import { Icon } from "../../ui/Icon";
import { AnswerBox } from "./AnswerBox";
import { PropertyCard } from "./PropertyCard";
import styles from "./SearchResults.module.css";

const RESULTS_PER_PAGE = 12;

interface PaginatedResultsGridProps {
	results: Property[];
	loading?: boolean;
}

// Keyed by searchQuery in the parent so a new search remounts this and
// resets pagination to page 1, instead of reaching for an effect.
const PaginatedResultsGrid = ({
	results,
	loading,
}: PaginatedResultsGridProps) => {
	const {
		currentPage,
		totalPages,
		startIndex,
		endIndex,
		canGoNext,
		canGoPrev,
		goToNextPage,
		goToPrevPage,
	} = usePagination({
		totalItems: results.length,
		itemsPerPage: RESULTS_PER_PAGE,
	});

	return (
		<>
			<div className={styles.resultsGrid}>
				{results.slice(startIndex, endIndex).map((property) => (
					<PropertyCard key={property.id} property={property} />
				))}
			</div>

			{totalPages > 1 && (
				<div className={styles.pagination}>
					<p>
						Showing {startIndex + 1}-{endIndex} of {results.length} results
					</p>
					<div className={styles.pageControls}>
						<Button
							onClick={goToPrevPage}
							disabled={!canGoPrev || loading}
							variant="outline"
						>
							Previous
						</Button>
						<span className={styles.pageIndicator}>
							Page {currentPage} of {totalPages}
						</span>
						<Button
							onClick={goToNextPage}
							disabled={!canGoNext || loading}
							variant="outline"
						>
							Next
						</Button>
					</div>
				</div>
			)}
		</>
	);
};

interface SearchResultsProps {
	results: Property[];
	totalResults: number;
	explanation?: string;
	error?: string;
	loading?: boolean;
	searchQuery?: string;
	answer?: string;
	answerState?: AnswerBoxState;
	statistics?: AnswerStatistics;
}

export const SearchResults = ({
	results,
	totalResults,
	explanation,
	error,
	loading,
	searchQuery,
	answer,
	answerState = "idle",
	statistics,
}: SearchResultsProps) => {
	if (error) {
		return (
			<div className={styles.errorMessage}>
				<Icon name="alertCircle" />
				<div>
					<strong>Error:</strong> {error}
				</div>
			</div>
		);
	}

	if (!loading && results.length === 0 && searchQuery) {
		return (
			<div className={styles.noResults}>
				<Icon name="search" size={48} />
				<h3>No properties found</h3>
				<p>
					Try adjusting your search query or using one of the examples above
				</p>
			</div>
		);
	}

	if (results.length === 0) {
		return null;
	}

	return (
		<div className={styles.container}>
			{/* Answer Box for quantitative queries */}
			{(answer || answerState === "loading") && (
				<AnswerBox
					answer={answer || ""}
					totalResults={totalResults}
					statistics={statistics}
					searchQuery={searchQuery || ""}
					state={answerState}
					error={error}
				/>
			)}

			{/* Explanation for non-quantitative queries (only show if no answer) */}
			{explanation && !answer && answerState !== "loading" && (
				<div className={styles.explanation}>
					<div className={styles.explanationIcon}>
						<Icon name="chevron-right" size={16} />
					</div>
					<span>{explanation}</span>
					<span className={styles.resultCount}>({totalResults} results)</span>
				</div>
			)}

			<PaginatedResultsGrid
				key={searchQuery}
				results={results}
				loading={loading}
			/>
		</div>
	);
};
