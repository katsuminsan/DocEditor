let state = null;
let selectedId = null;
let selectedTab = 'blocks';

const blocks = [
  { type: 'Heading', icon: 'H', label: '見出し' },
  { type: 'Paragraph', icon: '¶', label: '段落' },
  { type: 'Callout', icon: 'ⓘ', label: 'コールアウト' },
  { type: 'CodeBlock', icon: '{}', label: 'コード' },
  { type: 'Divider', icon: '—', label: '区切り線' },
  { type: 'List', icon: '•', label: '箇条書き' },
  { type: 'OrderedList', icon: '1.', label: '番号付きリスト' },
  { type: 'Quote', icon: '❝', label: '引用' },
];

const api = () => window.pywebview?.api;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>]/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
  })[ch]);
}

function renderInline(node) {
  if (!node) return '';
  if (node.type === 'Text') return escapeHtml(node.content?.text);
  return (node.children || []).map(renderInline).join('');
}

function plainText(node) {
  if (!node) return '';
  if (node.type === 'Heading') return node.content?.text || '';
  if (node.type === 'Paragraph' || node.type === 'Quote') return (node.children || []).map(renderInline).join('');
  if (node.type === 'CodeBlock') return node.content?.content || '';
  return '';
}

function findNode(node, id) {
  if (!node) return null;
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function currentParentId() {
  return state?.package?.document?.children?.[0]?.id ?? null;
}

function renderNode(node) {
  if (!node || (node.metadata && node.metadata.visible === false)) return '';
  const selectedClass = selectedId === node.id ? 'selected' : '';
  const safeId = escapeHtml(node.id);
  const safeType = escapeHtml(node.type);
  const childrenHtml = (node.children || []).map(renderNode).join('');
  const wrapper = (html, icon = '□') =>
    `<div class="node ${selectedClass}" id="node-${safeId}" data-id="${safeId}" data-type="${safeType}"><button class="insert-plus" data-plus="${safeId}">＋</button><span class="node-icon">${icon}</span>${html}</div>`;

  if (['Document', 'RootSection', 'Section'].includes(node.type)) {
    return childrenHtml;
  }

  if (node.type === 'Heading') {
    const level = node.properties?.level || 1;
    return wrapper(`<h${level} class="editable" contenteditable="true" data-edit="${safeId}">${escapeHtml(node.content?.text)}</h${level}>`, 'H');
  }

  if (node.type === 'Paragraph') {
    const html = (node.children || []).map(renderInline).join('') || '<br>';
    return wrapper(`<p class="editable" contenteditable="true" data-edit="${safeId}">${html}</p>`, '¶');
  }

  if (node.type === 'Callout') {
    return wrapper(`<div class="callout"><strong class="editable" contenteditable="true" data-edit-title="${safeId}">${escapeHtml(node.properties?.title)}</strong>${childrenHtml}</div>`, 'ⓘ');
  }

  if (node.type === 'CodeBlock') {
    return wrapper(`<pre class="editable code-edit" contenteditable="true" data-edit="${safeId}">${escapeHtml(node.content?.content)}</pre>`, '{}');
  }

  if (node.type === 'Divider') {
    return wrapper('<hr>', '—');
  }

  if (node.type === 'List') {
    const tag = node.properties?.kind === 'ordered' ? 'ol' : 'ul';
    return wrapper(`<${tag}>${childrenHtml}</${tag}>`, node.properties?.kind === 'ordered' ? '1.' : '•');
  }

  if (node.type === 'ListItem') {
    return wrapper(childrenHtml, '•');
  }

  if (node.type === 'Quote') {
    return wrapper(`<blockquote class="editable quote" contenteditable="true" data-edit="${safeId}">${(node.children || []).map(renderInline).join('')}</blockquote>`, '❝');
  }

  return wrapper(childrenHtml);
}

function renderOutline(node, depth = 0) {
  if (!node) return '';
  const label = node.type === 'Heading' ? node.content?.text : node.properties?.title || node.type;
  const visibleTypes = ['Document', 'RootSection', 'Section', 'Heading', 'Callout', 'List', 'Quote', 'CodeBlock'];
  const button = visibleTypes.includes(node.type)
    ? `<button data-jump="${escapeHtml(node.id)}" style="padding-left:${depth * 14 + 8}px">${escapeHtml(label)}</button>`
    : '';
  return button + (node.children || []).map((child) => renderOutline(child, depth + 1)).join('');
}

function renderBlocks() {
  const container = $('#blockList');
  if (!container) return;
  container.innerHTML = blocks
    .map((block) => `<button class="block-btn" data-add="${escapeHtml(block.type)}"><span class="block-icon">${escapeHtml(block.icon)}</span>${escapeHtml(block.label)}</button>`)
    .join('');
}

function updateMenuState() {
  $$('[data-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === selectedTab);
  });
  $$('[data-panel]').forEach((panel) => {
    panel.hidden = selectedTab !== panel.dataset.panel;
  });
  const panels = $('.accordion-panels');
  if (!panels) return;
  const anyVisible = $$('.accordion-panels > section').some((section) => !section.hidden);
  panels.classList.toggle('hidden', !anyVisible);
}

