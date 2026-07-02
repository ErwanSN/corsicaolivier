import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import importX from "eslint-plugin-import-x";
import promise from "eslint-plugin-promise";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactNative from "eslint-plugin-react-native";
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
      "**/pnpm-lock.yaml"
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
      "import-x/consistent-type-specifier-style": ["error", "prefer-inline"],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "promise/catch-or-return": "error",
      "promise/no-return-wrap": "error",
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
      react,
      "react-hooks": reactHooks
    },
    rules: {
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
