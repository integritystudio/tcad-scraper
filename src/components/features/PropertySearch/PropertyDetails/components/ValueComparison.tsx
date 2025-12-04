import { useMemo } from "react";
import { useFormatting } from "../../../../../hooks";
import styles from "./ValueComparison.module.css";

interface ValueComparisonProps {
	appraisedValue: number;
	assessedValue: number | null;
	showChart?: boolean;
}

export const ValueComparison = ({
	appraisedValue,
	assessedValue,
	showChart = false,
}: ValueComparisonProps) => {
	const { formatCurrency } = useFormatting();

	const difference = useMemo(() => {
		if (!assessedValue) return null;
		return assessedValue - appraisedValue;
	}, [appraisedValue, assessedValue]);

	const percentageDiff = useMemo(() => {
		if (!difference || !appraisedValue) return null;
		return (difference / appraisedValue) * 100;
	}, [difference, appraisedValue]);

	const getDifferenceClass = () => {
		if (!difference) return styles.neutral;
		return difference > 0 ? styles.positive : styles.negative;
	};

	const getDifferenceIcon = () => {
		if (!difference) return "";
		return difference > 0 ? "↑" : "↓";
	};

	return (
		<div className={styles.container}>
			<div className={styles.valueRow}>
				<span className={styles.label}>Appraised Value</span>
				<span className={styles.value}>{formatCurrency(appraisedValue)}</span>
			</div>

			{assessedValue !== null && (
				<>
					<div className={styles.valueRow}>
						<span className={styles.label}>Assessed Value</span>
						<span className={styles.value}>
							{formatCurrency(assessedValue)}
						</span>
					</div>

					{difference !== null && (
						<>
							<div className={styles.divider} />
							<div className={`${styles.valueRow} ${styles.differenceRow}`}>
								<span className={styles.label}>Difference</span>
								<span className={`${styles.value} ${getDifferenceClass()}`}>
									{formatCurrency(Math.abs(difference))}
									{percentageDiff !== null && (
										<span className={styles.percentage}>
											({percentageDiff > 0 ? "+" : ""}
											{percentageDiff.toFixed(1)}%)
										</span>
									)}
									<span className={styles.icon} aria-hidden="true">
										{getDifferenceIcon()}
									</span>
								</span>
							</div>

							{showChart && (
								<div className={styles.chartContainer}>
									<div className={styles.chartBar}>
										<div className={styles.chartLabel}>Appraised</div>
										<div className={styles.barBackground}>
											<div
												className={styles.barFill}
												style={{ width: "100%" }}
											/>
										</div>
										<div className={styles.chartValue}>100%</div>
									</div>
									<div className={styles.chartBar}>
										<div className={styles.chartLabel}>Assessed</div>
										<div className={styles.barBackground}>
											<div
												className={styles.barFill}
												style={{
													width: `${((assessedValue / appraisedValue) * 100).toFixed(1)}%`,
												}}
											/>
										</div>
										<div className={styles.chartValue}>
											{((assessedValue / appraisedValue) * 100).toFixed(1)}%
										</div>
									</div>
								</div>
							)}
						</>
					)}
				</>
			)}

			{assessedValue === null && (
				<div className={styles.noData}>
					<span className={styles.label}>Assessed Value</span>
					<span className={styles.noDataText}>Not available</span>
				</div>
			)}
		</div>
	);
};
