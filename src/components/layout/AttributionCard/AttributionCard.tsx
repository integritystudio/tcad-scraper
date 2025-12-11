/**
 * AttributionCard - Context-rich "About This Tool" card
 * Touchpoint 2: Appears after initial interaction, primary conversion driver
 */
import { useAnalytics } from "../../../hooks";
import styles from "./AttributionCard.module.css";

const INTEGRITY_STUDIO_URL = "https://integritystudio.dev";
const GITHUB_REPO_URL = "https://github.com/alephatx/tcad-scraper";

export const AttributionCard = () => {
	const { track } = useAnalytics();

	const handleServicesClick = () => {
		track({
			category: "conversion",
			action: "outbound_click",
			label: "attribution_card_services",
			metadata: {
				element_location: "inline_card",
				destination: "integritystudio_services",
				cta_text: "Learn About Our Services",
			},
		});
	};

	const handleGithubClick = () => {
		track({
			category: "engagement",
			action: "outbound_click",
			label: "attribution_card_github",
			metadata: {
				element_location: "inline_card",
				destination: "github_repo",
				cta_text: "View Source Code",
			},
		});
	};

	return (
		<aside className={styles.card} aria-labelledby="attribution-heading">
			<div className={styles.iconWrapper} aria-hidden="true">
				<svg
					className={styles.icon}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<circle cx="12" cy="12" r="10" />
					<line x1="12" y1="16" x2="12" y2="12" />
					<line x1="12" y1="8" x2="12.01" y2="8" />
				</svg>
			</div>
			<div className={styles.content}>
				<h2 id="attribution-heading" className={styles.heading}>
					About This Tool
				</h2>
				<p className={styles.description}>
					TCAD Property Explorer is a showcase project by{" "}
					<strong>Integrity Studio</strong>&mdash;we build custom data
					extraction and automation tools for businesses.
				</p>
				<div className={styles.actions}>
					<a
						href={INTEGRITY_STUDIO_URL}
						target="_blank"
						rel="noopener noreferrer"
						className={styles.primaryLink}
						onClick={handleServicesClick}
					>
						Learn About Our Services
						<span className={styles.arrow} aria-hidden="true">
							&rarr;
						</span>
					</a>
					<a
						href={GITHUB_REPO_URL}
						target="_blank"
						rel="noopener noreferrer"
						className={styles.secondaryLink}
						onClick={handleGithubClick}
					>
						View Source Code
						<span className={styles.externalIcon} aria-hidden="true">
							&#8599;
						</span>
					</a>
				</div>
			</div>
		</aside>
	);
};
