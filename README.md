# React Live Preview

> Instantly preview React/JSX components inside VS Code — no build step, no config, no terminal.

![React Live Preview demo](https://raw.githubusercontent.com/your-username/react-live-preview/main/images/demo.gif)

## Features

- ⚡ **Live reload** — preview updates as you type or on save
- 📦 **Auto CDN resolution** — `import { LineChart } from 'recharts'` just works
- 🎨 **Zero config** — open any `.jsx` or `.tsx` file and press the button
- 🔒 **No network calls from your code** — CDN scripts load in the sandboxed webview only
- ⚠️ **Unknown package fallback** — tries unpkg for packages not in the built-in registry

## Usage

1. Open any `.jsx` or `.tsx` file
2. Press `Ctrl+Shift+V` (Mac: `Cmd+Shift+V`), or click the preview icon in the editor title bar
3. The preview opens in a panel to the right

Your component must have a **default export**:

```jsx
export default function App() {
  return <div>Hello world</div>
}
```

## Supported Packages

These packages are resolved automatically from CDN:

| Package | Version |
|---|---|
| react | 18 |
| react-dom | 18 |
| recharts | 2.12.0 |
| d3 | 7 |
| three | r128 |
| lodash | 4 |
| mathjs | 12 |
| chart.js | 4 |
| plotly.js | 2 |
| papaparse | 5 |
| tone | 14 |
| lucide-react | 0.263.1 |

Any other package is attempted via `https://unpkg.com/<package-name>` as a best-effort fallback.

## Settings

| Setting | Options | Default | Description |
|---|---|---|---|
| `reactLivePreview.liveReload` | `onChange` \| `onSave` \| `off` | `onSave` | When to refresh the preview |

## Requirements

- VS Code 1.74.0 or higher
- Internet connection (CDN scripts load at preview time)

## Known Limitations

- Components must be self-contained in a single file
- CSS-in-JS only (no `.css` file imports)
- TypeScript syntax supported via Babel transform (type checking not performed)

## Contributing

Issues and PRs welcome at [github.com/your-username/react-live-preview](https://github.com/your-username/react-live-preview).
