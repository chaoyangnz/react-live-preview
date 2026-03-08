import * as vscode from 'vscode';

const CDN_REGISTRY: Record<string, { global: string; url: string }> = {
  'react':         { global: 'React',       url: 'https://unpkg.com/react@18/umd/react.development.js' },
  'react-dom':     { global: 'ReactDOM',    url: 'https://unpkg.com/react-dom@18/umd/react-dom.development.js' },
  'prop-types':    { global: 'PropTypes',   url: 'https://unpkg.com/prop-types@15/prop-types.min.js' },
  'recharts':      { global: 'Recharts',    url: 'https://unpkg.com/recharts@2.12.0/umd/Recharts.js' },
  'lodash':        { global: '_',           url: 'https://unpkg.com/lodash@4/lodash.min.js' },
  'd3':            { global: 'd3',          url: 'https://unpkg.com/d3@7/dist/d3.min.js' },
  'three':         { global: 'THREE',       url: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js' },
  'mathjs':        { global: 'math',        url: 'https://unpkg.com/mathjs@12/lib/browser/math.js' },
  'tone':          { global: 'Tone',        url: 'https://unpkg.com/tone@14/build/Tone.js' },
  'chart.js':      { global: 'Chart',       url: 'https://unpkg.com/chart.js@4/dist/chart.umd.js' },
  'papaparse':     { global: 'Papa',        url: 'https://unpkg.com/papaparse@5/papaparse.min.js' },
  'plotly.js':     { global: 'Plotly',      url: 'https://unpkg.com/plotly.js@2/dist/plotly.min.js' },
  'lucide-react':  { global: 'lucideReact', url: 'https://unpkg.com/lucide-react@0.263.1/dist/umd/lucide-react.min.js' },
};

interface ParsedImport {
  raw: string;
  pkg: string;
  named: string[];
  defaultImport: string;
  namespaceImport: string;
}

function parseImports(code: string): ParsedImport[] {
  const results: ParsedImport[] = [];
  const importRegex = /^import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    const [raw, specifiers, pkg] = match;
    const named: string[] = [];
    let defaultImport = '';
    let namespaceImport = '';

    const nsMatch = specifiers.match(/\*\s+as\s+(\w+)/);
    if (nsMatch) { namespaceImport = nsMatch[1]; }

    const namedMatch = specifiers.match(/\{([^}]+)\}/);
    if (namedMatch) {
      namedMatch[1].split(',').forEach((s: string) => {
        const parts = s.trim().split(/\s+as\s+/);
        named.push(parts[parts.length - 1].trim());
      });
    }

    const beforeBrace = specifiers.split(/[{*]/)[0].trim();
    if (beforeBrace && beforeBrace !== 'type') {
      defaultImport = beforeBrace.replace(/,$/, '').trim();
    }

    results.push({ raw, pkg, named, defaultImport, namespaceImport });
  }
  return results;
}

function buildShims(imports: ParsedImport[]): string {
  const shims: string[] = [];
  for (const imp of imports) {
    const entry = CDN_REGISTRY[imp.pkg];
    if (!entry) { continue; }
    const g = entry.global;
    if (imp.defaultImport) {
      shims.push('var ' + imp.defaultImport + ' = window["' + g + '"];');
    }
    if (imp.namespaceImport) {
      shims.push('var ' + imp.namespaceImport + ' = window["' + g + '"];');
    }
    for (const name of imp.named) {
      shims.push('var ' + name + ' = window["' + g + '"] && window["' + g + '"]["' + name + '"];');
    }
  }
  return shims.join('\n');
}

function buildScriptTags(imports: ParsedImport[]): string {
  const seen = new Set<string>();
  const tags: string[] = [];

  // React, prop-types first — Recharts needs both on window when it loads
  for (const core of ['react', 'react-dom', 'prop-types']) {
    seen.add(core);
    tags.push('<script src="' + CDN_REGISTRY[core].url + '"></script>');
  }

  // All other imported packages
  for (const imp of imports) {
    if (seen.has(imp.pkg)) { continue; }
    seen.add(imp.pkg);
    const entry = CDN_REGISTRY[imp.pkg];
    const url = entry ? entry.url : 'https://unpkg.com/' + imp.pkg;
    tags.push('<script src="' + url + '"></script>');
  }

  // Babel LAST — all packages must be on window before Babel runs
  tags.push('<script src="https://unpkg.com/@babel/standalone@7/babel.min.js"></script>');
  return tags.join('\n  ');
}

