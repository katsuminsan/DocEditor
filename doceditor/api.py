from __future__ import annotations

import json
from pathlib import Path

import importlib

from .model import heading, node, paragraph, sample_package, text
from .operations import apply_operation, normalize_node
from .renderer import render_html, render_text
from .settings import load_settings, remember_folder, save_settings
from .validation import validate_package

DCF_TYPES = ("DocEditor Package (*.dcf)", "JSON Files (*.json)", "All files (*.*)")
HTML_TYPES = ("HTML Document (*.html;*.htm)", "All files (*.*)")


class Api:
    def __init__(self):
        self.pywebview_window = None
        self.package = sample_package()
        self.history = []
        self.future = []
        self.dirty = False
        self.current_path: str | None = None
        self.settings = load_settings()


    def attach_window(self, pywebview_window):
        self.pywebview_window = pywebview_window

    def _display_name(self):
        return Path(self.current_path).name if self.current_path else self.package["manifest"].get("title", "Untitled.dcf")

    def get_state(self):
        return {"package": self.package, "validation": validate_package(self.package), "dirty": self.dirty, "current_path": self.current_path, "display_name": self._display_name(), "settings": self.settings}

    def get_settings(self):
        return self.settings

    def update_settings(self, patch):
        self.settings.update(patch or {})
        self.settings = save_settings(self.settings)
        return self.get_state()

    def close_app(self, discard=False):
        if self.dirty and not discard:
            return {"ok": False, "needs_confirm": True, "reason": "dirty"}
        if self.pywebview_window:
            self.pywebview_window.destroy()
        return {"ok": True}

    def new_document(self, discard=False):
        if self.dirty and not discard:
            return {"ok": False, "needs_confirm": True, "reason": "dirty"}
        self.package = sample_package(); self.history.clear(); self.future.clear(); self.dirty = False; self.current_path = None
        return {"ok": True, "state": self.get_state()}

    def operation(self, op):
        self.history.append(self.package)
        self.future.clear()
        self.package = apply_operation(self.package, op)
        self.dirty = True
        return self.get_state()

    def create_node(self, node_type, value=""):
        if node_type == "Heading": return heading(value or "見出し", 2)
        if node_type == "Paragraph": return paragraph(value or "新しい段落")
        if node_type == "Callout": return node("Callout", properties={"kind": "info", "title": value or "補足", "icon": "info", "collapsed": False}, children=[paragraph("内容を入力")])
        if node_type == "CodeBlock": return node("CodeBlock", properties={"language": "python", "show_line_numbers": True, "wrap": False, "read_only": False}, content={"content": value or "print('hello')"})
        if node_type == "Divider": return node("Divider")
        if node_type == "List": return node("List", properties={"kind": "unordered", "tight": False, "nesting_level": 0}, children=[node("ListItem", properties={"checked": None}, children=[paragraph(value or "箇条書き")])])
        if node_type == "OrderedList": return node("List", properties={"kind": "ordered", "tight": False, "nesting_level": 0}, children=[node("ListItem", properties={"checked": None}, children=[paragraph(value or "番号付き項目")])])
        if node_type == "Quote": return node("Quote", children=[text(value or "引用文")])
        return paragraph(value or "新しい段落")

    def add_node(self, parent_id, node_type, text="", index=None):
        op = {"type": "InsertNode", "target_id": parent_id, "node": self.create_node(node_type, text)}
        if index is not None: op["index"] = index
        return self.operation(op)

    def update_text(self, node_id, value):
        target = self._find(self.package["document"], node_id)
        if target and target.get("type") == "Heading":
            return self.operation({"type": "UpdateContent", "target_id": node_id, "key": "text", "value": value})
        if target and target.get("type") == "Paragraph":
            replacement = paragraph(value); replacement["id"] = node_id; replacement["metadata"] = target["metadata"]
            return self.operation({"type": "ReplaceNode", "target_id": node_id, "node": replacement})
        if target and target.get("type") == "Quote":
            replacement = node("Quote", properties=target.get("properties", {}), children=[text(value)]); replacement["id"] = node_id; replacement["metadata"] = target["metadata"]
            return self.operation({"type": "ReplaceNode", "target_id": node_id, "node": replacement})
        if target and target.get("type") == "CodeBlock":
            return self.operation({"type": "UpdateContent", "target_id": node_id, "key": "content", "value": value})
        return self.get_state()


    def change_node_type(self, node_id, node_type):
        target = self._find(self.package["document"], node_id)
        if not target or target.get("type") in {"Document", "RootSection", "Section", "ListItem"}:
            return self.get_state()
        value = self._node_text(target)
        replacement = self.create_node(node_type, value)
        replacement["id"] = node_id
        replacement["metadata"] = target["metadata"]
        return self.operation({"type": "ReplaceNode", "target_id": node_id, "node": replacement})

    def update_node(self, node_id, properties=None, content=None, metadata=None):
        ops = []
        for k, v in (properties or {}).items(): ops.append({"type": "UpdateProperty", "target_id": node_id, "key": k, "value": v})
        for k, v in (content or {}).items(): ops.append({"type": "UpdateContent", "target_id": node_id, "key": k, "value": v})
        for k, v in (metadata or {}).items(): ops.append({"type": "UpdateMetadata", "target_id": node_id, "key": k, "value": v})
        return self.operation({"type": "Batch", "operations": ops}) if ops else self.get_state()

    def normalize(self):
        self.package["document"] = normalize_node(self.package["document"], self.package.get("theme")); self.dirty = True
        return self.get_state()

    def validate(self): return validate_package(self.package)
    def render(self, fmt="html"): return render_text(self.package["document"]) if fmt == "plain" else render_html(self.package)

    def open_dialog(self, discard=False):
        if self.dirty and not discard: return {"ok": False, "needs_confirm": True, "reason": "dirty"}
        result = self._dialog("OPEN", file_types=DCF_TYPES)
        if not result: return {"ok": False, "cancelled": True}
        return self.load(result[0])

    def save_dialog(self): return self.save_as_dialog() if not self.current_path else self.save(self.current_path)

    def save_as_dialog(self):
        result = self._dialog("SAVE", save_filename=self._display_name() if self.current_path else "Untitled.dcf", file_types=DCF_TYPES)
        if not result: return {"ok": False, "cancelled": True}
        path = self._ensure_suffix(result[0], ".dcf")
        return self.save(path)

    def export_html_dialog(self):
        result = self._dialog("SAVE", save_filename=Path(self._display_name()).with_suffix(".html").name, file_types=HTML_TYPES)
        if not result: return {"ok": False, "cancelled": True}
        path = self._ensure_suffix(result[0], ".html")
        Path(path).write_text(render_html(self.package), encoding="utf-8")
        self.settings = remember_folder(self.settings, Path(path).parent)
        return {"ok": True, "path": path, "state": self.get_state()}

    def save(self, path):
        self.package["document"] = normalize_node(self.package["document"], self.package.get("theme"))
        result = validate_package(self.package)
        if not result["valid"]: return {"ok": False, "errors": result["errors"], "state": self.get_state()}
        path = self._ensure_suffix(path, ".dcf")
        self.package["manifest"]["title"] = Path(path).stem
        Path(path).write_text(json.dumps(self.package, ensure_ascii=False, indent=2), encoding="utf-8")
        self.current_path = path; self.dirty = False; self.settings = remember_folder(self.settings, Path(path).parent)
        return {"ok": True, "path": path, "state": self.get_state()}

    def load(self, path):
        self.package = json.loads(Path(path).read_text(encoding="utf-8"))
        self.current_path = str(Path(path)); self.history.clear(); self.future.clear(); self.dirty = False; self.settings = remember_folder(self.settings, Path(path).parent)
        return {"ok": True, "state": self.get_state()}

    def undo(self):
        if self.history: self.future.append(self.package); self.package = self.history.pop(); self.dirty = True
        return self.get_state()

    def redo(self):
        if self.future: self.history.append(self.package); self.package = self.future.pop(); self.dirty = True
        return self.get_state()

    def _dialog(self, dialog_type, directory="", save_filename="", file_types=()):
        if not self.pywebview_window:
            return None
        webview = importlib.import_module("webview")
        file_dialog = getattr(webview, "FileDialog", None)
        if file_dialog is not None:
            dialog_value = getattr(file_dialog, dialog_type)
        else:
            dialog_value = getattr(webview, f"{dialog_type}_DIALOG")
        initial = directory or (str(Path(self.current_path).parent) if self.current_path else (self.settings.get("recent_folders") or [str(Path.home())])[0])
        return self.pywebview_window.create_file_dialog(dialog_value, directory=initial, save_filename=save_filename, file_types=file_types)

    def _ensure_suffix(self, path, suffix):
        p = Path(path)
        return str(p if p.suffix else p.with_suffix(suffix))


    def _node_text(self, n):
        if n.get("type") == "Heading":
            return n.get("content", {}).get("text", "")
        if n.get("type") == "CodeBlock":
            return n.get("content", {}).get("content", "")
        if n.get("type") == "Text":
            return n.get("content", {}).get("text", "")
        return "".join(self._node_text(child) for child in n.get("children", []))

    def _find(self, n, node_id):
        if n.get("id") == node_id: return n
        for child in n.get("children", []):
            found = self._find(child, node_id)
            if found: return found
        return None
