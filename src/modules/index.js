import AdditionWithinTenApp from './addition/AdditionWithinTenApp.jsx';

export const moduleRegistry = {
  'addition-within-10': {
    id: 'addition-within-10',
    operation: 'addition',
    component: AdditionWithinTenApp,
  },
};

export const getModuleByKey = (key) => moduleRegistry[key] || null;
