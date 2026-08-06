from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from uuid import uuid4

FORMAT = "dcf"
FORMAT_VERSION = "1.0"

CONTAINERS = {
    "Document", "RootSection", "Section", "Paragraph", "Callout", "Table", "TableRow",
    "TableCell", "List", "ListItem", "Accordion", "Tabs", "TabItem", "ColumnLayout",
    "Column", "Card", "Quote",
}
LEAVES = {"Heading", "Image", "CodeBlock", "Divider"}
INLINE = {"Text", "Bold", "Italic", "Underline", "Link", "InlineCode", "Mention", "Reference"}
NODE_TYPES = CONTAINERS | LEAVES | INLINE

ALLOWED_CHILDREN = {
    "Document": {"RootSection"},
    "RootSection": {"Section", "Heading", "Paragraph", "Callout", "Table", "List", "Accordion", "Tabs", "ColumnLayout", "Card", "Image", "CodeBlock", "Divider", "Quote"},
    "Section": {"Section", "Heading", "Paragraph", "Callout", "Table", "List", "Accordion", "Tabs", "ColumnLayout", "Card", "Image", "CodeBlock", "Divider", "Quote"},
    "Paragraph": INLINE,
    "Callout": {"Paragraph", "List", "Image", "CodeBlock", "Table", "Quote"},
    "Table": {"TableRow"},
    "TableRow": {"TableCell"},
    "TableCell": {"Paragraph", "List", "Image", "CodeBlock"},
    "List": {"ListItem"},
    "ListItem": {"Paragraph", "List", "Text", "Bold", "Italic", "Underline", "Link", "InlineCode", "Reference"},
    "Accordion": {"Paragraph", "Section", "List", "Image", "CodeBlock"},
    "Tabs": {"TabItem"},
    "TabItem": {"Paragraph", "Section", "List", "Image", "CodeBlock", "Table"},
    "ColumnLayout": {"Column"},
    "Column": {"Paragraph", "Section", "List", "Image", "CodeBlock", "Card"},
    "Card": {"Paragraph", "List", "Image", "CodeBlock"},
    "Quote": {"Text", "Bold", "Italic", "Link", "InlineCode"},
    "Bold": INLINE - {"Bold"},
    "Italic": INLINE - {"Italic"},
    "Underline": INLINE - {"Underline"},
    "Link": INLINE - {"Link"},
}

DEFAULT_THEME = {
    "theme_id": "business-default",
    "name": "Business Default",
    "version": "1.0",
    "tokens": {
        "font_family": "Inter, system-ui, sans-serif",
        "font_size": "16px",
        "line_height": "1.65",
        "spacing": {"xs": "4px", "sm": "8px", "md": "16px", "lg": "24px", "xl": "40px"},
        "colors": {"text": "#1f2937", "muted": "#6b7280", "accent": "#2563eb", "surface": "#ffffff", "border": "#d1d5db", "callout": "#eff6ff"},
        "styles": {"default": {}, "title": {"color": "#111827"}, "note": {"color": "#1d4ed8"}},
    },
}


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str = "node") -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


def node(node_type: str, properties=None, content=None, children=None, style_key="default") -> dict:
    stamp = now()
    return {
        "type": node_type,
        "id": new_id(node_type.lower()),
        "metadata": {"id": new_id("meta"), "created_at": stamp, "updated_at": stamp, "visible": True, "locked": False, "style_key": style_key, "ref": None},
        "properties": properties or {},
        "content": content or {},
        "children": children or [],
    }


def text(value: str) -> dict:
    return node("Text", content={"text": value}, children=[])


def paragraph(value: str = "") -> dict:
    return node("Paragraph", properties={"alignment": "left", "indent_level": 0, "spacing_before": 0, "spacing_after": 8, "line_spacing": 1.65}, children=[text(value)] if value else [])


def heading(value: str, level: int = 1) -> dict:
    return node("Heading", properties={"level": max(1, min(4, int(level))), "anchor": "", "numbering": False}, content={"text": value}, children=[], style_key="title")


def sample_document() -> dict:
    root = node("RootSection", properties={"title": "Root", "layout_mode": "standard", "collapsed": False, "pinned": False}, children=[
        heading("独自ドキュメントプラットフォーム", 1),
        paragraph("Node の木構造、Theme、Resource、Operation API に基づいて業務文書を編集します。"),
        node("Callout", properties={"kind": "info", "title": "設計思想", "icon": "info", "collapsed": False}, children=[paragraph("意味と見た目を分離し、保存形式は JSON ベースの .dcf とします。")]),
    ])
    return node("Document", properties={"title": "新規ドキュメント"}, content={}, children=[root])


def sample_package() -> dict:
    doc = sample_document()
    return {
        "manifest": {"package_id": new_id("pkg"), "format": FORMAT, "format_version": FORMAT_VERSION, "title": "新規ドキュメント", "primary_document_id": doc["id"]},
        "document": doc,
        "theme": deepcopy(DEFAULT_THEME),
        "resources": [],
        "settings": {"autosave": False, "sharepoint_path": ""},
    }
