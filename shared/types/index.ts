/**
 * Shared Types - Barrel Export
 *
 * This file provides a single point of import for all shared types used across
 * the TCAD scraper application (frontend, backend, and utilities).
 *
 * Property API types live in ./property.types.ts (canonical source).
 */

// Re-export JSON-LD utilities
export * from "./json-ld.utils";
export * from "./property.types";
