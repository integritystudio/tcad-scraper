#!/usr/bin/env python3
"""
Batch migrate client-side console.log statements to logger
"""
import os
import re
import sys

def migrate_file(filepath: str) -> bool:
    """Migrate a single client file to use logger instead of console.

    Args:
        filepath: Path to the TypeScript/JavaScript file to migrate.

    Returns:
        True if the file was modified, False if no changes were needed.
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Check if logger is already imported
    has_logger_import = 'import logger from' in content or "import logger from" in content

    # Replace console statements
    content = re.sub(r'\bconsole\.log\b', 'logger.info', content)
    content = re.sub(r'\bconsole\.error\b', 'logger.error', content)
    content = re.sub(r'\bconsole\.warn\b', 'logger.warn', content)
    content = re.sub(r'\bconsole\.info\b', 'logger.info', content)
    content = re.sub(r'\bconsole\.debug\b', 'logger.debug', content)

    # Only proceed if we made changes
    if content == original_content:
        print(f"⏭️  No changes: {filepath}")
        return False

    # Add logger import if not present
    if not has_logger_import:
        lines = content.split('\n')

        # Find last import statement
        last_import_idx = -1
        for i, line in enumerate(lines):
            if line.strip().startswith('import ') and not line.strip().startswith('import type'):
                last_import_idx = i

        # Determine relative path to logger based on file location
        if '/components/' in filepath:
            logger_import = "import logger from '../lib/logger';"
        elif '/services/' in filepath:
            logger_import = "import logger from '../lib/logger';"
        elif '/lib/' in filepath:
            logger_import = "import logger from './logger';"
        elif filepath.endswith('.tsx') or filepath.endswith('.ts'):
            # For root level ts/tsx files
            logger_import = "import logger from './lib/logger';"
        else:
            logger_import = "import logger from './lib/logger';"

        # Insert import after last import or at beginning
        if last_import_idx >= 0:
            lines.insert(last_import_idx + 1, logger_import)
        else:
            lines.insert(0, logger_import)

        content = '\n'.join(lines)

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"✅ Migrated: {filepath}")
    return True

def main() -> None:
    """Entry point for batch migration of client-side console statements.

    Processes files passed as command line arguments and migrates
    console.log/error/warn/info/debug calls to use the logger utility.

    Usage:
        python3 batch-migrate-client.py <file1> <file2> ...
    """
    if len(sys.argv) < 2:
        print("Usage: python3 batch-migrate-client.py <file1> <file2> ...")
        sys.exit(1)

    files = sys.argv[1:]
    migrated_count = 0

    for filepath in files:
        if not os.path.exists(filepath):
            print(f"⚠️  File not found: {filepath}")
            continue

        if migrate_file(filepath):
            migrated_count += 1

    print(f"\n✨ Migrated {migrated_count} files")

if __name__ == '__main__':
    main()
