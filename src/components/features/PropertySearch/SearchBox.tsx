import { type KeyboardEvent, useId, useState } from "react";
import { Button } from "../../ui/Button";
import { Icon } from "../../ui/Icon";
import styles from "./SearchBox.module.css";

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
	const inputId = useId();
	const hintId = useId();

	const handleSearch = () => {
		if (query.trim()) {
			onSearch(query);
		}
	};

	const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			handleSearch();
		}
	};

	return (
		<search role="search" className={styles.searchBox}>
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
				onKeyPress={handleKeyPress}
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
