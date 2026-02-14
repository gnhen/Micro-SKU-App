/**
 * Seed Database Script
 * Populates the database with sample PC components and bundles for testing
 */

import { initDatabase, addComponent, addBundle } from './database';

/**
 * Sample components to seed the database
 */
const sampleComponents = [
  // CPUs
  {
    sku: '679294',
    name: 'Intel Core i7-14700K Raptor Lake 3.4GHz Twenty-Core LGA 1700',
    category: 'cpu',
    brand: 'Intel',
    price: 419.99,
    sale_price: 399.99,
    image_url: 'https://www.microcenter.com/product/679294',
    url: 'https://www.microcenter.com/product/679294',
    specs: {
      socket: 'LGA1700',
      cores: '20',
      threads: '28',
      base_clock: '3.4GHz',
      boost_clock: '5.6GHz',
      tdp: '125W',
    },
  },
  {
    sku: '679292',
    name: 'AMD Ryzen 7 7800X3D Raphael AM5 4.2GHz 8-Core',
    category: 'cpu',
    brand: 'AMD',
    price: 449.99,
    sale_price: 429.99,
    image_url: 'https://www.microcenter.com/product/679292',
    url: 'https://www.microcenter.com/product/679292',
    specs: {
      socket: 'AM5',
      cores: '8',
      threads: '16',
      base_clock: '4.2GHz',
      boost_clock: '5.0GHz',
      tdp: '120W',
    },
  },
  
  // Motherboards
  {
    sku: '676897',
    name: 'ASUS ROG STRIX Z790-E GAMING WIFI Intel LGA 1700 ATX',
    category: 'motherboard',
    brand: 'ASUS',
    price: 429.99,
    sale_price: 399.99,
    image_url: 'https://www.microcenter.com/product/676897',
    url: 'https://www.microcenter.com/product/676897',
    specs: {
      socket: 'LGA1700',
      form_factor: 'ATX',
      memory_type: 'DDR5',
      max_memory: '128GB',
      chipset: 'Z790',
    },
  },
  {
    sku: '676895',
    name: 'MSI MAG B650 TOMAHAWK WIFI AM5 ATX Motherboard',
    category: 'motherboard',
    brand: 'MSI',
    price: 219.99,
    sale_price: 199.99,
    image_url: 'https://www.microcenter.com/product/676895',
    url: 'https://www.microcenter.com/product/676895',
    specs: {
      socket: 'AM5',
      form_factor: 'ATX',
      memory_type: 'DDR5',
      max_memory: '128GB',
      chipset: 'B650',
    },
  },

  // RAM
  {
    sku: '679123',
    name: 'G.Skill Trident Z5 RGB 32GB (2 x 16GB) DDR5-6000',
    category: 'ram',
    brand: 'G.Skill',
    price: 139.99,
    sale_price: 129.99,
    image_url: 'https://www.microcenter.com/product/679123',
    url: 'https://www.microcenter.com/product/679123',
    specs: {
      type: 'DDR5',
      capacity: '32GB',
      speed: '6000MHz',
      modules: '2x16GB',
      cas_latency: 'CL30',
    },
  },
  {
    sku: '679124',
    name: 'Corsair Vengeance 32GB (2 x 16GB) DDR5-5600',
    category: 'ram',
    brand: 'Corsair',
    price: 119.99,
    sale_price: 109.99,
    image_url: 'https://www.microcenter.com/product/679124',
    url: 'https://www.microcenter.com/product/679124',
    specs: {
      type: 'DDR5',
      capacity: '32GB',
      speed: '5600MHz',
      modules: '2x16GB',
      cas_latency: 'CL36',
    },
  },

  // GPUs
  {
    sku: '679456',
    name: 'NVIDIA GeForce RTX 4070 Ti SUPER Founders Edition',
    category: 'gpu',
    brand: 'NVIDIA',
    price: 799.99,
    sale_price: null,
    image_url: 'https://www.microcenter.com/product/679456',
    url: 'https://www.microcenter.com/product/679456',
    specs: {
      chipset: 'RTX 4070 Ti SUPER',
      memory: '16GB GDDR6X',
      interface: 'PCIe 4.0',
      tdp: '285W',
    },
  },
  {
    sku: '679457',
    name: 'AMD Radeon RX 7800 XT 16GB GDDR6',
    category: 'gpu',
    brand: 'AMD',
    price: 549.99,
    sale_price: 529.99,
    image_url: 'https://www.microcenter.com/product/679457',
    url: 'https://www.microcenter.com/product/679457',
    specs: {
      chipset: 'RX 7800 XT',
      memory: '16GB GDDR6',
      interface: 'PCIe 4.0',
      tdp: '263W',
    },
  },

  // Storage
  {
    sku: '679234',
    name: 'Samsung 990 PRO 2TB PCIe Gen 4 NVMe M.2',
    category: 'storage',
    brand: 'Samsung',
    price: 199.99,
    sale_price: 179.99,
    image_url: 'https://www.microcenter.com/product/679234',
    url: 'https://www.microcenter.com/product/679234',
    specs: {
      capacity: '2TB',
      interface: 'NVMe PCIe Gen 4',
      form_factor: 'M.2 2280',
      read_speed: '7450MB/s',
      write_speed: '6900MB/s',
    },
  },

  // PSU
  {
    sku: '679345',
    name: 'Corsair RM850x 850W 80 Plus Gold Modular ATX',
    category: 'psu',
    brand: 'Corsair',
    price: 149.99,
    sale_price: 139.99,
    image_url: 'https://www.microcenter.com/product/679345',
    url: 'https://www.microcenter.com/product/679345',
    specs: {
      wattage: '850W',
      efficiency: '80 Plus Gold',
      modular: 'Full',
      form_factor: 'ATX',
    },
  },

  // Case
  {
    sku: '679567',
    name: 'NZXT H7 Flow Mid-Tower ATX Case',
    category: 'case',
    brand: 'NZXT',
    price: 129.99,
    sale_price: 119.99,
    image_url: 'https://www.microcenter.com/product/679567',
    url: 'https://www.microcenter.com/product/679567',
    specs: {
      form_factor: 'Mid-Tower',
      supported_form_factors: 'ATX,mATX,Mini-ITX',
      max_gpu_length: '400mm',
      max_cpu_cooler_height: '185mm',
    },
  },

  // Cooler
  {
    sku: '679678',
    name: 'Noctua NH-D15 chromax.black CPU Cooler',
    category: 'cooler',
    brand: 'Noctua',
    price: 119.99,
    sale_price: null,
    image_url: 'https://www.microcenter.com/product/679678',
    url: 'https://www.microcenter.com/product/679678',
    specs: {
      type: 'Air Cooler',
      compatibility: 'LGA1700,AM5,AM4',
      height: '165mm',
      tdp_rating: '250W',
    },
  },
];

