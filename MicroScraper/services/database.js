import * as SQLite from 'expo-sqlite';

// Database initialization
let db = null;

export const initDatabase = async () => {
  if (!db) {
    db = await SQLite.openDatabaseAsync('pcbuilder.db');
    await createTables();
  }
  return db;
};

// Create database schema
const createTables = async () => {
  // Component categories table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS component_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      required INTEGER DEFAULT 0
    );
  `);

  // Components table - stores all PC parts
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS components (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      brand TEXT,
      price REAL,
      sale_price REAL,
      image_url TEXT,
      url TEXT,
      specs TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (category_id) REFERENCES component_categories(id)
    );
  `);

  // Component specifications table (for filtering/compatibility)
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS component_specs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      component_id INTEGER NOT NULL,
      spec_key TEXT NOT NULL,
      spec_value TEXT NOT NULL,
      FOREIGN KEY (component_id) REFERENCES components(id),
      UNIQUE(component_id, spec_key)
    );
  `);

  // Compatibility rules table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS compatibility_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_type TEXT NOT NULL,
      component1_category TEXT NOT NULL,
      component1_spec_key TEXT NOT NULL,
      component1_spec_value TEXT NOT NULL,
      component2_category TEXT NOT NULL,
      component2_spec_key TEXT NOT NULL,
      component2_spec_value TEXT NOT NULL,
      compatible INTEGER DEFAULT 1
    );
  `);

  // Bundles table - stores pre-configured bundles
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS bundles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      total_price REAL,
      bundle_price REAL,
      savings REAL,
      url TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `);

  // Bundle components - links components to bundles
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS bundle_components (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bundle_id INTEGER NOT NULL,
      component_id INTEGER NOT NULL,
      FOREIGN KEY (bundle_id) REFERENCES bundles(id),
      FOREIGN KEY (component_id) REFERENCES components(id),
      UNIQUE(bundle_id, component_id)
    );
  `);

  // User builds table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_builds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      notes TEXT,
      total_price REAL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `);

  // Build components - links components to user builds
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS build_components (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      build_id INTEGER NOT NULL,
      component_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      FOREIGN KEY (build_id) REFERENCES user_builds(id),
      FOREIGN KEY (component_id) REFERENCES components(id),
      FOREIGN KEY (category_id) REFERENCES component_categories(id),
      UNIQUE(build_id, category_id, component_id)
    );
  `);

  // Initialize default categories
  await initializeCategories();
  
  // Initialize basic compatibility rules
  await initializeCompatibilityRules();
};

// Initialize component categories
const initializeCategories = async () => {
  const categories = [
    { name: 'cpu', display_name: 'CPU (Processor)', order_index: 1, required: 1 },
    { name: 'motherboard', display_name: 'Motherboard', order_index: 2, required: 1 },
    { name: 'ram', display_name: 'Memory (RAM)', order_index: 3, required: 1 },
    { name: 'gpu', display_name: 'Graphics Card', order_index: 4, required: 0 },
    { name: 'storage', display_name: 'Storage', order_index: 5, required: 1 },
    { name: 'psu', display_name: 'Power Supply', order_index: 6, required: 1 },
    { name: 'case', display_name: 'Case', order_index: 7, required: 1 },
    { name: 'cooler', display_name: 'CPU Cooler', order_index: 8, required: 0 },
    { name: 'case_fans', display_name: 'Case Fans', order_index: 9, required: 0 },
    { name: 'os', display_name: 'Operating System', order_index: 10, required: 0 },
  ];

  for (const cat of categories) {
    await db.runAsync(
      `INSERT OR IGNORE INTO component_categories (name, display_name, order_index, required) 
       VALUES (?, ?, ?, ?)`,
      [cat.name, cat.display_name, cat.order_index, cat.required]
    );
  }
};