function renderProps() {
  const container = $('#propBody');
  if (!container) return;
  const node = selectedId ? findNode(state?.package?.document, selectedId) : null;
  if (!node) {
    container.innerHTML = '<p>ブロックを選択してください。</p>';
    return;
  }
  const options = blocks
    .map((block) => {
      const selected =
        block.type === node.type ||
        (block.type === 'OrderedList' && node.type === 'List' && node.properties?.kind === 'ordered') ||
        (block.type === 'List' && node.type === 'List' && node.properties?.kind !== 'ordered');
      return `<option value="${escapeHtml(block.type)}" ${selected ? 'selected' : ''}>${escapeHtml(block.icon)} ${escapeHtml(block.label)}</option>`;
    })
    .join('');
  container.innerHTML = `
    <label>ブロック種別<select id="propType">${options}</select></label>
    <label>ID<input value="${escapeHtml(node.id)}" readonly></label>
    <label>Properties<textarea id="propProperties">${escapeHtml(JSON.stringify(node.properties || {}, null, 2))}</textarea></label>
    <label>Content<textarea id="propContent">${escapeHtml(JSON.stringify(node.content || {}, null, 2))}</textarea></label>
    <label><input id="propVisible" type="checkbox" ${node.metadata?.visible ? 'checked' : ''}> 表示</label>
    <label><input id="propLocked" type="checkbox" ${node.metadata?.locked ? 'checked' : ''}> ロック</label>
  `;
}

function updateShell() {
  document.body.classList.toggle('dirty', !!state?.dirty);
  document.body.classList.toggle('invalid', !state?.validation?.valid);
  const fileName = $('#fileName');
  if (fileName) fileName.textContent = state?.display_name || 'Untitled.dcf';
  const dirtyBadge = $('#dirtyBadge');
  if (dirtyBadge) dirtyBadge.textContent = state?.dirty ? '未保存' : '保存済み';
  const canvas = $('#canvas');
  if (canvas) canvas.innerHTML = renderNode(state?.package?.document);
  const outline = $('#outline');
  if (outline) outline.innerHTML = renderOutline(state?.package?.document);
  const validation = $('#validation');
  if (validation) validation.textContent = state?.validation?.valid ? 'OK' : (state?.validation?.errors || []).join('\n');
  const recentFolders = $('#recentFolders');
  if (recentFolders) {
    recentFolders.innerHTML = (state?.settings?.recent_folders || []).map((folder) => `<div>📁 ${escapeHtml(folder)}</div>`).join('') || '<p>なし</p>';
  }
  const pinnedFolders = $('#pinnedFolders');
  if (pinnedFolders) pinnedFolders.innerHTML = (state?.settings?.pinned_folders || []).map((folder) => `<div>📌 ${escapeHtml(folder)}</div>`).join('') || '<p>なし</p>';
  renderProps();
  renderBlocks();
  updateMenuState();
}

async function refresh(newState) {
  if (!newState) return;
  state = newState.state || newState;
  updateShell();
}

async function ensureSaved() {
  if (!state?.dirty) return 'discard';
  const confirmDialog = $('#confirmDialog');
  const confirmText = $('#confirmText');
  if (!confirmDialog || !confirmText) return 'discard';
  confirmText.textContent = '未保存の変更があります。保存しますか？';
  confirmDialog.showModal();
  const choice = await new Promise((resolve) => {
    const handler = () => {
      resolve(confirmDialog.returnValue);
      confirmDialog.removeEventListener('close', handler);
    };
    confirmDialog.addEventListener('close', handler);
  });
  if (choice === 'save') {
    const apiClient = api();
    if (!apiClient) return 'cancel';
    const result = await apiClient.save_dialog();
    if (!result?.ok) return 'cancel';
    await refresh(result);
    return 'discard';
  }
  return choice;
}

function hideInsertMenu() {
  const menu = $('#insertMenu');
  if (menu) menu.hidden = true;
}

