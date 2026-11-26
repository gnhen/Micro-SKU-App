export async function createDatabaseTables(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS component_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      required INTEGER DEFAULT 0
    );
  `);

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
}

export async function initializeCategories(db) {
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

  for (const category of categories) {
    await db.runAsync(
      `INSERT OR IGNORE INTO component_categories (name, display_name, order_index, required)
       VALUES (?, ?, ?, ?)`,
      [category.name, category.display_name, category.order_index, category.required]
    );
  }
}

export async function initializeCompatibilityRules(db) {
  const rules = [
    {
      rule_type: 'socket_match',
      component1_category: 'cpu',
      component1_spec_key: 'socket',
      component1_spec_value: 'LGA1700',
      component2_category: 'motherboard',
      component2_spec_key: 'socket',
      component2_spec_value: 'LGA1700',
      compatible: 1,
    },
    {
      rule_type: 'socket_match',
      component1_category: 'cpu',
      component1_spec_key: 'socket',
      component1_spec_value: 'AM5',
      component2_category: 'motherboard',
      component2_spec_key: 'socket',
      component2_spec_value: 'AM5',
      compatible: 1,
    },
    {
      rule_type: 'ram_type',
      component1_category: 'motherboard',
      component1_spec_key: 'memory_type',
      component1_spec_value: 'DDR5',
      component2_category: 'ram',
      component2_spec_key: 'type',
      component2_spec_value: 'DDR5',
      compatible: 1,
    },
    {
      rule_type: 'ram_type',
      component1_category: 'motherboard',
      component1_spec_key: 'memory_type',
      component1_spec_value: 'DDR4',
      component2_category: 'ram',
      component2_spec_key: 'type',
      component2_spec_value: 'DDR4',
      compatible: 1,
    },
    {
      rule_type: 'form_factor',
      component1_category: 'motherboard',
      component1_spec_key: 'form_factor',
      component1_spec_value: 'ATX',
      component2_category: 'case',
      component2_spec_key: 'supported_form_factors',
      component2_spec_value: 'ATX',
      compatible: 1,
    },
  ];

  for (const rule of rules) {
    await db.runAsync(
      `INSERT OR IGNORE INTO compatibility_rules
       (rule_type, component1_category, component1_spec_key, component1_spec_value,
        component2_category, component2_spec_key, component2_spec_value, compatible)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rule.rule_type,
        rule.component1_category,
        rule.component1_spec_key,
        rule.component1_spec_value,
        rule.component2_category,
        rule.component2_spec_key,
        rule.component2_spec_value,
        rule.compatible,
      ]
    );
  }
}
