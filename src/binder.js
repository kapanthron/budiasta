// Binder tree: render, select, add, rename, delete-to-trash, reorder.
import { uid, findNode, blankDoc } from './store.js';

export function initBinder(app) {
  const treeEl = document.getElementById('tree');

  function render() {
    treeEl.textContent = '';
    treeEl.append(renderList(app.state.tree));
  }

  function renderList(nodes) {
    const frag = document.createDocumentFragment();
    for (const node of nodes) {
      const li = document.createElement('li');
      li.setAttribute('role', 'treeitem');
      const row = document.createElement('div');
      row.className = 'node-row' + (node.id === app.currentDocId ? ' active' : '');
      row.tabIndex = 0;

      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.textContent = node.type === 'folder' ? '▸' : '·';
      const title = document.createElement('span');
      title.className = 'title';
      title.textContent = node.title;

      const actions = document.createElement('span');
      actions.className = 'actions';
      for (const [label, tip, fn] of [
        ['↑', 'Naik', () => move(node.id, -1)],
        ['↓', 'Turun', () => move(node.id, +1)],
        ['✎', 'Ganti nama', () => rename(row, title, node)],
        ['×', 'Hapus', () => remove(node.id)],
      ]) {
        const b = document.createElement('button');
        b.textContent = label; b.title = tip;
        b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
        actions.append(b);
      }

      row.append(icon, title, actions);
      row.addEventListener('click', () => {
        if (node.type === 'document') app.openDoc(node.id);
      });
      row.addEventListener('dblclick', () => rename(row, title, node));
      li.append(row);
      if (node.children?.length) {
        const ul = document.createElement('ul');
        ul.append(renderList(node.children));
        li.append(ul);
      }
      frag.append(li);
    }
    return frag;
  }

  function rename(row, titleEl, node) {
    const input = document.createElement('input');
    input.className = 'rename'; input.value = node.title;
    titleEl.replaceWith(input);
    input.focus(); input.select();
    const done = (commit) => {
      if (commit && input.value.trim() && input.value.trim() !== node.title) {
        app.logActivity?.('ganti-nama', `${node.title} -> ${input.value.trim()}`);
        node.title = input.value.trim();
      }
      app.save(); render();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') done(true);
      if (e.key === 'Escape') done(false);
    });
    input.addEventListener('blur', () => done(true));
  }

  function move(id, delta) {
    const hit = findNode(app.state.tree, id);
    if (!hit) return;
    const i = hit.siblings.indexOf(hit.node), j = i + delta;
    if (j < 0 || j >= hit.siblings.length) return;
    [hit.siblings[i], hit.siblings[j]] = [hit.siblings[j], hit.siblings[i]];
    app.save(); render();
  }

  function remove(id) {
    const hit = findNode(app.state.tree, id);
    if (!hit) return;
    const words = [];
    (function count(n) {
      if (n.type === 'document') words.push(app.state.documents[n.id]?.body?.length || 0);
      (n.children || []).forEach(count);
    })(hit.node);
    const hasText = words.some(w => w > 0);
    if (hasText && !confirm(`Hapus “${hit.node.title}”? Isinya masih ada di berkas ekspor terakhir, tetapi akan hilang dari proyek.`)) return;
    hit.siblings.splice(hit.siblings.indexOf(hit.node), 1);
    app.logActivity?.('hapus', hit.node.title);
    if (hit.node.id === app.currentDocId) {
      let next = null;
      (function first(nodes) { for (const n of nodes) { if (!next && n.type === 'document') next = n.id; first(n.children || []); } })(app.state.tree);
      if (next) app.openDoc(next); else { app.currentDocId = null; app.renderEditor(); }
    }
    app.save(); render();
  }

  function add(type) {
    const node = { id: uid(), type, title: type === 'folder' ? 'Map Baru' : 'Dokumen Baru', children: [] };
    // add beside the current doc if any, else at root
    const hit = app.currentDocId && findNode(app.state.tree, app.currentDocId);
    (hit ? hit.siblings : app.state.tree).push(node);
    if (type === 'document') {
      app.state.documents[node.id] = blankDoc();
      app.openDoc(node.id);
    }
    app.logActivity?.('buat', `${type}: ${node.title}`);
    app.save(); render();
    return node;
  }

  document.getElementById('btn-new-doc').addEventListener('click', () => add('document'));
  document.getElementById('btn-new-folder').addEventListener('click', () => add('folder'));

  app.renderBinder = render;
  app.addNode = add;
  render();
}
