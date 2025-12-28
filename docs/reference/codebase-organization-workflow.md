# Codebase Organization Workflow

**Purpose**: Reference guide for organizing and cleaning up codebase files without refactoring core architecture.

**Last Updated**: December 28, 2024  
**Used For**: Documentation reorganization, script organization, file archiving

---

## Overview

This workflow provides a systematic, safe approach to organizing files in the codebase. It emphasizes:
- **Zero content loss** through checksum verification
- **Atomic operations** with rollback capability
- **Reference updates** to maintain codebase integrity
- **Clear categorization** for better maintainability

---

## When to Use This Workflow

Use this workflow when:
- Files are scattered across directories and need logical organization
- Historical documentation needs to be separated from active docs
- Scripts or utilities need better categorization
- Root directory has accumulated files that belong elsewhere
- You need to archive old files without losing them

**Do NOT use for:**
- Refactoring code architecture
- Changing file contents or functionality
- Moving files that are actively imported/required by code
- Reorganizing during active development (wait for stable state)

---

## The Workflow: Step-by-Step

### Phase 1: Analysis & Planning

1. **Identify files to organize**
   - List all files in target directory
   - Categorize by purpose/type
   - Identify files to keep vs. archive vs. move

2. **Create file mapping**
   - Map each file to its destination
   - Group by logical categories
   - Note any files that should remain in place

3. **Check for references**
   - Search codebase for hardcoded paths
   - Check documentation for references
   - Identify files that reference moved files

4. **Create organization plan**
   - Document the mapping
   - Note any new directories to create
   - Plan reference updates

### Phase 2: Create Migration Script

Create a TypeScript migration script (`scripts/migrate-[purpose].ts`) with:

**Required Features:**
- Pre-flight checks (verify all source files exist)
- Checksum calculation (SHA-256) for verification
- Directory creation (with verification)
- Atomic file operations (copy → verify → delete)
- Post-migration verification
- Dry-run mode for testing
- Detailed logging
- Error handling (stop on first error)

**Script Template Structure:**
```typescript
#!/usr/bin/env node
/**
 * [Purpose] Migration Script
 * 
 * Safely reorganizes files with checksum verification.
 * 
 * Usage:
 *   pnpm exec tsx scripts/migrate-[purpose].ts [--dry-run]
 */

import { createHash } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, statSync } from 'fs';
import { join, dirname } from 'path';

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT_DIR = process.cwd();
const MANIFEST_PATH = join(ROOT_DIR, '.migration-manifest.json');

// File mapping: source -> destination directory
const FILE_MAPPING: Record<string, string> = {
  // Define mappings here
};

// Implementation follows standard pattern:
// 1. Pre-flight checks
// 2. Calculate checksums
// 3. Create directories
// 4. Migrate files (copy → verify → delete)
// 5. Post-migration verification
// 6. Report results
```

### Phase 3: Execute Migration

1. **Dry-run first**
   ```bash
   pnpm exec tsx scripts/migrate-[purpose].ts --dry-run
   ```
   - Verify all files found
   - Check destination paths
   - Confirm no errors

2. **Execute migration**
   ```bash
   pnpm exec tsx scripts/migrate-[purpose].ts
   ```
   - Monitor output for errors
   - Verify checksums match
   - Confirm files moved successfully

3. **Verify results**
   - Check file counts match expected
   - Spot-check a few files for content integrity
   - Verify no files remain in original location (if intended)

### Phase 4: Update References

1. **Search for references**
   ```bash
   grep -r "old-path" --include="*.md" --include="*.ts" --include="*.tsx"
   ```

2. **Update references**
   - Documentation files
   - Script comments/usage examples
   - Configuration files
   - README files

3. **Verify no broken links**
   - Check all updated references
   - Test any scripts that reference moved files

### Phase 5: Cleanup & Commit

1. **Delete migration artifacts**
   - Remove migration script
   - Remove manifest file (unless rollback needed)

2. **Commit changes**
   ```bash
   git add -A
   git commit -m "chore: [description of organization]
   
   - Moved X files to [destination]
   - Created [new directories]
   - Updated references in [files]
   - Zero content loss verified with checksums"
   ```

3. **Push to remote**
   ```bash
   git push
   ```

---

## Safety Measures

### 1. Checksum Verification
- Calculate SHA-256 checksum before move
- Verify checksum after copy
- Only delete original after successful verification
- Report any mismatches immediately

### 2. Atomic Operations
- Copy file to destination first
- Verify destination file exists and matches checksum
- Only then delete source file
- If verification fails, keep original and report error

### 3. Backup Manifest
- Create JSON manifest with:
  - Original paths
  - New paths
  - Checksums
  - File sizes
  - Timestamp
- Store in `.migration-manifest.json` (or similar)
- Enables rollback if needed

