import { useMemo } from "react";
import { Badge } from "../../../../ui/Badge";
import styles from "./FreshnessIndicator.module.css";

interface FreshnessIndicatorProps {
	timestamp: string;
	thresholds?: {
		fresh: number;
		aging: number;
	};
	variant?: "dot" | "badge";
}

const DEFAULT_THRESHOLDS = {
	fresh: 7, // days
	aging: 30, // days
};

export const FreshnessIndicator = ({
	timestamp,
	thresholds = DEFAULT_THRESHOLDS,
	variant = "badge",
}: FreshnessIndicatorProps) => {
	const { status, label } = useMemo(() => {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays <= thresholds.fresh) {
			return { status: "fresh", label: "Fresh" };
		} else if (diffDays <= thresholds.aging) {
			return { status: "aging", label: "Aging" };
		} else {
			return { status: "stale", label: "Stale" };
		}
	}, [timestamp, thresholds]);

	if (variant === "dot") {
		return (
			<span
				className={`${styles.dot} ${styles[status]}`}
				role="img"
				aria-label={`Data freshness: ${label}`}
				title={label}
			/>
		);
	}

	const badgeVariant =
		status === "fresh" ? "success" : status === "aging" ? "warning" : "error";

	return (
		<Badge variant={badgeVariant} size="sm">
			{label}
		</Badge>
	);
};
