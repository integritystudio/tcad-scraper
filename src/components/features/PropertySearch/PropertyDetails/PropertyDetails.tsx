import type { Property } from "../../../../types";
import styles from "./PropertyDetails.module.css";
import { DescriptionSection } from "./sections/DescriptionSection";
import { FinancialSection } from "./sections/FinancialSection";
import { IdentifiersSection } from "./sections/IdentifiersSection";
import { MetadataSection } from "./sections/MetadataSection";

interface PropertyDetailsProps {
	property: Property;
	isExpanded: boolean;
	sections?: ("financial" | "identifiers" | "description" | "metadata")[];
}

const DEFAULT_SECTIONS = [
	"financial",
	"identifiers",
	"description",
	"metadata",
] as const;

export const PropertyDetails = ({
	property,
	isExpanded,
	sections = DEFAULT_SECTIONS,
}: PropertyDetailsProps) => {
	if (!isExpanded) return null;

	return (
		<div className={styles.container}>
			{sections.includes("financial") && (
				<FinancialSection
					appraisedValue={property.appraised_value}
					assessedValue={property.assessed_value}
				/>
			)}

			{sections.includes("identifiers") && (
				<IdentifiersSection
					propertyId={property.property_id}
					geoId={property.geo_id}
				/>
			)}

			{sections.includes("description") && property.description && (
				<DescriptionSection description={property.description} />
			)}

			{sections.includes("metadata") && (
				<MetadataSection
					scrapedAt={property.scraped_at}
					updatedAt={property.updated_at}
					createdAt={property.created_at}
				/>
			)}
		</div>
	);
};
