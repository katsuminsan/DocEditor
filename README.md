# DocEditor

Python + pywebview based desktop document editor for the DCF 1.0 package specification. The frontend is static HTML/CSS/JavaScript and calls Python directly through `window.pywebview.api`; no local HTTP server is used.

## Run

```bash
python -m pip install -r requirements.txt
python app.py
```

## Implemented scope

- Hybrid writing-focused UI with a direct-edit canvas, collapsible left sidebar, and on-demand right property pane.
- Sidebar modes for block insertion, heading-oriented structure navigation, file I/O, and authoring support.
- Block insertion from the sidebar, contextual `＋` menu, and searchable `/` command menu.
- Editable Heading, Paragraph, Callout, CodeBlock, Divider, unordered/ordered List, and Quote blocks.
- Native pywebview file dialogs for `.dcf` open/save/save-as and `.html` export, using initial folders, default filenames, and extension filters.
- User-level app settings persisted outside documents at `~/.doceditor/settings.json` for recent folders and pinned folders.
- Package model: Manifest, Document, Theme, Resources, Settings.
- Node model: metadata/properties/content/children for all nodes.
- Operation API: insert, delete, replace, property/content/metadata updates, visibility/lock toggles, batch, split, normalize.
- Validation: required package/node fields plus parent/child structure validation.
- Renderer: HTML standard representation and plain text export.
