/**
 * Component Category Detection
 * Analyzes product name and specs to determine PC component category
 */

/**
 * Detects component category from product name and specs
 * @param {string} productName - The product name
 * @param {Array} specs - Array of spec objects with label/value
 * @returns {string|null} - Category name or null if not a PC component
 */
export const detectComponentCategory = (productName, specs = []) => {
  const name = productName.toLowerCase();
  const specsText = specs.map(s => `${s.label} ${s.value}`.toLowerCase()).join(' ');
  const fullText = `${name} ${specsText}`;

  // CPU Detection
  if (
    /\b(processor|cpu|core i[3579]|ryzen|threadripper|xeon)\b/i.test(name) ||
    /\b(lga\s*\d+|am[4-5]|socket|cores?|threads?)\b/i.test(specsText)
  ) {
    return 'cpu';
  }

  // Motherboard Detection
  if (
    /\b(motherboard|mobo|mainboard)\b/i.test(name) ||
    /\b(chipset|atx|micro.?atx|mini.?itx|form.?factor)\b/i.test(fullText)
  ) {
    return 'motherboard';
  }

  // RAM Detection
  if (
    /\b(memory|ram|ddr[3-5]|dimm)\b/i.test(name) ||
    /\b(cas.?latency|memory.?speed|mhz.*memory)\b/i.test(specsText)
  ) {
    return 'ram';
  }

  // GPU Detection
  if (
    /\b(graphics?.?card|gpu|geforce|radeon|rtx|gtx|rx\s*\d+|arc)\b/i.test(name) ||
    /\b(vram|cuda.?cores|stream.?processors)\b/i.test(specsText)
  ) {
    return 'gpu';
  }

  // Storage Detection
  if (
    /\b(ssd|nvme|m\.2|hard.?drive|hdd|solid.?state)\b/i.test(name) ||
    /\b(storage.?capacity|[0-9]+gb|[0-9]+tb|sata|pcie.?gen)\b/i.test(fullText)
  ) {
    return 'storage';
  }

  // PSU Detection
  if (
    /\b(power.?supply|psu|watt|modular.?power)\b/i.test(name) ||
    /\b(\d+w\b|80.?plus|efficiency.?rating)\b/i.test(fullText)
  ) {
    return 'psu';
  }

  // Case Detection
  if (
    /\b(case|chassis|tower|enclosure)\b/i.test(name) &&
    !/\b(fan|cable|adapter)\b/i.test(name)
  ) {
    return 'case';
  }

  // CPU Cooler Detection
  if (
    /\b(cooler|heatsink|liquid.?cooling|aio|all.?in.?one)\b/i.test(name) &&
    /\b(cpu|processor|thermal)\b/i.test(fullText)
  ) {
    return 'cooler';
  }

  // Case Fans Detection
  if (
    /\b(fan|fans)\b/i.test(name) &&
    /\b(case|cooling|airflow|static.?pressure|rpm)\b/i.test(fullText)
  ) {
    return 'case_fans';
  }

  // Operating System Detection
  if (
    /\b(windows|operating.?system|os|license)\b/i.test(name) &&
    /\b(home|pro|professional|edition)\b/i.test(fullText)
  ) {
    return 'os';
  }

  return null; // Not a recognized PC component
};

/**
 * Extracts relevant specs for a component category
 * @param {string} category - Component category
 * @param {Array} specs - All product specs
 * @param {string} productName - Product name for additional context
 * @returns {Object} - Extracted specs object
 */
