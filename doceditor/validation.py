from __future__ import annotations

try:
    from jsonschema import Draft202012Validator
except ImportError:  # optional runtime dependency; fallback validator covers required DCF checks
    Draft202012Validator = None

from .model import ALLOWED_CHILDREN, NODE_TYPES

PACKAGE_SCHEMA = {
    "type": "object",
    "required": ["manifest", "document", "theme", "resources", "settings"],
    "properties": {
        "manifest": {"type": "object", "required": ["package_id", "format", "format_version", "title", "primary_document_id"]},
        "document": {"$ref": "#/$defs/node"},
        "theme": {"type": "object", "required": ["theme_id", "name", "version", "tokens"]},
        "resources": {"type": "array"},
        "settings": {"type": "object"},
    },
    "$defs": {
        "node": {
            "type": "object",
            "required": ["type", "id", "metadata", "properties", "content", "children"],
            "properties": {
                "type": {"enum": sorted(NODE_TYPES)},
                "id": {"type": "string", "minLength": 1},
                "metadata": {"type": "object", "required": ["visible", "locked"], "properties": {"visible": {"type": "boolean"}, "locked": {"type": "boolean"}}, "additionalProperties": True},
                "properties": {"type": "object"},
                "content": {"type": "object"},
                "children": {"type": "array", "items": {"$ref": "#/$defs/node"}},
            },
        }
    },
}


def schema_errors(package: dict) -> list[str]:
    if Draft202012Validator is not None:
        validator = Draft202012Validator(PACKAGE_SCHEMA)
        return [f"{'.'.join(map(str, e.path)) or '<root>'}: {e.message}" for e in validator.iter_errors(package)]
    errors: list[str] = []
    for key in ("manifest", "document", "theme", "resources", "settings"):
        if key not in package:
            errors.append(f"<root>: missing {key}")
    def walk(n: dict, path: str):
        for key in ("type", "id", "metadata", "properties", "content", "children"):
            if key not in n:
                errors.append(f"{path}: missing {key}")
        if n.get("type") not in NODE_TYPES:
            errors.append(f"{path}.type: invalid {n.get('type')}")
        if not isinstance(n.get("children", []), list):
            errors.append(f"{path}.children: must be array")
            return
        metadata = n.get("metadata", {})
        if not isinstance(metadata.get("visible"), bool) or not isinstance(metadata.get("locked"), bool):
            errors.append(f"{path}.metadata: visible and locked are required booleans")
        for index, child in enumerate(n.get("children", [])):
            walk(child, f"{path}.children.{index}")
    if isinstance(package.get("document"), dict):
        walk(package["document"], "document")
    return errors


def structure_errors(root: dict) -> list[str]:
    errors: list[str] = []
    seen: set[str] = set()

    def walk(n: dict, parent: str | None = None):
        node_id = n.get("id", "<missing>")
        node_type = n.get("type")
        if node_id in seen:
            errors.append(f"duplicate id: {node_id}")
        seen.add(node_id)
        if parent and node_type not in ALLOWED_CHILDREN.get(parent, set()):
            errors.append(f"{parent} cannot contain {node_type} ({node_id})")
        for child in n.get("children", []):
            walk(child, node_type)

    walk(root)
    return errors


def validate_package(package: dict) -> dict:
    errors = schema_errors(package)
    if not errors:
        errors.extend(structure_errors(package["document"]))
    return {"valid": not errors, "errors": errors}
