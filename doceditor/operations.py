from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone

from .model import DEFAULT_THEME, paragraph, text


def touch(n: dict):
    n.setdefault("metadata", {})["updated_at"] = datetime.now(timezone.utc).isoformat()


def find_node(root: dict, node_id: str) -> tuple[dict | None, dict | None, int | None]:
    if root.get("id") == node_id:
        return root, None, None
    for i, child in enumerate(root.get("children", [])):
        found, parent, idx = find_node(child, node_id)
        if found:
            return found, parent or root, i if parent is None else idx
    return None, None, None


def normalize_node(n: dict, theme=None) -> dict:
    theme = theme or DEFAULT_THEME
    n.setdefault("metadata", {})
    n["metadata"].setdefault("visible", True)
    n["metadata"].setdefault("locked", False)
    if n["metadata"].get("style_key") not in theme.get("tokens", {}).get("styles", {}):
        n["metadata"]["style_key"] = "default"
    n.setdefault("properties", {})
    n.setdefault("content", {})
    n["children"] = n.get("children") or []
    merged = []
    for child in n["children"]:
        normalized = normalize_node(child, theme)
        if merged and merged[-1].get("type") == "Text" and normalized.get("type") == "Text":
            merged[-1].setdefault("content", {})["text"] = merged[-1].get("content", {}).get("text", "") + normalized.get("content", {}).get("text", "")
        elif normalized.get("type") == "Paragraph" and not normalized.get("children"):
            merged.append(normalized)
        else:
            merged.append(normalized)
    n["children"] = merged
    if n.get("type") == "Tabs" and n["children"]:
        selected = int(n["properties"].get("selected_index", 0))
        n["properties"]["selected_index"] = max(0, min(len(n["children"]) - 1, selected))
    return n


def apply_operation(package: dict, operation: dict) -> dict:
    package = deepcopy(package)
    doc = package["document"]
    op = operation.get("type")
    target_id = operation.get("target_id")
    target, parent, idx = find_node(doc, target_id) if target_id else (None, None, None)
    if op == "InsertNode" and target:
        target.setdefault("children", []).insert(operation.get("index", len(target.get("children", []))), operation["node"])
        touch(target)
    elif op == "DeleteNode" and parent is not None and idx is not None:
        parent["children"].pop(idx); touch(parent)
    elif op == "ReplaceNode" and parent is not None and idx is not None:
        parent["children"][idx] = operation["node"]; touch(parent)
    elif op == "UpdateProperty" and target:
        target.setdefault("properties", {})[operation["key"]] = operation.get("value"); touch(target)
    elif op == "UpdateContent" and target:
        target.setdefault("content", {})[operation["key"]] = operation.get("value"); touch(target)
    elif op == "ToggleVisibility" and target:
        target.setdefault("metadata", {})["visible"] = not target.get("metadata", {}).get("visible", True); touch(target)
    elif op == "ToggleLock" and target:
        target.setdefault("metadata", {})["locked"] = not target.get("metadata", {}).get("locked", False); touch(target)
    elif op == "NormalizeDocument":
        package["document"] = normalize_node(doc, package.get("theme"))
    elif op == "Batch":
        for child_op in operation.get("operations", []):
            package = apply_operation(package, child_op)
    elif op == "SplitNode" and target and target.get("type") == "Paragraph":
        at = operation.get("offset", 0)
        value = "".join(c.get("content", {}).get("text", "") for c in target.get("children", []) if c.get("type") == "Text")
        target["children"] = [text(value[:at])]
        parent["children"].insert(idx + 1, paragraph(value[at:]))
    return package
