const warnWebOnly = (method) => {
  console.warn(`[database] ${method} is not available on web; using no-op fallback.`);
};

export const initDatabase = async () => {
  warnWebOnly('initDatabase');
  return null;
};

export const addComponent = async (component) => {
  warnWebOnly('addComponent');
  return { id: Date.now(), ...component };
};

export const getComponentsByCategory = async () => {
  warnWebOnly('getComponentsByCategory');
  return [];
};

export const getCompatibleComponents = async () => {
  warnWebOnly('getCompatibleComponents');
  return [];
};

export const addBundle = async (bundle) => {
  warnWebOnly('addBundle');
  return { id: Date.now(), ...bundle };
};

export const getAllBundles = async () => {
  warnWebOnly('getAllBundles');
  return [];
};

export const detectBundle = async () => {
  warnWebOnly('detectBundle');
  return null;
};

export const createBuild = async (name, notes = '') => {
  warnWebOnly('createBuild');
  return { id: Date.now(), name, notes, components: [] };
};

export const addComponentToBuild = async () => {
  warnWebOnly('addComponentToBuild');
  return null;
};

export const removeComponentFromBuild = async () => {
  warnWebOnly('removeComponentFromBuild');
  return null;
};

export const getBuild = async () => {
  warnWebOnly('getBuild');
  return null;
};

export const getAllBuilds = async () => {
  warnWebOnly('getAllBuilds');
  return [];
};

export const deleteBuild = async () => {
  warnWebOnly('deleteBuild');
  return null;
};

export const getCategories = async () => {
  warnWebOnly('getCategories');
  return [
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
};
