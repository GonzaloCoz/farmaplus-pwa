#!/usr/bin/env node

/**
 * Script to analyze circular dependencies in the project
 * This helps identify potential causes of the Rollup build error
 */

const madge = require('madge');
const path = require('path');

async function analyzeDependencies() {
    console.log('Analyzing project dependencies...\n');

    try {
        const res = await madge(path.join(__dirname, 'src'), {
            fileExtensions: ['ts', 'tsx', 'js', 'jsx'],
            tsConfig: path.join(__dirname, 'tsconfig.json'),
        });

        // Check for circular dependencies
        const circular = res.circular();

        if (circular.length > 0) {
            console.log('⚠️  CIRCULAR DEPENDENCIES FOUND:\n');
            circular.forEach((cycle, index) => {
                console.log(`${index + 1}. ${cycle.join(' → ')}`);
            });
            console.log('\n');
        } else {
            console.log('✅ No circular dependencies found\n');
        }

        // Get dependency tree for problematic files
        const problematicFiles = [
            'src/services/preCountDB.ts',
            'src/hooks/usePreCount.ts',
            'src/pages/PreCount.tsx',
            'src/App.tsx',
        ];

        console.log('Dependency analysis for key files:\n');
        problematicFiles.forEach(file => {
            const deps = res.depends(file);
            if (deps && deps.length > 0) {
                console.log(`${file}:`);
                console.log(`  Dependencies: ${deps.length}`);
                console.log(`  → ${deps.slice(0, 5).join(', ')}${deps.length > 5 ? '...' : ''}\n`);
            }
        });

        // Generate dependency graph image (optional)
        // await res.image('dependency-graph.svg');
        // console.log('Dependency graph saved to dependency-graph.svg');

    } catch (error) {
        console.error('Error analyzing dependencies:', error.message);
    }
}

analyzeDependencies();
