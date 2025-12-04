import type { ReactNode } from "react";
import styles from "./Badge.module.css";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info";
type BadgeSize = "sm" | "md" | "lg";

interface BadgeProps {
	variant?: BadgeVariant;
	size?: BadgeSize;
	children: ReactNode;
	className?: string;
}

export const Badge = ({
	variant = "default",
	size = "md",
	children,
	className = "",
}: BadgeProps) => {
	const classes = [styles.badge, styles[variant], styles[size], className]
		.filter(Boolean)
		.join(" ");

	return <span className={classes}>{children}</span>;
};
