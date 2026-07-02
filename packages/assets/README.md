# Assets

Brand and product assets live here.

## Structure

- `brand/source`: original source files, kept for traceability only.
- `brand/web`: optimized WebP files for runtime use in web and mobile surfaces.
- `identity/source`: SVG-only third-party identity marks.
- `identity/web`: optimized WebP identity assets for runtime use.
- `src`: typed asset metadata.

Login backgrounds are split by surface: portrait variants for mobile and panoramic variants for
desktop web.

Regenerate optimized images with:

```bash
pnpm assets:optimize
```

Do not reference files from `brand/source` in application UI unless there is a documented reason.
