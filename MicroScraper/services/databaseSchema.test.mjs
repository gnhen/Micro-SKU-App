import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDatabaseTables,
  initializeCategories,
  initializeCompatibilityRules,
} from './databaseSchema.mjs';

test('initializes PC Builder tables and seed data through the provided database handle', async () => {
  const schemaStatements = [];
  const insertStatements = [];
  const db = {
    async execAsync(statement) {
      schemaStatements.push(statement);
    },
    async runAsync(statement, values) {
      insertStatements.push({ statement, values });
    },
  };

  await createDatabaseTables(db);
  await initializeCategories(db);
  await initializeCompatibilityRules(db);

  assert.equal(schemaStatements.length, 8);
  for (const table of [
    'component_categories',
    'components',
    'component_specs',
    'compatibility_rules',
    'bundles',
    'bundle_components',
    'user_builds',
    'build_components',
  ]) {
    assert.ok(schemaStatements.some(statement => statement.includes(`CREATE TABLE IF NOT EXISTS ${table}`)));
  }

  const categoryInserts = insertStatements.filter(({ statement }) =>
    statement.includes('INSERT OR IGNORE INTO component_categories')
  );
  const compatibilityInserts = insertStatements.filter(({ statement }) =>
    statement.includes('INSERT OR IGNORE INTO compatibility_rules')
  );
  assert.equal(categoryInserts.length, 10);
  assert.equal(compatibilityInserts.length, 5);
  assert.equal(insertStatements.length, 15);
});
