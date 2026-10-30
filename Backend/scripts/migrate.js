
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db.js';

const fileName = fileURLToPath(import.meta.url);
const dirName = path.dirname(fileName);

const DROP_ALL = `
    DROP TABLE IF EXISTS ai_insights CASCADE;
    DROP TABLE IF EXISTS budgets CASCADE;
    DROP TABLE IF EXISTS transactions CASCADE;
    DROP TABLE IF EXISTS categories CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
`;

const runMigration = async () => {
    const shouldReset = process.argv.includes('--reset');

    const schemaPath = path.join(
        dirName,
        '..',
        'sql',
        'schema.sql'
    );

    try {
        if (shouldReset) {
            console.log('Dropping existing tables...');

            await pool.query(DROP_ALL);

            console.log('Existing tables dropped successfully.');
        }

        console.log(`Reading schema from: ${schemaPath}`);

        const schema = await fs.readFile(schemaPath, 'utf-8');

        console.log('Running migration...');

        await pool.query(schema);

        console.log('Migration completed successfully!');
        console.log('Tables and indexes created.');

    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exitCode = 1;

    } finally {
        await pool.end();
    }
};

runMigration();
