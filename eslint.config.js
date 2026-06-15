import js from "@eslint/js";
import tseslint from "typescript-eslint";
import vue from "eslint-plugin-vue";

export default [
  { ignores: ["dist", "coverage", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs["flat/recommended"],
  {
    files: ["**/*.{ts,vue}"],
    languageOptions: {
      globals: {
        AbortController: "readonly",
        clearTimeout: "readonly",
        fetch: "readonly",
        setTimeout: "readonly"
      },
      parserOptions: {
        parser: tseslint.parser
      }
    },
    rules: {
      "vue/html-self-closing": "off",
      "vue/max-attributes-per-line": "off",
      "vue/multi-word-component-names": "off",
      "vue/singleline-html-element-content-newline": "off"
    }
  }
];
