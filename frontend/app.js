let state = null,
  selectedId = null;

const api = () => window.pywebview.api;

function esc(s) {
  return String(s ?? "").replace(
    /[&<>]/g,
    (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[m],
  );
}

function inline(n) {
  if (n.type === "Text") return esc(n.content.text);
  return (n.children || []).map(inline).join("");
}

function renderNode(n) {
  if (n.metadata && !n.metadata.visible) return "";
  const kids = (n.children || []).map(renderNode).join("");
  let body = "";
  if (n.type === "Heading")
    body = `<h${n.properties.level}>${esc(n.content.text)}</h${n.properties.level}>`;
  else if (n.type === "Paragraph")
    body = `<p>${(n.children || []).map(inline).join("") || "<br>"}</p>`;
  else if (n.type === "Callout")
    body = `<div class="callout"><b>${esc(n.properties.title)}</b>${kids}</div>`;
  else if (n.type === "CodeBlock")
    body = `<pre>${esc(n.content.content)}</pre>`;
  else if (n.type === "Divider") body = "<hr>";
  else body = kids;
  return `<div class="node ${selectedId === n.id ? "selected" : ""}" data-id="${n.id}" data-type="${n.type}">${body}</div>`;
}

function outline(n, depth = 0) {
  let label =
    n.type === "Heading" ? n.content.text : n.properties?.title || n.type;
  let html = `<button data-sel="${n.id}" style="padding-left:${depth * 12 + 6}px">${esc(label)}</button>`;
  return html + (n.children || []).map((c) => outline(c, depth + 1)).join("");
}

function find(n, id) {
  if (n.id === id) return n;
  for (const c of n.children || []) {
    const f = find(c, id);
    if (f) return f;
  }
  return null;
}

function refresh(s) {
  state = s;
  document.querySelector("#canvas").innerHTML = renderNode(s.package.document);
  document.querySelector("#outline").innerHTML = outline(s.package.document);
  document.querySelector("#validation").textContent = s.validation.valid
    ? "OK"
    : s.validation.errors.join("\n");
  document.querySelector("#selected").value = selectedId || "";
  const n = selectedId && find(s.package.document, selectedId);
  document.querySelector("#text").value =
    n?.type === "Heading"
      ? n.content.text
      : n?.type === "Paragraph"
        ? (n.children || []).map(inline).join("")
        : "";
}

async function init() {
  refresh(await api().get_state());
}

document.addEventListener("click", async (e) => {
  const node = e.target.closest("[data-id]");
  if (node) {
    selectedId = node.dataset.id;
    refresh(state);
  }
  const sel = e.target.closest("[data-sel]");
  if (sel) {
    selectedId = sel.dataset.sel;
    refresh(state);
  }
  const add = e.target.dataset.add;
  if (add) {
    const parent = selectedId || state.package.document.children[0].id;
    refresh(await api().add_node(parent, add, ""));
  }
});

document.querySelector("#applyText").onclick = async () => {
  if (selectedId)
    refresh(
      await api().update_text(
        selectedId,
        document.querySelector("#text").value,
      ),
    );
};

document.querySelector("#undo").onclick = async () =>
  refresh(await api().undo());

document.querySelector("#redo").onclick = async () =>
  refresh(await api().redo());

document.querySelector("#normalize").onclick = async () =>
  refresh(await api().normalize());

document.querySelector("#validate").onclick = async () =>
  (document.querySelector("#validation").textContent = JSON.stringify(
    await api().validate(),
    null,
    2,
  ));

document.querySelector("#export").onclick = async () => {
  dialogText.textContent = await api().render("html");
  dialog.showModal();
};

window.addEventListener("pywebviewready", init);


