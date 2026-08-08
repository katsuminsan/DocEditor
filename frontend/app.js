let state = null;
let selectedId = null;
const blocks = [
  {type:'Heading', icon:'H', label:'見出し'}, {type:'Paragraph', icon:'¶', label:'段落'},
  {type:'Callout', icon:'ⓘ', label:'コールアウト'}, {type:'CodeBlock', icon:'{}', label:'コード'},
  {type:'Divider', icon:'—', label:'区切り線'}, {type:'List', icon:'•', label:'箇条書き'},
  {type:'OrderedList', icon:'1.', label:'番号付きリスト'}, {type:'Quote', icon:'❝', label:'引用'}
];
const api = () => window.pywebview.api;
const $ = (q) => document.querySelector(q);
function esc(s){return String(s ?? '').replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));}
function inline(n){return n.type === 'Text' ? esc(n.content.text) : (n.children || []).map(inline).join('');}
function plain(n){if(n.type==='Heading')return n.content.text;if(n.type==='Paragraph'||n.type==='Quote')return (n.children||[]).map(inline).join('');if(n.type==='CodeBlock')return n.content.content||'';return '';}
function find(n,id){if(n.id===id)return n;for(const c of n.children||[]){const f=find(c,id);if(f)return f;}return null;}
function currentParent(){return state.package.document.children[0].id;}
function renderNode(n){
  if(n.metadata && !n.metadata.visible) return '';
  const selected = selectedId === n.id ? 'selected' : '';
  const wrap = (html, icon='□') => `<div class="node ${selected}" id="node-${n.id}" data-id="${n.id}" data-type="${n.type}"><button class="insert-plus" data-plus="${n.id}">＋</button><span class="node-icon">${icon}</span>${html}</div>`;
  if(n.type==='Document'||n.type==='RootSection'||n.type==='Section') return (n.children||[]).map(renderNode).join('');
  if(n.type==='Heading') return wrap(`<h${n.properties.level} class="editable" contenteditable="true" data-edit="${n.id}">${esc(n.content.text)}</h${n.properties.level}>`,'H');
  if(n.type==='Paragraph') return wrap(`<p class="editable" contenteditable="true" data-edit="${n.id}">${(n.children||[]).map(inline).join('') || '<br>'}</p>`,'¶');
  if(n.type==='Callout') return wrap(`<div class="callout"><strong class="editable" contenteditable="true" data-edit-title="${n.id}">${esc(n.properties.title)}</strong>${(n.children||[]).map(renderNode).join('')}</div>`,'ⓘ');
  if(n.type==='CodeBlock') return wrap(`<pre class="editable code-edit" contenteditable="true" data-edit="${n.id}">${esc(n.content.content)}</pre>`,'{}');
  if(n.type==='Divider') return wrap('<hr>','—');
  if(n.type==='List') return wrap(`<${n.properties.kind==='ordered'?'ol':'ul'}>${(n.children||[]).map(renderNode).join('')}</${n.properties.kind==='ordered'?'ol':'ul'}>` , n.properties.kind==='ordered'?'1.':'•');
  if(n.type==='ListItem') return wrap((n.children||[]).map(renderNode).join(''),'•');
  if(n.type==='Quote') return wrap(`<blockquote class="editable quote" contenteditable="true" data-edit="${n.id}">${(n.children||[]).map(inline).join('')}</blockquote>`,'❝');
  return wrap((n.children||[]).map(renderNode).join(''));
}
function renderOutline(n,depth=0){
  const label = n.type==='Heading' ? n.content.text : (n.properties?.title || n.type);
  const visible = ['Document','RootSection','Section','Heading','Callout','List','Quote','CodeBlock'].includes(n.type);
  const row = visible ? `<button data-jump="${n.id}" style="padding-left:${depth*14+8}px">${esc(label)}</button>` : '';
  return row + (n.children||[]).map(c=>renderOutline(c,depth+1)).join('');
}
function renderBlocks(){ $('#blockList').innerHTML = blocks.map(b=>`<button class="block-btn" data-add="${b.type}"><span class="block-icon">${b.icon}</span>${b.label}</button>`).join(''); }
function refresh(s){
  state = s.state || s;
  document.body.classList.toggle('dirty', state.dirty);
  document.body.classList.toggle('invalid', !state.validation.valid);
  $('#fileName').textContent = state.display_name;
  $('#dirtyBadge').textContent = state.dirty ? '未保存' : '保存済み';
  $('#canvas').innerHTML = renderNode(state.package.document);
  $('#outline').innerHTML = renderOutline(state.package.document);
  $('#validation').textContent = state.validation.valid ? 'OK' : state.validation.errors.join('\n');
  $('#recentFolders').innerHTML = (state.settings.recent_folders||[]).map(x=>`<div>📁 ${esc(x)}</div>`).join('') || '<p>なし</p>';
  $('#pinnedFolders').innerHTML = (state.settings.pinned_folders||[]).map(x=>`<div>📌 ${esc(x)}</div>`).join('') || '<p>なし</p>';
  renderProps();
}
function renderProps(){
  const n = selectedId && find(state.package.document, selectedId);
  if(!n){ $('#propBody').innerHTML = '<p>ブロックを選択してください。</p>'; return; }
  const blockOptions = blocks.map(b=>`<option value="${b.type}" ${b.type===n.type || (b.type==='OrderedList' && n.type==='List' && n.properties.kind==='ordered') || (b.type==='List' && n.type==='List' && n.properties.kind!=='ordered') ? 'selected' : ''}>${b.icon} ${b.label}</option>`).join('');
  $('#propBody').innerHTML = `<label>ブロック種別<select id="propType">${blockOptions}</select></label><label>ID<input value="${esc(n.id)}" readonly></label><label>Properties<textarea id="propProperties">${esc(JSON.stringify(n.properties||{},null,2))}</textarea></label><label>Content<textarea id="propContent">${esc(JSON.stringify(n.content||{},null,2))}</textarea></label><label><input id="propVisible" type="checkbox" ${n.metadata.visible?'checked':''}> 表示</label><label><input id="propLocked" type="checkbox" ${n.metadata.locked?'checked':''}> ロック</label>`;
}
async function ensureSaved(){
  if(!state?.dirty) return 'discard';
  $('#confirmText').textContent = '未保存の変更があります。保存しますか？';
  confirmDialog.showModal();
  const choice = await new Promise(resolve => confirmDialog.addEventListener('close',()=>resolve(confirmDialog.returnValue),{once:true}));
  if(choice === 'save'){ const r = await api().save_dialog(); if(!r.ok) return 'cancel'; refresh(r); return 'discard'; }
  return choice;
}
function openInsert(anchor){
  const menu = $('#insertMenu');
  const renderMenu = (query='') => {
    const q = query.toLowerCase();
    const filtered = blocks.filter(b => b.label.toLowerCase().includes(q) || b.type.toLowerCase().includes(q));
    menu.innerHTML = `<input id="blockSearch" placeholder="/ ブロックを検索" value="${esc(query)}">` + filtered.map(b=>`<button class="block-btn" data-insert="${b.type}"><span class="block-icon">${b.icon}</span>${b.label}</button>`).join('');
    $('#blockSearch').oninput = e => renderMenu(e.target.value);
    $('#blockSearch').focus();
  };
  renderMenu();
  const rect = anchor.getBoundingClientRect(); menu.style.left = `${rect.left}px`; menu.style.top = `${rect.bottom + 4}px`; menu.hidden = false;
}
async function init(){renderBlocks(); refresh(await api().get_state());}
document.addEventListener('click', async e => {
  const tab = e.target.closest('[data-tab]'); if(tab){document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===tab));document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==tab.dataset.tab);}
  const node = e.target.closest('[data-id]'); if(node){selectedId=node.dataset.id; refresh(state);}
  const jump = e.target.closest('[data-jump]'); if(jump){selectedId=jump.dataset.jump; refresh(state); document.getElementById(`node-${selectedId}`)?.scrollIntoView({behavior:'smooth',block:'center'});}
  const add = e.target.closest('[data-add]'); if(add) refresh(await api().add_node(currentParent(), add.dataset.add, ''));
  const plus = e.target.closest('[data-plus]'); if(plus){selectedId=plus.dataset.plus; openInsert(plus);}
  const insert = e.target.closest('[data-insert]'); if(insert){$('#insertMenu').hidden=true; refresh(await api().add_node(currentParent(), insert.dataset.insert, ''));}
});
document.addEventListener('focusout', async e => { const edit=e.target.closest('[data-edit]'); if(edit) refresh(await api().update_text(edit.dataset.edit, edit.innerText)); const title=e.target.closest('[data-edit-title]'); if(title) refresh(await api().update_node(title.dataset.editTitle, {title:title.innerText}, null, null)); });
document.addEventListener('keydown', e => { if(e.key==='/' && e.target.isContentEditable){e.preventDefault(); openInsert(e.target);} if(e.ctrlKey&&e.altKey&&e.key.toLowerCase()==='p'){e.preventDefault(); $('#layout').classList.remove('props-closed'); $('#properties').hidden=false; renderProps();} });
document.addEventListener('contextmenu', e => { const node=e.target.closest('[data-id]'); if(node){e.preventDefault(); selectedId=node.dataset.id; $('#layout').classList.remove('props-closed'); $('#properties').hidden=false; refresh(state);} });
$('#toggleSidebar').onclick=()=>$('#layout').classList.toggle('sidebar-closed'); $('#toggleMenuMode').onclick=()=>$('#layout').classList.toggle('menu-collapsed'); $('#closeProps').onclick=()=>{$('#properties').hidden=true;$('#layout').classList.add('props-closed');};
$('#applyProps').onclick=async()=>{const n=find(state.package.document,selectedId); if(!n)return; const newType=$('#propType').value; if(newType && (newType!==n.type && !(n.type==='List' && ['List','OrderedList'].includes(newType)))){refresh(await api().change_node_type(selectedId,newType)); return;} if(n.type==='List' && ((newType==='OrderedList') !== (n.properties.kind==='ordered'))){refresh(await api().change_node_type(selectedId,newType)); return;} refresh(await api().update_node(selectedId, JSON.parse($('#propProperties').value), JSON.parse($('#propContent').value), {visible:$('#propVisible').checked, locked:$('#propLocked').checked}));};
$('#undo').onclick=async()=>refresh(await api().undo()); $('#redo').onclick=async()=>refresh(await api().redo()); $('#validate').onclick=async()=>$('#validation').textContent=JSON.stringify(await api().validate(),null,2);
async function guarded(action){const c=await ensureSaved(); if(c==='cancel')return; refresh(await action(c==='discard'));}
$('#newDoc').onclick=$('#fileNew').onclick=()=>guarded(d=>api().new_document(d)); $('#openDoc').onclick=$('#fileOpen').onclick=()=>guarded(d=>api().open_dialog(d));
$('#saveDoc').onclick=$('#fileSave').onclick=async()=>refresh(await api().save_dialog()); $('#saveAsDoc').onclick=$('#fileSaveAs').onclick=async()=>refresh(await api().save_as_dialog());
$('#exportHtml').onclick=$('#fileExport').onclick=async()=>{const r=await api().export_html_dialog(); if(r.ok) refresh(r);};
$('#quitApp').onclick=()=>guarded(d=>api().close_app(d));
$('#search').oninput=e=>{const q=e.target.value.toLowerCase(); const hits=[]; function walk(n){if(plain(n).toLowerCase().includes(q)&&q)hits.push(n);(n.children||[]).forEach(walk);} walk(state.package.document); $('#searchResults').innerHTML=hits.map(n=>`<button data-jump="${n.id}">${esc(plain(n).slice(0,60)||n.type)}</button>`).join('');};
window.addEventListener('beforeunload', e => { if(state?.dirty){ e.preventDefault(); e.returnValue=''; }});
window.addEventListener('pywebviewready', init);