export const extractComponentSpecs = (category, specs = [], productName = '') => {
  const specsObj = {};
  const name = productName.toLowerCase();
  const specsMap = {};
  
  // Create a map of specs
  specs.forEach(spec => {
    const key = spec.label?.toLowerCase() || '';
    const value = spec.value || '';
    specsMap[key] = value;
  });

  switch (category) {
    case 'cpu':
      // Extract socket from name or specs
      const socketMatch = name.match(/\b(lga\s*\d+|am[4-5]|socket\s+[a-z0-9]+)\b/i);
      if (socketMatch) {
        specsObj.socket = socketMatch[1].toUpperCase().replace(/\s+/g, '');
      }
      
      // Extract cores/threads
      const coresMatch = name.match(/(\d+)[-\s]core/i);
      if (coresMatch) specsObj.cores = coresMatch[1];
      
      // Look in specs for common CPU attributes
      Object.keys(specsMap).forEach(key => {
        if (key.includes('socket')) specsObj.socket = specsMap[key];
        if (key.includes('cores')) specsObj.cores = specsMap[key];
        if (key.includes('threads')) specsObj.threads = specsMap[key];
        if (key.includes('base') && key.includes('clock')) specsObj.base_clock = specsMap[key];
        if (key.includes('boost') && key.includes('clock')) specsObj.boost_clock = specsMap[key];
        if (key.includes('tdp')) specsObj.tdp = specsMap[key];
      });
      break;

    case 'motherboard':
      // Extract socket
      const mbSocketMatch = name.match(/\b(lga\s*\d+|am[4-5])\b/i);
      if (mbSocketMatch) {
        specsObj.socket = mbSocketMatch[1].toUpperCase().replace(/\s+/g, '');
      }
      
      // Extract form factor
      const formMatch = name.match(/\b(atx|micro.?atx|mini.?itx|eatx|e-atx)\b/i);
      if (formMatch) {
        specsObj.form_factor = formMatch[1].toUpperCase().replace(/[.-]/g, '');
      }
      
      // Memory type
      const memMatch = name.match(/\b(ddr[3-5])\b/i);
      if (memMatch) {
        specsObj.memory_type = memMatch[1].toUpperCase();
      }
      
      Object.keys(specsMap).forEach(key => {
        if (key.includes('socket')) specsObj.socket = specsMap[key];
        if (key.includes('form') && key.includes('factor')) specsObj.form_factor = specsMap[key];
        if (key.includes('memory') && key.includes('type')) specsObj.memory_type = specsMap[key];
        if (key.includes('chipset')) specsObj.chipset = specsMap[key];
      });
      break;

    case 'ram':
      // Extract type (DDR4/DDR5)
      const ramTypeMatch = name.match(/\b(ddr[3-5])\b/i);
      if (ramTypeMatch) {
        specsObj.type = ramTypeMatch[1].toUpperCase();
      }
      
      // Extract capacity
      const capacityMatch = name.match(/(\d+)\s*gb/i);
      if (capacityMatch) {
        specsObj.capacity = capacityMatch[1] + 'GB';
      }
      
      // Extract speed
      const speedMatch = name.match(/(\d{4,5})\s*mhz/i);
      if (speedMatch) {
        specsObj.speed = speedMatch[1] + 'MHz';
      }
      
      Object.keys(specsMap).forEach(key => {
        if (key.includes('type') || key.includes('ddr')) specsObj.type = specsMap[key];
        if (key.includes('capacity')) specsObj.capacity = specsMap[key];
        if (key.includes('speed') || key.includes('mhz')) specsObj.speed = specsMap[key];
      });
      break;

    case 'gpu':
      // Extract VRAM
      const vramMatch = name.match(/(\d+)\s*gb/i);
      if (vramMatch) {
        specsObj.vram = vramMatch[1] + 'GB';
      }
      
      Object.keys(specsMap).forEach(key => {
        if (key.includes('memory') || key.includes('vram')) specsObj.vram = specsMap[key];
        if (key.includes('boost') && key.includes('clock')) specsObj.boost_clock = specsMap[key];
      });
      break;

    case 'storage':
      // Extract capacity
      const storageMatch = name.match(/(\d+)\s*(gb|tb)/i);
      if (storageMatch) {
        specsObj.capacity = storageMatch[1] + storageMatch[2].toUpperCase();
      }
      
      // Extract interface
      if (/nvme|m\.2/i.test(name)) {
        specsObj.interface = 'NVMe';
      } else if (/sata/i.test(name)) {
        specsObj.interface = 'SATA';
      }
      
      Object.keys(specsMap).forEach(key => {
        if (key.includes('capacity')) specsObj.capacity = specsMap[key];
        if (key.includes('interface') || key.includes('connection')) specsObj.interface = specsMap[key];
      });
      break;

    case 'psu':
      // Extract wattage
      const wattageMatch = name.match(/(\d+)\s*w\b/i);
      if (wattageMatch) {
        specsObj.wattage = wattageMatch[1] + 'W';
      }
      
      // Extract efficiency rating
      const efficiencyMatch = name.match(/80\s*plus\s*(bronze|silver|gold|platinum|titanium)?/i);
      if (efficiencyMatch) {
        specsObj.efficiency = efficiencyMatch[0];
      }
      
      // Modular type
      if (/fully.?modular/i.test(name)) {
        specsObj.modular = 'Fully Modular';
      } else if (/semi.?modular/i.test(name)) {
        specsObj.modular = 'Semi Modular';
      }
      
      Object.keys(specsMap).forEach(key => {
        if (key.includes('wattage') || key.includes('power')) specsObj.wattage = specsMap[key];
        if (key.includes('efficiency')) specsObj.efficiency = specsMap[key];
        if (key.includes('modular')) specsObj.modular = specsMap[key];
      });
      break;

    case 'case':
      // Extract form factor support
      const caseFormMatch = name.match(/\b(atx|micro.?atx|mini.?itx|eatx)\b/i);
      if (caseFormMatch) {
        specsObj.form_factor = caseFormMatch[1].toUpperCase().replace(/[.-]/g, '');
      }
      
      Object.keys(specsMap).forEach(key => {
        if (key.includes('form') && key.includes('factor')) specsObj.form_factor = specsMap[key];
        if (key.includes('color')) specsObj.color = specsMap[key];
      });
      break;

    case 'cooler':
      // Extract socket compatibility
      const coolerSocketMatch = name.match(/\b(lga\s*\d+|am[4-5])\b/i);
      if (coolerSocketMatch) {
        specsObj.socket_support = coolerSocketMatch[1].toUpperCase().replace(/\s+/g, '');
      }
      
      // Type
      if (/aio|liquid|all.?in.?one/i.test(name)) {
        specsObj.type = 'AIO Liquid';
      } else {
        specsObj.type = 'Air';
      }
      break;
  }

  return specsObj;
};
