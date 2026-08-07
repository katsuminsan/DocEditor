from __future__ import annotations

from .model import ALLOWED_CHILDREN, NODE_TYPES

PACKAGE_SCHEMA = {
    "type": "object",
    "required": ["manifest", "document", "theme", "resources", "settings"],
}


def schema_errors(package: dict) -> list[str]:
    errors: list[str] = []
    for key in ("manifest", "document", "theme", "resources", "settings"):
        if key not in package:
            errors.append(f"<root>: missing {key}")
    manifest = package.get("manifest", {})
    for key in ("package_id", "format", "format_version", "title", "primary_document_id"):
        if key not in manifest:
            errors.append(f"manifest: missing {key}")
    theme = package.get("theme", {})
    for key in ("theme_id", "name", "version", "tokens"):
        if key not in theme:
            errors.append(f"theme: missing {key}")

    def walk(n: dict, path: str):
        for key in ("type", "id", "metadata", "properties", "content", "children"):
            if key not in n:
                errors.append(f"{path}: missing {key}")
        if n.get("type") not in NODE_TYPES:
            errors.append(f"{path}.type: invalid {n.get('type')}")
        if not isinstance(n.get("properties", {}), dict):
            errors.append(f"{path}.properties: must be object")
        if not isinstance(n.get("content", {}), dict):
            errors.append(f"{path}.content: must be object")
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
    else:
        errors.append("document: must be object")
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
