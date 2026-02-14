/**
 * Footer - Professional attribution and links
 * Touchpoint 3: Standard location for credits, catches users who scroll
 */
import { useAnalytics } from "../../../hooks";
import styles from "./Footer.module.css";

const INTEGRITY_STUDIO_URL = "https://integritystudio.dev";
const GITHUB_REPO_URL = "https://github.com/alephatx/tcad-scraper";

interface FooterLink {
	label: string;
	href: string;
	trackingLabel: string;
}

const footerLinks: FooterLink[] = [
	{
		label: "Contact Us",
		href: `${INTEGRITY_STUDIO_URL}/contact`,
		trackingLabel: "contact",
	},
	{
		label: "Portfolio",
		href: `${INTEGRITY_STUDIO_URL}/portfolio`,
		trackingLabel: "portfolio",
	},
	{
		label: "Blog",
		href: `${INTEGRITY_STUDIO_URL}/blog`,
		trackingLabel: "blog",
	},
	{
		label: "GitHub",
		href: GITHUB_REPO_URL,
		trackingLabel: "github",
	},
];

export const Footer = () => {
	const { track } = useAnalytics();
	const currentYear = new Date().getFullYear();

	const handleLinkClick = (trackingLabel: string) => {
		track({
			category: "conversion",
			action: "outbound_click",
			label: `footer_${trackingLabel}`,
			metadata: {
				element_location: "footer",
				destination: trackingLabel,
			},
		});
	};

	const handleBrandClick = () => {
		track({
			category: "conversion",
			action: "outbound_click",
			label: "footer_brand",
			metadata: {
				element_location: "footer",
				destination: "integritystudio_homepage",
			},
		});
	};

	return (
		<footer className={styles.footer}>
			<div className={styles.container}>
				<div className={styles.brand}>
					<p className={styles.tagline}>
						Built with{" "}
						<span className={styles.heart} role="img" aria-label="love">
							&#10084;
						</span>{" "}
						by{" "}
						<a
							href={INTEGRITY_STUDIO_URL}
							target="_blank"
							rel="noopener noreferrer"
							className={styles.brandLink}
							onClick={handleBrandClick}
						>
							Integrity Studio
						</a>
					</p>
					<p className={styles.description}>
						Custom development for data extraction, automation &amp; AI
					</p>
				</div>

				<nav className={styles.links} aria-label="Footer navigation">
					{footerLinks.map((link, index) => (
						<span key={link.label}>
							<a
								href={link.href}
								target="_blank"
								rel="noopener noreferrer"
								className={styles.link}
								onClick={() => handleLinkClick(link.trackingLabel)}
							>
								{link.label}
							</a>
							{index < footerLinks.length - 1 && (
								<span className={styles.separator} aria-hidden="true">
									&middot;
								</span>
							)}
						</span>
					))}
				</nav>

				<p className={styles.copyright}>
					&copy; {currentYear} Integrity Studio &middot; Austin, TX
				</p>
			</div>
		</footer>
	);
};
