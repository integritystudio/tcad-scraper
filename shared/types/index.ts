/**
 * Shared Types - Barrel Export
 *
 * This file provides a single point of import for all shared types used across
 * the TCAD scraper application (frontend, backend, and utilities).
 *
 * Usage:
 *   import { PropertyAPI, PropertyDatabase } from '@shared/types';
 */

// Re-export JSON-LD utilities
export * from "./json-ld.utils";
// Re-export all property types (includes Schema.org aligned types)
export * from "./property.types";

// Type guards and utilities
export {
	transformPropertyToAPI,
	transformPropertyToDatabase,
} from "./property.types";
