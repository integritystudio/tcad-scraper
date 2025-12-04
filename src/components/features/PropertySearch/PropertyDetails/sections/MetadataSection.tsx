import { FreshnessIndicator } from "../components/FreshnessIndicator";
import { SectionHeader } from "../components/SectionHeader";
import { TimestampList } from "../components/TimestampList";
import styles from "./MetadataSection.module.css";

interface MetadataSectionProps {
	scrapedAt: string;
	updatedAt: string;
	createdAt: string;
}

export const MetadataSection = ({
	scrapedAt,
	updatedAt,
	createdAt,
}: MetadataSectionProps) => {
	return (
		<section className={styles.section}>
			<SectionHeader
				icon="clock"
				title="Data Freshness"
				badge={<FreshnessIndicator timestamp={scrapedAt} />}
			/>
			<TimestampList
				scrapedAt={scrapedAt}
				updatedAt={updatedAt}
				createdAt={createdAt}
			/>
		</section>
	);
};
