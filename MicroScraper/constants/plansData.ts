import { ImageSourcePropType } from 'react-native';
import type { Department } from '@/contexts/SettingsContext';

export interface Plan {
  name: string;
  images: ImageSourcePropType[];
}

export const PLANS: Record<string, Plan> = {
  replacements: {
    name: 'Replacements',
    images: [
      require('../assets/plans/replacements/page-1.png'),
      require('../assets/plans/replacements/page-2.png'),
    ],
  },
  carryin: {
    name: 'Carry-In Protection',
    images: [
      require('../assets/plans/carryin/page-1.png'),
      require('../assets/plans/carryin/page-2.png'),
    ],
  },
  prioritycareplus: {
    name: 'Priority Care +',
    images: [
      require('../assets/plans/prioritycareplus/page-1.png'),
      require('../assets/plans/prioritycareplus/page-2.png'),
      require('../assets/plans/prioritycareplus/page-3.png'),
    ],
  },
  dell: {
    name: 'Dell ProSupport',
    images: [
      require('../assets/plans/dell/page-1.png'),
      require('../assets/plans/dell/page-2.png'),
    ],
  },
  dellplus: {
    name: 'Dell ProSupport Plus',
    images: [
      require('../assets/plans/dellplus/page-1.png'),
      require('../assets/plans/dellplus/page-2.png'),
    ],
  },
  newpcupgradesinstallation: {
    name: 'New PC Upgrades & Installation Services',
    images: [
      require('../assets/plans/newpcupgradesinstallation/page-1.png'),
      require('../assets/plans/newpcupgradesinstallation/page-2.png'),
    ],
  },
  notebooks: {
    name: 'Notebooks',
    images: [
      require('../assets/plans/notebooks/page-1.png'),
      require('../assets/plans/notebooks/page-2.png'),
    ],
  },
  desktopsystems: {
    name: 'Desktop Systems',
    images: [
      require('../assets/plans/desktopsystems/page-1.png'),
      require('../assets/plans/desktopsystems/page-2.png'),
    ],
  },
  hdtv: {
    name: 'HDTVs Protection',
    images: [
      require('../assets/plans/hdtv/page-1.png'),
      require('../assets/plans/hdtv/page-2.png'),
    ],
  },
  tablets: {
    name: 'Tablets',
    images: [
      require('../assets/plans/tablets/page-1.png'),
      require('../assets/plans/tablets/page-2.png'),
    ],
  },
  smallelectronicdevices: {
    name: 'Small Electronic Devices',
    images: [
      require('../assets/plans/smallelectronicdevices/page-1.png'),
      require('../assets/plans/smallelectronicdevices/page-2.png'),
    ],
  },
  '3dprinter': {
    name: '3D Printers',
    images: [
      require('../assets/plans/3dprinter/page-1.png'),
      require('../assets/plans/3dprinter/page-2.png'),
    ],
  },
  uicare: {
    name: 'UI Care',
    images: [
      require('../assets/plans/uicare/page-1.png'),
      require('../assets/plans/uicare/page-2.png'),
    ],
  },
  mobilephones: {
    name: 'Mobile Phones',
    images: [
      require('../assets/plans/mobilephones/page-1.png'),
      require('../assets/plans/mobilephones/page-2.png'),
    ],
  },
  apple: {
    name: 'Apple Protection',
    images: [
      require('../assets/plans/apple/page-1.png'),
      require('../assets/plans/apple/page-2.png'),
    ],
  },
  buildyourowncomponents: {
    name: 'Build Your Own Components',
    images: [
      require('../assets/plans/buildyourowncomponents/page-1.png'),
      require('../assets/plans/buildyourowncomponents/page-2.png'),
    ],
  },
  digitalcamerascamcorders: {
    name: 'Digital Cameras/Camcorders',
    images: [
      require('../assets/plans/digitalcamerascamcorders/page-1.png'),
      require('../assets/plans/digitalcamerascamcorders/page-2.png'),
    ],
  },
  harddrivedataprotectionreplacement: {
    name: 'Hard Drive Data Protection & Replacement',
    images: [
      require('../assets/plans/harddrivedataprotectionreplacement/page-1.png'),
      require('../assets/plans/harddrivedataprotectionreplacement/page-2.png'),
    ],
  },
};

const ALL_DEPT_KEYS = ['replacements', 'carryin', 'prioritycareplus'];
const ALL_PLAN_KEYS = Object.keys(PLANS);

const DEPARTMENT_PLAN_KEYS: Record<Department, string[]> = {
  'General Sales':  [...ALL_DEPT_KEYS, 'tablets', 'smallelectronicdevices', '3dprinter', 'uicare', 'mobilephones'],
  'Build Your Own': [...ALL_DEPT_KEYS, 'buildyourowncomponents', 'digitalcamerascamcorders'],
  'Systems':        [...ALL_DEPT_KEYS, 'dell', 'dellplus', 'newpcupgradesinstallation', 'notebooks', 'desktopsystems', 'hdtv'],
  'Apple':          [...ALL_DEPT_KEYS, 'apple'],
  'Service':        [...ALL_DEPT_KEYS, 'harddrivedataprotectionreplacement'],
  'Front End':      ALL_PLAN_KEYS,
};

function sortedPlans(keys: string[]): Plan[] {
  return [...new Set(keys)]
    .map(k => PLANS[k])
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getPlansForDepartment(dept: Department): Plan[] {
  return sortedPlans(DEPARTMENT_PLAN_KEYS[dept] ?? ALL_DEPT_KEYS);
}

export function getAllPlans(): Plan[] {
  return sortedPlans(ALL_PLAN_KEYS);
}