### 4. Dry-Run Mode
- Always test with `--dry-run` first
- Shows what would happen without making changes
- Catches errors before actual migration

### 5. Error Handling
- Stop on first error
- Don't proceed if verification fails
- Log all errors with context
- Provide clear error messages

---

## Examples from Today's Work

### Example 1: Documentation Reorganization

**Scenario**: 22 documentation files in `/docs` root needed organization

**Approach**:
- Created 6 new subdirectories: `content/`, `design/`, `testing/`, `security/`, `reference/`, `features/`
- Mapped files by purpose
- Created `scripts/migrate-docs.ts`
- Verified all checksums matched
- Updated 8 files with references

**Result**: Clean, organized structure with zero content loss

### Example 2: Root Markdown Files

**Scenario**: 17 markdown files in root, some historical

**Approach**:
- Kept 6 essential files in root
- Archived 11 files to appropriate subdirectories
- Created `archived/` subdirectories for historical docs
- Updated `.prettierignore` reference
- Updated documentation references

**Result**: Clean root directory, historical docs properly archived

### Example 3: Scripts Organization

**Scenario**: 8 scripts in `/scripts` root needed categorization

**Approach**:
- Created `scripts/test/` for test scripts (5 files)
- Created `scripts/debug/` for debug utilities (3 files)
- Updated script self-references
- Updated documentation references

**Result**: Better organization, easier to find scripts

---

## Best Practices

### File Categorization

**Keep in root:**
- Essential project files (README.md, PRD.md, package.json)
- Active configuration files
- Files frequently referenced by developers

**Organize into subdirectories:**
- Group by purpose (content, design, testing, etc.)
- Group by type (scripts/test/, scripts/debug/)
- Group by status (archived/, active/)

**Archive historical files:**
- Create `archived/` subdirectories
- Clearly mark as historical
- Keep for reference but separate from active docs

### Directory Naming

- Use lowercase with hyphens: `test-plan.md` not `TestPlan.md`
- Be descriptive: `scripts/debug/` not `scripts/d/`
- Use plural for collections: `scripts/test/` not `scripts/test-script/`

### Reference Updates

- Always search for references before moving files
- Update:
  - Documentation files
  - Script usage examples
  - Configuration files
  - README files
- Verify no broken links after updates

### Commit Messages

Use clear, descriptive commit messages:
```
chore: organize [what] into [where]

- Moved X files to [destination]
- Created [new directories]
- Updated references in [files]
- Zero content loss verified with checksums
```

---

## Troubleshooting

### Issue: Checksum Mismatch

**Symptom**: Verification fails after copy

**Solution**:
- Check file permissions
- Verify disk space
- Check for concurrent modifications
- Review error logs for details

### Issue: Files Still in Original Location

**Symptom**: Migration reports success but files remain

**Solution**:
- Check if files were actually deleted
- Verify migration script completed fully
- Check for permission issues
- Review script logs

### Issue: Broken References

**Symptom**: References to moved files don't work

**Solution**:
- Search codebase for all references
- Update paths in all files
- Test scripts/commands that use references
- Verify documentation links

### Issue: Migration Script Errors

**Symptom**: Script fails during execution

**Solution**:
- Check dry-run output first
- Verify all source files exist
- Check directory permissions
- Review error messages carefully
- Use manifest for rollback if needed

---

## Rollback Procedure

If migration needs to be reversed:

1. **Check manifest file**
   ```bash
   cat .migration-manifest.json
   ```

2. **Restore files manually** (or create rollback script)
   - Read manifest for original paths
   - Copy files back to original locations
   - Verify checksums match
   - Delete files from new locations

3. **Revert git commit** (if already committed)
   ```bash
   git revert <commit-hash>
   ```

---

## Checklist

Before starting:
- [ ] Identify all files to organize
- [ ] Create file mapping
- [ ] Check for references
- [ ] Plan directory structure

During migration:
- [ ] Create migration script
- [ ] Run dry-run successfully
- [ ] Execute migration
- [ ] Verify checksums match
- [ ] Update all references
- [ ] Test updated references

After migration:
- [ ] Delete migration script
- [ ] Delete manifest (if not needed)
- [ ] Commit changes
- [ ] Push to remote
- [ ] Verify final structure

---

## Related Documents

- `AGENTS.md` - Project context and conventions
- `PRD.md` - Product requirements
- `docs/epics/` - Epic documentation
- `docs/testing/test-plan.md` - Testing documentation

---

## Notes

- This workflow is designed for **organizational changes only**
- **Never** modify file contents during migration
- **Always** verify checksums before and after
- **Always** update references after moving files
- **Always** test with dry-run first

When in doubt, be conservative. It's better to move fewer files correctly than many files incorrectly.
