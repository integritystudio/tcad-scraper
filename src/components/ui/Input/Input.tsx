import type { InputHTMLAttributes, ReactNode } from "react";
import styles from "./Input.module.css";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	label?: string;
	error?: string;
	icon?: ReactNode;
}

export const Input = ({
	label,
	error,
	icon,
	id,
	className = "",
	...props
}: InputProps) => {
	const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

	return (
		<div className={`${styles.inputWrapper} ${className}`}>
			{label && (
				<label htmlFor={inputId} className={styles.label}>
					{label}
				</label>
			)}
			<div className={styles.inputContainer}>
				{icon && <div className={styles.icon}>{icon}</div>}
				<input
					id={inputId}
					className={`${styles.input} ${icon ? styles.withIcon : ""} ${
						error ? styles.error : ""
					}`}
					{...props}
				/>
			</div>
			{error && <span className={styles.errorText}>{error}</span>}
		</div>
	);
};
