#!/usr/bin/env python3
"""
Batch migrate console.log statements to Pino logger
"""
import os
import re
import sys

# ---------------------------------------------------------------------------
# Data-Driven Configuration
# ---------------------------------------------------------------------------

# Mapping of console methods to logger methods
CONSOLE_TO_LOGGER_MAP: dict[str, str] = {
    'console.log': 'logger.info',
    'console.error': 'logger.error',
    'console.warn': 'logger.warn',
    'console.info': 'logger.info',
    'console.debug': 'logger.debug',
}

# Path patterns to logger import paths (checked in order, first match wins)
IMPORT_PATH_RULES: list[tuple[str, str]] = [
    ('/lib/', "import logger from './logger';"),
    ('/scripts/', "import logger from '../lib/logger';"),
    ('/cli/', "import logger from '../lib/logger';"),
    ('/services/', "import logger from '../lib/logger';"),
    ('/middleware/', "import logger from '../lib/logger';"),
    ('/routes/', "import logger from '../lib/logger';"),
    ('/utils/', "import logger from '../lib/logger';"),
]

DEFAULT_LOGGER_IMPORT = "import logger from '../lib/logger';"


# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------

def _apply_console_replacements(content: str) -> str:
    """Replace all console.* calls with logger.* equivalents."""
    for console_method, logger_method in CONSOLE_TO_LOGGER_MAP.items():
        pattern = rf'\b{re.escape(console_method)}\b'
        content = re.sub(pattern, logger_method, content)
    return content


def _get_logger_import_for_path(filepath: str) -> str:
    """Determine the appropriate logger import based on file path."""
    for path_pattern, import_statement in IMPORT_PATH_RULES:
        if path_pattern in filepath:
            return import_statement
    return DEFAULT_LOGGER_IMPORT


def _find_last_import_index(lines: list[str]) -> int:
    """Find the index of the last import statement (excluding type imports)."""
    last_import_idx = -1
    for i, line in enumerate(lines):
        if line.strip().startswith('import ') and not line.strip().startswith('import type'):
            last_import_idx = i
    return last_import_idx


def _insert_import(lines: list[str], logger_import: str, last_import_idx: int) -> list[str]:
    """Insert logger import at the appropriate position."""
    if last_import_idx >= 0:
        lines.insert(last_import_idx + 1, logger_import)
    elif lines[0].startswith('#!'):
        # Insert after shebang (and blank line if present)
        insert_pos = 2 if len(lines) > 1 and lines[1].strip() == '' else 1
        lines.insert(insert_pos, logger_import)
    else:
        lines.insert(0, logger_import)
    return lines


def migrate_file(filepath: str) -> bool:
    """Migrate a single file to use Pino logger instead of console.

    Args:
        filepath: Path to the TypeScript/JavaScript file to migrate.

    Returns:
        True if the file was modified, False if no changes were needed.
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    has_logger_import = 'import logger from' in content

    # Apply all console -> logger replacements
    content = _apply_console_replacements(content)

    if content == original_content:
        print(f"⏭️  No changes: {filepath}")
        return False

    # Add logger import if not present
    if not has_logger_import:
        lines = content.split('\n')
        logger_import = _get_logger_import_for_path(filepath)
        last_import_idx = _find_last_import_index(lines)
        lines = _insert_import(lines, logger_import, last_import_idx)
        content = '\n'.join(lines)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"✅ Migrated: {filepath}")
    return True

def main() -> None:
    """Entry point for batch migration of console statements to Pino logger.

    Processes files passed as command line arguments and migrates
    console.log/error/warn/info/debug calls to use the Pino logger utility.

    Usage:
        python3 batch-migrate.py <file1> <file2> ...
    """
    if len(sys.argv) < 2:
        print("Usage: python3 batch-migrate.py <file1> <file2> ...")
        sys.exit(1)

    files = sys.argv[1:]
    migrated_count = 0

    for filepath in files:
        if not os.path.exists(filepath):
            print(f"⚠️  File not found: {filepath}")
            continue

        if 'migrate-to-logger.ts' in filepath:
            print(f"⏭️  Skipping migration script: {filepath}")
            continue

        if migrate_file(filepath):
            migrated_count += 1

    print(f"\n✨ Migrated {migrated_count} files")

if __name__ == '__main__':
    main()
