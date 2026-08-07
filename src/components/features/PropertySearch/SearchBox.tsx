import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { useDebounce } from "../../../hooks";
import { Button } from "../../ui/Button";
import { Icon } from "../../ui/Icon";
import styles from "./SearchBox.module.css";

const LIVE_SEARCH_DEBOUNCE_MS = 300;

interface SearchBoxProps {
	onSearch: (query: string) => void;
	loading?: boolean;
	placeholder?: string;
}

export const SearchBox = ({
	onSearch,
	loading = false,
	placeholder = "Ask anything... e.g., 'properties in Austin worth over $500k'",
}: SearchBoxProps) => {
	const [query, setQuery] = useState("");
	const debouncedQuery = useDebounce(query, LIVE_SEARCH_DEBOUNCE_MS);
	const lastSearchedRef = useRef("");
	const inputId = useId();
	const hintId = useId();

	const handleSearch = () => {
		const trimmed = query.trim();
		if (trimmed) {
			lastSearchedRef.current = trimmed;
			onSearch(trimmed);
		}
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			handleSearch();
		}
	};

	// Live search: fire automatically once typing settles, skipping queries
	// already searched via Enter/click (handleSearch) to avoid a duplicate call.
	useEffect(() => {
		const trimmed = debouncedQuery.trim();
		if (trimmed && trimmed !== lastSearchedRef.current) {
			lastSearchedRef.current = trimmed;
			onSearch(trimmed);
		}
	}, [debouncedQuery, onSearch]);

	return (
		<search className={styles.searchBox}>
			<label htmlFor={inputId} className={styles.srOnly}>
				Search properties
			</label>
			<div className={styles.searchIcon} aria-hidden="true">
				<Icon name="search" />
			</div>
			<input
				id={inputId}
				name="propertySearch"
				type="search"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				className={styles.searchInput}
				disabled={loading}
				autoComplete="off"
				aria-label="Search properties by name, address, or natural language query"
				aria-describedby={hintId}
				aria-busy={loading}
			/>
			<p id={hintId} className={styles.srOnly}>
				Examples: properties in Austin worth over $500k, commercial buildings
				downtown, residential near 78704
			</p>
			<Button
				onClick={handleSearch}
				disabled={loading || !query.trim()}
				variant="primary"
				aria-label={loading ? "Searching properties" : "Search properties"}
			>
				{loading ? "Searching..." : "Search"}
			</Button>
		</search>
	);
};
