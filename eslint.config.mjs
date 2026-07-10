import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import importX from "eslint-plugin-import-x";
import jsxA11y from "eslint-plugin-jsx-a11y";
import promise from "eslint-plugin-promise";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactNative from "eslint-plugin-react-native";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import globals from "globals";
import tseslint from "typescript-eslint";

const tsFiles = ["**/*.{ts,tsx}"];
const jsFiles = ["**/*.{js,cjs,mjs}"];

export default tseslint.config(
  {
    ignores: [
      "**/.expo/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/build/**",
      "**/coverage/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/playwright-report/**",
      "**/pnpm-lock.yaml",
      "**/test-results/**"
    ]
  },
  js.configs.recommended,
  {
    files: jsFiles,
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.node
      },
      sourceType: "module"
    }
  },
  {
    files: tsFiles,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: tsFiles
  })),
  ...tseslint.configs.stylisticTypeChecked.map((config) => ({
    ...config,
    files: tsFiles
  })),
  {
    files: tsFiles,
    plugins: {
      "import-x": importX,
      promise,
      sonarjs,
      unicorn
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          fixStyle: "inline-type-imports"
        }
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/prefer-readonly": "error",
      complexity: ["error", { max: 10 }],
      "import-x/consistent-type-specifier-style": ["error", "prefer-inline"],
      "max-depth": ["error", { max: 3 }],
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": [
        "error",
        { IIFEs: true, max: 100, skipBlankLines: true, skipComments: true }
      ],
      "max-nested-callbacks": ["error", { max: 3 }],
      "max-params": ["error", { max: 4 }],
      "max-statements": ["error", { max: 20 }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "promise/catch-or-return": "error",
      "promise/no-return-wrap": "error",
      "sonarjs/cognitive-complexity": ["error", 15],
      "unicorn/filename-case": [
        "error",
        {
          cases: {
            camelCase: true,
            kebabCase: true,
            pascalCase: true
          }
        }
      ],
      "unicorn/no-null": "off",
      "unicorn/prevent-abbreviations": "off"
    }
  },
  {
    files: ["**/*.{test,spec}.{ts,tsx}"],
    rules: {
      "max-lines-per-function": "off",
      "max-nested-callbacks": ["error", { max: 5 }],
      "max-statements": "off"
    }
  },
  {
    files: ["apps/api/src/**/*.module.ts", "apps/workers/src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-extraneous-class": "off"
    }
  },
  {
    files: ["apps/web/**/*.{ts,tsx}", "apps/mobile/**/*.{ts,tsx}", "packages/ui/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    },
    plugins: {
      "jsx-a11y": jsxA11y,
      react,
      "react-hooks": reactHooks
    },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/prop-types": "off",
      "react/jsx-no-useless-fragment": "error",
      "react/react-in-jsx-scope": "off"
    },
    settings: {
      react: {
        version: "detect"
      }
    }
  },
  {
    files: ["apps/mobile/**/*.{ts,tsx}"],
    plugins: {
      "react-native": reactNative
    },
    rules: {
      "react-native/no-inline-styles": "warn",
      "react-native/no-raw-text": "off"
    }
  },
  prettier
);
