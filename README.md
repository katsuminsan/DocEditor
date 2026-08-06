# DocEditor

Python + pywebview based document editor for the DCF 1.0 package specification. The frontend is static HTML/CSS/JavaScript and calls Python directly through `window.pywebview.api`; no local HTTP server is used.

## Run

```bash
python -m pip install -r requirements.txt
python app.py
```

## Implemented scope

- Package model: Manifest, Document, Theme, Resources, Settings.
- Node model: metadata/properties/content/children for all nodes.
- Operation API: insert, delete, replace, property/content updates, visibility/lock toggles, batch, split, normalize.
- Validation: JSON Schema checks plus parent/child structure validation.
- Renderer: HTML standard representation and plain text export.
- Editor UI: component palette, outline, property panel, validation view, undo/redo, normalize, HTML preview.
