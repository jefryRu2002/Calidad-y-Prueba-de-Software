// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      // Reglas base de Angular (las que ya tenías)
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      
      // ==========================================
      // REGLAS NUEVAS DE CALIDAD Y REFACTORIZACIÓN
      // ==========================================
      
      // 1. Máximo de líneas por función (para evitar "God Methods")
      "max-lines-per-function": ["warn", { "max": 40, "skipBlankLines": true, "skipComments": true }],
      
      // 2. Complejidad ciclomática (evita muchos if/else anidados)
      "complexity": ["warn", 10],
      
      // 3. Evitar el uso de 'any' (te obliga a usar interfaces)
      "@typescript-eslint/no-explicit-any": "warn",
      
      // 4. Avisar si dejas console.log en el código
      "no-console": "warn",
      
      // 5. Variables declaradas pero no usadas (muy común en Angular)
      "@typescript-eslint/no-unused-vars": "warn",
      
      // 6. Preferir const en lugar de let cuando la variable no cambia
      "prefer-const": "warn"
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);