function prepareCode(code: string, shims: string): string {
  const stripped = code
    .replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"]\s*;?\s*\n?/gm, '')
    .replace(/^import\s+['"][^'"]+['"]\s*;?\s*\n?/gm, '')
    .replace(/^export\s+default\s+function\s+(\w+)/m, 'function $1')
    .replace(/^export\s+default\s+/m, 'var __defaultExport = ')
    .trim();
  return shims + '\n\n' + stripped;
}

function getWebviewContent(code: string): string {
  const imports = parseImports(code);
  const scriptTags = buildScriptTags(imports);
  const shims = buildShims(imports);
  const prepared = prepareCode(code, shims);
  const jsonKnown = JSON.stringify(Object.keys(CDN_REGISTRY));
  const jsonUsed  = JSON.stringify(imports.map((i: ParsedImport) => i.pkg));

  // Only escape </script> — prevents the tag from closing prematurely.
  // Everything else (backticks, ${...}, quotes) must reach Babel unchanged.
  const safeCode = prepared.replace(/<\/script>/gi, '<\\/script>');

  // ── IMPORTANT: build HTML with string concatenation, NOT a template literal ──
  // If we used a template literal here, TypeScript would interpret every ${...}
  // in the JSX source code as a TS expression and break the output.
  // String concatenation passes `safeCode` through as a plain string.
  const mountScript =
    '\nconst __rootEl = document.getElementById("root");' +
    '\nconst __rootApp = typeof App !== "undefined" ? App : typeof __defaultExport !== "undefined" ? __defaultExport : null;' +
    '\nif (!__rootApp) { __rootEl.innerHTML = \'<pre style="color:red;padding:16px">No default export found. Use: export default function App() { ... }</pre>\'; }' +
    '\nelse { ReactDOM.createRoot(__rootEl).render(React.createElement(__rootApp)); }';

  return (
    '<!DOCTYPE html>' +
    '<html lang="en"><head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>JSX Preview</title>' +
    '\n  ' + scriptTags +
    '\n<style>' +
    '* { box-sizing: border-box; }' +
    'body { margin: 0; padding: 0; }' +
    '#warn { display:none; background:#1a1000; color:#ffc107; padding:12px 16px; font-family:monospace; font-size:12px; border-left:3px solid #ffc107; margin:12px; border-radius:4px; }' +
    '</style>' +
    '</head><body>' +
    '<div id="warn"></div>' +
    '<div id="root"></div>' +
    '<script>' +
    'var __known = ' + jsonKnown + ';' +
    'var __used = ' + jsonUsed + ';' +
    'var __unknown = __used.filter(function(p){return !__known.includes(p);});' +
    'if(__unknown.length){var w=document.getElementById("warn");w.style.display="block";w.textContent="\u26A0 Unknown packages (trying unpkg): "+__unknown.join(", ");}' +
    '</script>' +
    // text/babel: Babel standalone finds this tag, transforms it with its
    // internal eval (allowed by VS Code webview CSP), and executes it.
    // No dynamic script injection needed.
    '\n<script type="text/babel" data-presets="react">\n' +
    safeCode +
    mountScript +
    '\n</script>' +
    '</body></html>'
  );
}

// ── Extension entry point ──────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  let currentPanel: vscode.WebviewPanel | undefined;

  const openPreview = () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('React Live Preview: Open a .jsx or .tsx file first.');
      return;
    }

    const code = editor.document.getText();

    if (currentPanel) {
      currentPanel.reveal(vscode.ViewColumn.Beside);
      currentPanel.webview.html = getWebviewContent(code);
      return;
    }

    currentPanel = vscode.window.createWebviewPanel(
      'jsxPreview',
      'React Live Preview',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    currentPanel.webview.html = getWebviewContent(code);

    const getReloadMode = () =>
      vscode.workspace.getConfiguration('reactLivePreview').get('liveReload', 'onSave') as string;

    const saveListener = vscode.workspace.onDidSaveTextDocument((doc: any) => {
      const mode = getReloadMode();
      if (doc === editor.document && currentPanel && (mode === 'onSave' || mode === 'onChange')) {
        currentPanel.webview.html = getWebviewContent(doc.getText());
      }
    });

    const changeListener = vscode.workspace.onDidChangeTextDocument((e: any) => {
      if (e.document === editor.document && currentPanel && getReloadMode() === 'onChange') {
        currentPanel.webview.html = getWebviewContent(e.document.getText());
      }
    });

    currentPanel.onDidDispose(() => {
      currentPanel = undefined;
      saveListener.dispose();
      changeListener.dispose();
    }, null, context.subscriptions);

    context.subscriptions.push(saveListener, changeListener);
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('reactLivePreview.open', openPreview)
  );
}

export function deactivate() {}
