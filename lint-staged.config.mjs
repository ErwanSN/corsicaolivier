export default {
  "*.{js,cjs,mjs,ts,tsx,json,jsonc,md,mdx,yml,yaml,css,scss}": ["prettier --write"],
  "{apps,packages}/**/*.{js,cjs,mjs,ts,tsx}": ["eslint --max-warnings=0"]
};