function openInsert(anchor) {
  const menu = $('#insertMenu');
  if (!menu || !anchor) return;
  const renderInsertItems = (query = '') => {
    const filter = query.toLowerCase();
    menu.innerHTML = `<input id="blockSearch" placeholder="/ ブロックを検索" value="${escapeHtml(query)}">${blocks
      .filter((block) => block.label.toLowerCase().includes(filter) || block.type.toLowerCase().includes(filter))
      .map((block) => `<button class="block-btn" data-insert="${escapeHtml(block.type)}"><span class="block-icon">${escapeHtml(block.icon)}</span>${escapeHtml(block.label)}</button>`)
      .join('')}`;
    document.querySelector('#blockSearch')?.addEventListener('input', (event) => renderInsertItems(event.target.value));
    document.querySelector('#blockSearch')?.focus();
  };
  renderInsertItems();
  const rect = anchor.getBoundingClientRect();
  menu.style.left = `${rect.left}px`;
  menu.style.top = `${rect.bottom + 4}px`;
  menu.hidden = false;
}

function handleTabClick(tabName) {
  selectedTab = selectedTab === tabName ? null : tabName;
  updateMenuState();
}

function selectNode(nodeId) {
  selectedId = nodeId;
  renderProps();
  updateShell();
}

function moveTooltip(event, label) {
  const tooltipElement = $('#iconTooltip');
  if (!tooltipElement) return;
  tooltipElement.textContent = label;
  tooltipElement.style.left = `${event.clientX + 12}px`;
  tooltipElement.style.top = `${event.clientY + 12}px`;
  tooltipElement.style.display = 'block';
}

function hideTooltip() {
  const tooltipElement = $('#iconTooltip');
  if (tooltipElement) tooltipElement.style.display = 'none';
}

let tooltipTarget = null;

