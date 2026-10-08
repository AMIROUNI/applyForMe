module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@agency-apply/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@agency-apply/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
  },
};
