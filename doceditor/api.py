from __future__ import annotations

import json
from pathlib import Path

from .model import heading, node, paragraph, sample_package
from .operations import apply_operation, normalize_node
from .renderer import render_html, render_text
from .validation import validate_package


class Api:
    def __init__(self):
        self._window = None
        self.package = sample_package()
        self.history = []
        self.future = []
        self.dirty = False

    def get_state(self):
        return {"package": self.package, "validation": validate_package(self.package), "dirty": self.dirty}

    def operation(self, op):
        self.history.append(self.package)
        self.future.clear()
        self.package = apply_operation(self.package, op)
        self.dirty = True
        return self.get_state()

    def create_node(self, node_type, text=""):
        if node_type == "Heading": return heading(text or "見出し", 2)
        if node_type == "Paragraph": return paragraph(text or "新しい段落")
        if node_type == "Callout": return node("Callout", properties={"kind": "info", "title": text or "補足", "icon": "info", "collapsed": False}, children=[paragraph("内容を入力")])
        if node_type == "CodeBlock": return node("CodeBlock", properties={"language": "python", "show_line_numbers": True, "wrap": False, "read_only": False}, content={"content": text or "print('hello')"})
        if node_type == "Divider": return node("Divider")
        return paragraph(text or "新しい段落")

    def add_node(self, parent_id, node_type, text=""):
        return self.operation({"type": "InsertNode", "target_id": parent_id, "node": self.create_node(node_type, text)})

    def update_text(self, node_id, text):
        target = self._find(self.package["document"], node_id)
        if target and target.get("type") == "Heading":
            return self.operation({"type": "UpdateContent", "target_id": node_id, "key": "text", "value": text})
        if target and target.get("type") == "Paragraph":
            target_copy = paragraph(text)
            target_copy["id"] = node_id
            target_copy["metadata"] = target["metadata"]
            return self.operation({"type": "ReplaceNode", "target_id": node_id, "node": target_copy})
        return self.get_state()

    def normalize(self):
        self.package["document"] = normalize_node(self.package["document"], self.package.get("theme"))
        self.dirty = True
        return self.get_state()

    def validate(self):
        return validate_package(self.package)

    def render(self, fmt="html"):
        if fmt == "plain": return render_text(self.package["document"])
        return render_html(self.package)

    def save(self, path):
        self.normalize()
        result = validate_package(self.package)
        if not result["valid"]: return {"ok": False, "errors": result["errors"]}
        Path(path).write_text(json.dumps(self.package, ensure_ascii=False, indent=2), encoding="utf-8")
        self.dirty = False
        return {"ok": True, "path": path}

    def load(self, path):
        self.package = json.loads(Path(path).read_text(encoding="utf-8"))
        self.history.clear(); self.future.clear(); self.dirty = False
        return self.get_state()

    def undo(self):
        if self.history:
            self.future.append(self.package); self.package = self.history.pop(); self.dirty = True
        return self.get_state()

    def redo(self):
        if self.future:
            self.history.append(self.package); self.package = self.future.pop(); self.dirty = True
        return self.get_state()

    def _find(self, n, node_id):
        if n.get("id") == node_id: return n
        for child in n.get("children", []):
            found = self._find(child, node_id)
            if found: return found
        return None
