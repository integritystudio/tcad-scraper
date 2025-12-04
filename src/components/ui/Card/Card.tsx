import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Card.module.css";

type CardVariant = "default" | "elevated" | "outlined";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
	variant?: CardVariant;
	children: ReactNode;
	padding?: "sm" | "md" | "lg";
}

export const Card = ({
	variant = "default",
	children,
	padding = "md",
	className = "",
	...props
}: CardProps) => {
	const classes = [
		styles.card,
		styles[variant],
		styles[`padding-${padding}`],
		className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div className={classes} {...props}>
			{children}
		</div>
	);
};

interface CardHeaderProps {
	children: ReactNode;
	className?: string;
}

export const CardHeader = ({ children, className = "" }: CardHeaderProps) => {
	return <div className={`${styles.header} ${className}`}>{children}</div>;
};

interface CardBodyProps {
	children: ReactNode;
	className?: string;
}

export const CardBody = ({ children, className = "" }: CardBodyProps) => {
	return <div className={`${styles.body} ${className}`}>{children}</div>;
};

interface CardFooterProps {
	children: ReactNode;
	className?: string;
}

export const CardFooter = ({ children, className = "" }: CardFooterProps) => {
	return <div className={`${styles.footer} ${className}`}>{children}</div>;
};
