#!/usr/bin/env python3
"""
Batch migrate console.log statements to Pino logger
"""
import os
import re
import sys

def migrate_file(filepath):
    """Migrate a single file to use logger instead of console"""
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

        # Determine relative path to logger
        file_dir = os.path.dirname(filepath)
        if '/scripts/' in filepath:
            logger_import = "import logger from '../lib/logger';"
        elif '/cli/' in filepath:
            logger_import = "import logger from '../lib/logger';"
        elif '/services/' in filepath or '/middleware/' in filepath or '/routes/' in filepath or '/utils/' in filepath:
            logger_import = "import logger from '../lib/logger';"
        elif '/lib/' in filepath:
            logger_import = "import logger from './logger';"
        else:
            logger_import = "import logger from '../lib/logger';"

        # Insert import after last import or at beginning
        if last_import_idx >= 0:
            lines.insert(last_import_idx + 1, logger_import)
        else:
            # Insert after shebang if present
            if lines[0].startswith('#!'):
                lines.insert(2 if len(lines) > 1 and lines[1].strip() == '' else 1, logger_import)
            else:
                lines.insert(0, logger_import)

        content = '\n'.join(lines)

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"✅ Migrated: {filepath}")
    return True

def main():
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
