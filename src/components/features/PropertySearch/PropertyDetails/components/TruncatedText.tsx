import { useState } from "react";
import styles from "./TruncatedText.module.css";

interface TruncatedTextProps {
	text: string | null;
	maxLength?: number;
	expandLabel?: string;
	collapseLabel?: string;
}

export const TruncatedText = ({
	text,
	maxLength = 150,
	expandLabel = "Show more",
	collapseLabel = "Show less",
}: TruncatedTextProps) => {
	const [isExpanded, setIsExpanded] = useState(false);

	if (!text) {
		return (
			<p className={styles.noData}>
				No description available for this property.
			</p>
		);
	}

	const needsTruncation = text.length > maxLength;
	const displayText =
		needsTruncation && !isExpanded ? `${text.slice(0, maxLength)}...` : text;

	return (
		<div className={styles.container}>
			<p className={styles.text}>{displayText}</p>
			{needsTruncation && (
				<button
					type="button"
					onClick={() => setIsExpanded(!isExpanded)}
					className={styles.toggleButton}
				>
					{isExpanded ? collapseLabel : expandLabel}
				</button>
			)}
		</div>
	);
};
