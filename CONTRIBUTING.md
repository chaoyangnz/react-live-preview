# Contributing

## Setup

```bash
git clone https://github.com/your-username/react-live-preview
cd react-live-preview
npm install
npm run compile
```

Press `F5` in VS Code to open the Extension Development Host.

## Adding a new CDN package

In `src/extension.ts`, add an entry to `CDN_REGISTRY`:

```typescript
'your-package': { global: 'YourPackageGlobal', url: 'https://unpkg.com/your-package@version/dist/umd/bundle.js' },
```

- `global` is the name the package attaches to `window` in its UMD build
- Check the package's `dist/` folder on unpkg.com to find the right UMD bundle

## Publishing

```bash
npm install -g @vscode/vsce
vsce login your-publisher-id
vsce publish
```