function setupListeners() {
  document.addEventListener('click', async (event) => {
    const tabButton = event.target.closest('[data-tab]');
    if (tabButton) {
      handleTabClick(tabButton.dataset.tab);
      return;
    }
    const plusBtn = event.target.closest('[data-plus]');
    if (plusBtn) {
      selectedId = plusBtn.dataset.plus;
      openInsert(plusBtn);
      return;
    }
    const insertBtn = event.target.closest('[data-insert]');
    if (insertBtn) {
      hideInsertMenu();
      const parentId = currentParentId();
      if (parentId && api()) {
        await refresh(await api().add_node(parentId, insertBtn.dataset.insert, ''));
      }
      return;
    }
    const addBtn = event.target.closest('[data-add]');
    if (addBtn) {
      const parentId = currentParentId();
      if (parentId && api()) {
        await refresh(await api().add_node(parentId, addBtn.dataset.add, ''));
      }
      return;
    }
    const jumpBtn = event.target.closest('[data-jump]');
    if (jumpBtn) {
      selectNode(jumpBtn.dataset.jump);
      document.getElementById(`node-${jumpBtn.dataset.jump}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const nodeItem = event.target.closest('[data-id]');
    if (nodeItem) {
      selectNode(nodeItem.dataset.id);
      return;
    }
    if (!event.target.closest('#insertMenu')) {
      hideInsertMenu();
    }
  });

  document.addEventListener('focusout', async (event) => {
    const editTarget = event.target.closest('[data-edit]');
    if (editTarget && api()) {
      await refresh(await api().update_text(editTarget.dataset.edit, editTarget.innerText));
      return;
    }
    const titleTarget = event.target.closest('[data-edit-title]');
    if (titleTarget && api()) {
      await refresh(await api().update_node(titleTarget.dataset.editTitle, { title: titleTarget.innerText }, null, null));
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && event.target?.isContentEditable) {
      event.preventDefault();
      openInsert(event.target);
      return;
    }
    if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      $('#layout')?.classList.remove('props-closed');
      const propsPanel = $('#properties');
      if (propsPanel) propsPanel.hidden = false;
      renderProps();
    }
  });

  document.addEventListener('contextmenu', (event) => {
    const nodeItem = event.target.closest('[data-id]');
    if (!nodeItem) return;
    event.preventDefault();
    selectedId = nodeItem.dataset.id;
    $('#layout')?.classList.remove('props-closed');
    const propsPanel = $('#properties');
    if (propsPanel) propsPanel.hidden = false;
    renderProps();
  });

  $('#toggleSidebar')?.addEventListener('click', () => {
    $('#layout')?.classList.toggle('sidebar-closed');
  });

  $('#toggleMenuMode')?.addEventListener('click', () => {
    $('#layout')?.classList.toggle('menu-collapsed');
  });

  $('#closeProps')?.addEventListener('click', () => {
    const propsPanel = $('#properties');
    if (propsPanel) propsPanel.hidden = true;
    $('#layout')?.classList.add('props-closed');
  });

  $('#applyProps')?.addEventListener('click', async () => {
    const node = selectedId ? findNode(state?.package?.document, selectedId) : null;
    const apiClient = api();
    if (!node || !apiClient) return;
    const newType = $('#propType')?.value;
    if (!newType) return;
    if (newType !== node.type && !(node.type === 'List' && ['List', 'OrderedList'].includes(newType))) {
      await refresh(await apiClient.change_node_type(selectedId, newType));
      return;
    }
    if (node.type === 'List' && (newType === 'OrderedList') !== (node.properties?.kind === 'ordered')) {
      await refresh(await apiClient.change_node_type(selectedId, newType));
      return;
    }
    await refresh(
      await apiClient.update_node(
        selectedId,
        JSON.parse($('#propProperties')?.value || '{}'),
        JSON.parse($('#propContent')?.value || '{}'),
        { visible: $('#propVisible')?.checked, locked: $('#propLocked')?.checked },
      ),
    );
  });

  $('#undo')?.addEventListener('click', async () => {
    if (api()) await refresh(await api().undo());
  });

  $('#redo')?.addEventListener('click', async () => {
    if (api()) await refresh(await api().redo());
  });

  $('#validate')?.addEventListener('click', async () => {
    if (api()) $('#validation').textContent = JSON.stringify(await api().validate(), null, 2);
  });

  const bindAction = (selector, handler) => {
    const element = $(selector);
    if (!element) return;
    element.addEventListener('click', handler);
  };

  bindAction('#newDoc', () => guarded((discard) => api()?.new_document(discard)));
  bindAction('#fileNew', () => guarded((discard) => api()?.new_document(discard)));
  bindAction('#openDoc', () => guarded((discard) => api()?.open_dialog(discard)));
  bindAction('#fileOpen', () => guarded((discard) => api()?.open_dialog(discard)));
  bindAction('#saveDoc', async () => { if (api()) await refresh(await api().save_dialog()); });
  bindAction('#fileSave', async () => { if (api()) await refresh(await api().save_dialog()); });
  bindAction('#saveAsDoc', async () => { if (api()) await refresh(await api().save_as_dialog()); });
  bindAction('#fileSaveAs', async () => { if (api()) await refresh(await api().save_as_dialog()); });
  bindAction('#exportHtml', async () => { if (api()) { const result = await api().export_html_dialog(); if (result?.ok) await refresh(result); } });
  bindAction('#quitApp', () => guarded((discard) => api()?.close_app(discard)));

  const searchInput = $('#search');
  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      const query = event.target.value.toLowerCase();
      const hits = [];
      function walk(node) {
        if (!node) return;
        const value = plainText(node).toLowerCase();
        if (query && value.includes(query)) hits.push(node);
        (node.children || []).forEach(walk);
      }
      walk(state?.package?.document);
      const results = $('#searchResults');
      if (results) {
        results.innerHTML = hits
          .map((node) => `<button data-jump="${escapeHtml(node.id)}">${escapeHtml(plainText(node).slice(0, 60) || node.type)}</button>`)
          .join('');
      }
    });
  }

  window.addEventListener('beforeunload', (event) => {
    if (state?.dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  document.addEventListener('mouseover', (event) => {
    if (!$('#layout')?.classList.contains('menu-collapsed')) return;
    const target = event.target.closest('.accordion-head, .menu-toggle');
    if (!target) return;
    const label = target.querySelector('.menu-label')?.textContent || target.getAttribute('title');
    if (!label) return;
    tooltipTarget = target;
    moveTooltip(event, label);
  });

  document.addEventListener('mousemove', (event) => {
    if (!tooltipTarget) return;
    moveTooltip(event, document.getElementById('iconTooltip')?.textContent || '');
  });

  document.addEventListener('mouseout', (event) => {
    const related = event.relatedTarget || event.toElement;
    if (tooltipTarget && (!related || !tooltipTarget.contains(related))) {
      tooltipTarget = null;
      hideTooltip();
    }
  });
}

async function guarded(action) {
  const decision = await ensureSaved();
  if (decision === 'cancel') return;
  if (!action) return;
  if (!api()) return;
  await refresh(await action(decision === 'discard'));
}

function createTooltip() {
  const tooltip = document.createElement('div');
  tooltip.id = 'iconTooltip';
  tooltip.style.position = 'fixed';
  tooltip.style.pointerEvents = 'none';
  tooltip.style.background = '#111827';
  tooltip.style.color = '#fff';
  tooltip.style.padding = '6px 8px';
  tooltip.style.fontSize = '12px';
  tooltip.style.borderRadius = '6px';
  tooltip.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.25)';
  tooltip.style.zIndex = '60';
  tooltip.style.display = 'none';
  document.body.appendChild(tooltip);
}

async function init() {
  createTooltip();
  renderBlocks();
  setupListeners();
  const apiClient = api();
  if (!apiClient) return;
  const initialState = await apiClient.get_state();
  await refresh(initialState);
}

window.addEventListener('pywebviewready', init);