// Initialize basic compatibility rules
const initializeCompatibilityRules = async () => {
  const rules = [
    // CPU socket compatibility
    {
      rule_type: 'socket_match',
      component1_category: 'cpu',
      component1_spec_key: 'socket',
      component1_spec_value: 'LGA1700',
      component2_category: 'motherboard',
      component2_spec_key: 'socket',
      component2_spec_value: 'LGA1700',
      compatible: 1
    },
    {
      rule_type: 'socket_match',
      component1_category: 'cpu',
      component1_spec_key: 'socket',
      component1_spec_value: 'AM5',
      component2_category: 'motherboard',
      component2_spec_key: 'socket',
      component2_spec_value: 'AM5',
      compatible: 1
    },
    // RAM type compatibility
    {
      rule_type: 'ram_type',
      component1_category: 'motherboard',
      component1_spec_key: 'memory_type',
      component1_spec_value: 'DDR5',
      component2_category: 'ram',
      component2_spec_key: 'type',
      component2_spec_value: 'DDR5',
      compatible: 1
    },
    {
      rule_type: 'ram_type',
      component1_category: 'motherboard',
      component1_spec_key: 'memory_type',
      component1_spec_value: 'DDR4',
      component2_category: 'ram',
      component2_spec_key: 'type',
      component2_spec_value: 'DDR4',
      compatible: 1
    },
    // Form factor compatibility
    {
      rule_type: 'form_factor',
      component1_category: 'motherboard',
      component1_spec_key: 'form_factor',
      component1_spec_value: 'ATX',
      component2_category: 'case',
      component2_spec_key: 'supported_form_factors',
      component2_spec_value: 'ATX',
      compatible: 1
    },
  ];

  for (const rule of rules) {
    await db.runAsync(
      `INSERT OR IGNORE INTO compatibility_rules 
       (rule_type, component1_category, component1_spec_key, component1_spec_value, 
        component2_category, component2_spec_key, component2_spec_value, compatible)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [rule.rule_type, rule.component1_category, rule.component1_spec_key, rule.component1_spec_value,
       rule.component2_category, rule.component2_spec_key, rule.component2_spec_value, rule.compatible]
    );
  }
};

// ===== COMPONENT CRUD OPERATIONS =====

export const addComponent = async (component) => {
  const db = await initDatabase();
  
  // Get category ID
  const category = await db.getFirstAsync(
    'SELECT id FROM component_categories WHERE name = ?',
    [component.category]
  );
  
  if (!category) {
    throw new Error(`Unknown category: ${component.category}`);
  }

  // Insert component
  const result = await db.runAsync(
    `INSERT INTO components (sku, name, category_id, brand, price, sale_price, image_url, url, specs)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [component.sku, component.name, category.id, component.brand, component.price, 
     component.sale_price, component.image_url, component.url, JSON.stringify(component.specs || {})]
  );

  // Insert component specs for filtering
  if (component.specs && typeof component.specs === 'object') {
    for (const [key, value] of Object.entries(component.specs)) {
      await db.runAsync(
        `INSERT OR REPLACE INTO component_specs (component_id, spec_key, spec_value)
         VALUES (?, ?, ?)`,
        [result.lastInsertRowId, key, String(value)]
      );
    }
  }

  return result.lastInsertRowId;
};

export const getComponentsByCategory = async (categoryName) => {
  const db = await initDatabase();
  
  const components = await db.getAllAsync(
    `SELECT c.* FROM components c
     JOIN component_categories cat ON c.category_id = cat.id
     WHERE cat.name = ?
     ORDER BY c.name`,
    [categoryName]
  );

  // Parse specs JSON
  return components.map(c => ({
    ...c,
    specs: c.specs ? JSON.parse(c.specs) : {}
  }));
};

export const getCompatibleComponents = async (categoryName, existingComponents) => {
  const db = await initDatabase();
  
  // If no existing components, return all for this category
  if (!existingComponents || existingComponents.length === 0) {
    return await getComponentsByCategory(categoryName);
  }

  // Get all components in the category
  let allComponents = await getComponentsByCategory(categoryName);

  // Filter based on compatibility rules
  for (const existing of existingComponents) {
    allComponents = await filterCompatible(db, allComponents, existing, categoryName);
  }

  return allComponents;
};

const filterCompatible = async (db, candidateComponents, existingComponent, targetCategory) => {
  // Get existing component's category and specs
  const existingCat = await db.getFirstAsync(
    `SELECT cat.name FROM component_categories cat
     JOIN components c ON c.category_id = cat.id
     WHERE c.id = ?`,
    [existingComponent.id]
  );

  const existingSpecs = await db.getAllAsync(
    `SELECT spec_key, spec_value FROM component_specs WHERE component_id = ?`,
    [existingComponent.id]
  );

  // Get compatibility rules between these categories
  const rules = await db.getAllAsync(
    `SELECT * FROM compatibility_rules
     WHERE (component1_category = ? AND component2_category = ?)
        OR (component1_category = ? AND component2_category = ?)`,
    [existingCat.name, targetCategory, targetCategory, existingCat.name]
  );

  if (rules.length === 0) {
    return candidateComponents; // No rules, all compatible
  }

  // Filter components based on rules
  const compatible = [];
  for (const component of candidateComponents) {
    const componentSpecs = await db.getAllAsync(
      `SELECT spec_key, spec_value FROM component_specs WHERE component_id = ?`,
      [component.id]
    );

    let isCompatible = true;
    for (const rule of rules) {
      // Check if specs match the rule
      const hasMatchingExistingSpec = existingSpecs.some(
        s => s.spec_key === rule.component1_spec_key && s.spec_value === rule.component1_spec_value
      );
      const hasMatchingComponentSpec = componentSpecs.some(
        s => s.spec_key === rule.component2_spec_key && s.spec_value === rule.component2_spec_value
      );

      if (hasMatchingExistingSpec && !hasMatchingComponentSpec) {
        isCompatible = false;
        break;
      }
    }

    if (isCompatible) {
      compatible.push(component);
    }
  }

  return compatible;
};

// ===== BUNDLE OPERATIONS =====

export const addBundle = async (bundle, componentSkus) => {
  const db = await initDatabase();
  
  const result = await db.runAsync(
    `INSERT INTO bundles (name, description, total_price, bundle_price, savings, url)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [bundle.name, bundle.description, bundle.total_price, bundle.bundle_price, bundle.savings, bundle.url]
  );

  const bundleId = result.lastInsertRowId;

  // Link components to bundle
  for (const sku of componentSkus) {
    const component = await db.getFirstAsync(
      'SELECT id FROM components WHERE sku = ?',
      [sku]
    );
    
    if (component) {
      await db.runAsync(
        `INSERT INTO bundle_components (bundle_id, component_id) VALUES (?, ?)`,
        [bundleId, component.id]
      );
    }
  }

  return bundleId;
};

export const getAllBundles = async () => {
  const db = await initDatabase();
  
  const bundles = await db.getAllAsync('SELECT * FROM bundles ORDER BY created_at DESC');
  
  // Get components for each bundle
  for (const bundle of bundles) {
    const components = await db.getAllAsync(
      `SELECT c.* FROM components c
       JOIN bundle_components bc ON bc.component_id = c.id
       WHERE bc.bundle_id = ?`,
      [bundle.id]
    );
    bundle.components = components.map(c => ({
      ...c,
      specs: c.specs ? JSON.parse(c.specs) : {}
    }));
  }

  return bundles;
};

export const detectBundle = async (componentIds) => {
  const db = await initDatabase();
  
  // Find bundles that contain all these components
  const bundles = await db.getAllAsync(
    `SELECT b.*, COUNT(DISTINCT bc.component_id) as matched_count,
            (SELECT COUNT(*) FROM bundle_components WHERE bundle_id = b.id) as total_count
     FROM bundles b
     JOIN bundle_components bc ON bc.bundle_id = b.id
     WHERE bc.component_id IN (${componentIds.map(() => '?').join(',')})
     GROUP BY b.id
     HAVING matched_count = total_count`,
    componentIds
  );

  return bundles;
};

// ===== USER BUILD OPERATIONS =====

export const createBuild = async (name, notes = '') => {
  const db = await initDatabase();
  
  const result = await db.runAsync(
    `INSERT INTO user_builds (name, notes, total_price) VALUES (?, ?, ?)`,
    [name, notes, 0]
  );

  return result.lastInsertRowId;
};

export const addComponentToBuild = async (buildId, componentId, categoryName, quantity = 1) => {
  const db = await initDatabase();
  
  const category = await db.getFirstAsync(
    'SELECT id FROM component_categories WHERE name = ?',
    [categoryName]
  );

  await db.runAsync(
    `INSERT OR REPLACE INTO build_components (build_id, component_id, category_id, quantity)
     VALUES (?, ?, ?, ?)`,
    [buildId, componentId, category.id, quantity]
  );

  // Update build total price
  await updateBuildPrice(buildId);
};

export const removeComponentFromBuild = async (buildId, categoryName) => {
  const db = await initDatabase();
  
  const category = await db.getFirstAsync(
    'SELECT id FROM component_categories WHERE name = ?',
    [categoryName]
  );

  await db.runAsync(
    `DELETE FROM build_components WHERE build_id = ? AND category_id = ?`,
    [buildId, category.id]
  );

  await updateBuildPrice(buildId);
};

const updateBuildPrice = async (buildId) => {
  const db = await initDatabase();
  
  const result = await db.getFirstAsync(
    `SELECT SUM(COALESCE(c.sale_price, c.price) * bc.quantity) as total
     FROM build_components bc
     JOIN components c ON c.id = bc.component_id
     WHERE bc.build_id = ?`,
    [buildId]
  );

  await db.runAsync(
    `UPDATE user_builds SET total_price = ?, updated_at = strftime('%s', 'now') WHERE id = ?`,
    [result?.total || 0, buildId]
  );
};

export const getBuild = async (buildId) => {
  const db = await initDatabase();
  
  const build = await db.getFirstAsync(
    'SELECT * FROM user_builds WHERE id = ?',
    [buildId]
  );

  if (!build) return null;

  // Get all components in the build
  const components = await db.getAllAsync(
    `SELECT c.*, cat.name as category_name, cat.display_name as category_display, bc.quantity
     FROM build_components bc
     JOIN components c ON c.id = bc.component_id
     JOIN component_categories cat ON cat.id = bc.category_id
     WHERE bc.build_id = ?
     ORDER BY cat.order_index`,
    [buildId]
  );

  build.components = components.map(c => ({
    ...c,
    specs: c.specs ? JSON.parse(c.specs) : {}
  }));

  // Check if this build matches any bundles
  const componentIds = components.map(c => c.id);
  build.matchedBundles = await detectBundle(componentIds);

  return build;
};

export const getAllBuilds = async () => {
  const db = await initDatabase();
  
  const builds = await db.getAllAsync(
    'SELECT * FROM user_builds ORDER BY updated_at DESC'
  );

  return builds;
};

export const deleteBuild = async (buildId) => {
  const db = await initDatabase();
  
  await db.runAsync('DELETE FROM build_components WHERE build_id = ?', [buildId]);
  await db.runAsync('DELETE FROM user_builds WHERE id = ?', [buildId]);
};

export const getCategories = async () => {
  const db = await initDatabase();
  return await db.getAllAsync('SELECT * FROM component_categories ORDER BY order_index');
};
