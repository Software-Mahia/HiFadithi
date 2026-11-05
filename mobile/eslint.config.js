const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');
module.exports = defineConfig([
  expo,
  prettier,
  {
    ignores: [
      '.phase0-template/**',
      '.npm-cache/**',
      'supabase/functions/**',
      'dist/**',
    ],
  },
]);
