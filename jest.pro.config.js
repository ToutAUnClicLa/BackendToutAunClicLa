// Config Jest dedicada al módulo Pro (ESM nativo, sin opciones conflictivas).
// Se ejecuta con: npm run test:pro
export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/unit/pro*.test.js'],
  transform: {},
};
