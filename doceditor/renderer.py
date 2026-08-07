from __future__ import annotations

from html import escape


def render_inline(n: dict) -> str:
    t = n.get("type")
    c = n.get("content", {})
    children = ''.join(render_inline(x) for x in n.get("children", []))
    if t == "Text": return escape(c.get("text", ""))
    if t == "Bold": return f"<strong>{children}</strong>"
    if t == "Italic": return f"<em>{children}</em>"
    if t == "Underline": return f"<u>{children}</u>"
    if t == "InlineCode": return f"<code>{escape(c.get('text', ''))}</code>"
    if t == "Link": return f"<a href='{escape(c.get('href', '#'))}'>{escape(c.get('label', '')) or children}</a>"
    if t == "Reference": return f"<a class='reference' data-target='{escape(c.get('target_node_id', ''))}'>{escape(c.get('label', 'Reference'))}</a>"
    return children


def render_node(n: dict) -> str:
    if not n.get("metadata", {}).get("visible", True): return ""
    t, p, c = n.get("type"), n.get("properties", {}), n.get("content", {})
    kids = ''.join(render_node(x) for x in n.get("children", []))
    if t in {"Document", "RootSection", "Section"}: return f"<section data-node='{n.get('id')}'>{kids}</section>"
    if t == "Heading": return f"<h{p.get('level',1)} data-node='{n.get('id')}'>{escape(c.get('text',''))}</h{p.get('level',1)}>"
    if t == "Paragraph": return f"<p data-node='{n.get('id')}'>{''.join(render_inline(x) for x in n.get('children', []))}</p>"
    if t == "Callout": return f"<aside class='callout {escape(p.get('kind','info'))}'><b>{escape(p.get('title',''))}</b>{kids}</aside>"
    if t == "List": return f"<{'ol' if p.get('kind')=='ordered' else 'ul'}>{kids}</{'ol' if p.get('kind')=='ordered' else 'ul'}>"
    if t == "ListItem": return f"<li>{kids or ''.join(render_inline(x) for x in n.get('children', []))}</li>"
    if t == "Image": return f"<figure><img src='{escape(c.get('src',''))}' alt='{escape(c.get('alt',''))}'/><figcaption>{escape(c.get('caption',''))}</figcaption></figure>"
    if t == "CodeBlock": return f"<pre><code>{escape(c.get('content',''))}</code></pre>"
    if t == "Divider": return "<hr/>"
    if t == "Quote": return f"<blockquote>{''.join(render_inline(x) for x in n.get('children', []))}</blockquote>"
    if t == "Table": return f"<table>{kids}</table>"
    if t == "TableRow": return f"<tr>{kids}</tr>"
    if t == "TableCell": return f"<td>{kids}</td>"
    return f"<div>{kids}</div>"


def render_html(package: dict) -> str:
    tokens = package.get("theme", {}).get("tokens", {})
    colors = tokens.get("colors", {})
    css = (
        f":root{{--font:{tokens.get('font_family','sans-serif')};--text:{colors.get('text','#111')};--accent:{colors.get('accent','#2563eb')}}}"
        f"body{{font-family:var(--font);color:var(--text);line-height:{tokens.get('line_height','1.6')}}}"
        f".callout{{background:{colors.get('callout','#eff6ff')};border-left:4px solid var(--accent);padding:1rem;margin:1rem 0}}"
    )
    return f"<!doctype html><html><head><meta charset='utf-8'><style>{css}</style></head><body>{render_node(package['document'])}</body></html>"


def render_text(n: dict) -> str:
    t = n.get("type")
    if t in {"Text", "InlineCode"}: return n.get("content", {}).get("text", "")
    if t == "Heading": return "#" * n.get("properties", {}).get("level", 1) + " " + n.get("content", {}).get("text", "") + "\n"
    if t == "CodeBlock": return n.get("content", {}).get("content", "") + "\n"
    return "".join(render_text(x) for x in n.get("children", [])) + ("\n" if t == "Paragraph" else "")
