#!/usr/bin/env node

// scripts/migrate-z-index.js
// Script pour identifier et proposer des remplacements des z-index hardcodés

const fs = require('fs');
const path = require('path');

// Patterns de z-index à rechercher
const patterns = [
    /z-\[(\d+)\]/g,
    /z-(\d+)\b/g,
    /zIndex:\s*(\d+)/g,
    /z-index:\s*(\d+)/g,
];

// Mapping des valeurs courantes vers les nouveaux tokens
const migrations = {
    '0': 'Z_INDEX_CLASSES.base',
    '1': 'Z_INDEX_CLASSES.content.raised',
    '5': 'Z_INDEX_CLASSES.content.sticky',
    '10': 'Z_INDEX_CLASSES.interactive.dropdown',
    '15': 'Z_INDEX_CLASSES.interactive.tooltip',
    '20': 'Z_INDEX_CLASSES.interactive.popover',
    '50': 'Z_INDEX_CLASSES.navigation.header',
    '55': 'Z_INDEX_CLASSES.navigation.sidebar',
    '60': 'Z_INDEX_CLASSES.navigation.mobileMenu',
    '90': 'Z_INDEX_CLASSES.overlay.backdrop',
    '100': 'Z_INDEX_CLASSES.overlay.modal',
    '110': 'Z_INDEX_CLASSES.overlay.sheet',
    '120': 'Z_INDEX_CLASSES.overlay.drawer',
    '500': 'Z_INDEX_CLASSES.system.toast',
    '900': 'Z_INDEX_CLASSES.system.loading',
    '999': 'Z_INDEX_CLASSES.system.debug',
    '9999': 'Z_INDEX_CLASSES.emergency',
};

function scanFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const issues = [];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const value = match[1];
                const suggestion = migrations[value] || `MANUAL_REVIEW_NEEDED (${value})`;

                issues.push({
                    file: filePath,
                    line: getLineNumber(content, match.index),
                    original: match[0],
                    value: value,
                    suggestion: suggestion,
                    needsReview: !migrations[value]
                });
            }
            pattern.lastIndex = 0; // Reset regex
        });

        return issues;
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error.message);
        return [];
    }
}

function getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
}

function scanDirectory(dir) {
    const issues = [];

    function walkDir(currentPath) {
        const items = fs.readdirSync(currentPath, { withFileTypes: true });

        for (const item of items) {
            const fullPath = path.join(currentPath, item.name);

            if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
                walkDir(fullPath);
            } else if (item.isFile() && /\.(tsx?|jsx?|css|scss)$/.test(item.name)) {
                issues.push(...scanFile(fullPath));
            }
        }
    }

    walkDir(dir);
    return issues;
}

function generateReport(issues) {
    console.log('\n🔍 Z-Index Migration Analysis\n');
    console.log('=====================================\n');

    if (issues.length === 0) {
        console.log('✅ No hardcoded z-index values found!\n');
        return;
    }

    // Group by file
    const fileGroups = {};
    issues.forEach(issue => {
        if (!fileGroups[issue.file]) {
            fileGroups[issue.file] = [];
        }
        fileGroups[issue.file].push(issue);
    });

    Object.keys(fileGroups).forEach(file => {
        const relativeFile = path.relative(process.cwd(), file);
        console.log(`📁 ${relativeFile}`);
        console.log('─'.repeat(relativeFile.length + 2));

        fileGroups[file].forEach(issue => {
            const status = issue.needsReview ? '⚠️' : '✨';
            console.log(`${status} Line ${issue.line}: ${issue.original}`);
            console.log(`   Suggested: ${issue.suggestion}`);
            if (issue.needsReview) {
                console.log('   ⚠️  Manual review required - uncommon z-index value');
            }
            console.log('');
        });
    });

    // Summary
    const needsReview = issues.filter(i => i.needsReview).length;
    const canMigrate = issues.length - needsReview;

    console.log('\n📊 Summary');
    console.log('===========');
    console.log(`Total issues found: ${issues.length}`);
    console.log(`Can auto-migrate: ${canMigrate}`);
    console.log(`Need manual review: ${needsReview}`);

    if (canMigrate > 0) {
        console.log('\n📝 Next Steps:');
        console.log('1. Import Z_INDEX_CLASSES in files that need migration');
        console.log('2. Replace hardcoded values with suggested tokens');
        console.log('3. Test that layering behavior is preserved');
        console.log('4. Review and assign appropriate tokens for values needing manual review');
    }
}

// Main execution
const srcDir = path.join(process.cwd(), 'nextjs', 'src');

console.log('🚀 Scanning for hardcoded z-index values...');
console.log(`📂 Directory: ${srcDir}\n`);

const issues = scanDirectory(srcDir);
generateReport(issues);

module.exports = { scanFile, scanDirectory, migrations };