/**
 * Sample bundles with component SKUs
 */
const sampleBundles = [
  {
    bundle: {
      name: 'Intel Gaming Build - RTX 4070 Ti',
      description: 'High-performance Intel gaming PC with RTX 4070 Ti',
      total_price: 2399.89,
      bundle_price: 2199.89,
      savings: 200.00,
      url: 'https://www.microcenter.com/site/content/bundle-and-save.aspx',
    },
    components: ['679294', '676897', '679123', '679456', '679234', '679345', '679567', '679678'],
  },
  {
    bundle: {
      name: 'AMD Gaming Build - RX 7800 XT',
      description: 'Excellent AMD gaming build with Ryzen 7 7800X3D',
      total_price: 1979.88,
      bundle_price: 1849.88,
      savings: 130.00,
      url: 'https://www.microcenter.com/site/content/bundle-and-save.aspx',
    },
    components: ['679292', '676895', '679124', '679457', '679234', '679345', '679567'],
  },
];

/**
 * Seed the database
 */
export const seedDatabase = async () => {
  console.log('Starting database seed...');
  
  try {
    await initDatabase();
    
    // Add components
    console.log(`Adding ${sampleComponents.length} components...`);
    const componentIds = {};
    
    for (const component of sampleComponents) {
      try {
        const id = await addComponent(component);
        componentIds[component.sku] = id;
        console.log(`✓ Added ${component.name}`);
      } catch (error) {
        console.warn(`⚠ Skipped ${component.name}: ${error.message}`);
      }
    }
    
    // Add bundles
    console.log(`\nAdding ${sampleBundles.length} bundles...`);
    
    for (const { bundle, components } of sampleBundles) {
      try {
        const id = await addBundle(bundle, components);
        console.log(`✓ Added bundle: ${bundle.name}`);
      } catch (error) {
        console.warn(`⚠ Skipped bundle ${bundle.name}: ${error.message}`);
      }
    }
    
    console.log('\n✅ Database seeded successfully!');
    console.log(`\nAdded:`);
    console.log(`  - ${Object.keys(componentIds).length} components`);
    console.log(`  - ${sampleBundles.length} bundles`);
    
    return {
      success: true,
      componentsAdded: Object.keys(componentIds).length,
      bundlesAdded: sampleBundles.length,
    };
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
};

export default { seedDatabase };
