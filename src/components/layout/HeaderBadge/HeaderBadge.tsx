/**
 * HeaderBadge - Subtle "by Integrity Studio" attribution in the header
 * Touchpoint 1: Immediate brand presence without interference
 */
import { useAnalytics } from "../../../hooks";
import styles from "./HeaderBadge.module.css";

const INTEGRITY_STUDIO_URL = "https://integritystudio.dev";

export const HeaderBadge = () => {
	const { track } = useAnalytics();

	const handleClick = () => {
		track({
			category: "conversion",
			action: "outbound_click",
			label: "header_badge",
			metadata: {
				element_location: "header_badge",
				destination: "integritystudio_homepage",
			},
		});
	};

	return (
		<a
			href={INTEGRITY_STUDIO_URL}
			target="_blank"
			rel="noopener noreferrer"
			className={styles.badge}
			onClick={handleClick}
			aria-label="Visit Integrity Studio website"
		>
			<span className={styles.text}>by Integrity Studio</span>
			<span className={styles.arrow} aria-hidden="true">
				&rarr;
			</span>
		</a>
	);
};
