// ===========================
// Checklist App JS
// ===========================

const list = document.getElementById("list");
const input = document.getElementById("itemInput");
const addBtn = document.getElementById("addItemBtn");
const togglePriorityBtn = document.getElementById("togglePriority");
const sortPriorityBtn = document.getElementById("sortPriority");
const deleteDoneBtn = document.getElementById("deleteDone");
const clearChecklistBtn = document.getElementById("clearChecklist");
const undoBtn = document.getElementById("undo");
const copyListBtn = document.getElementById("copyList");
const saveFileBtn = document.getElementById("saveFile");
const toggleInputPosBtn = document.getElementById("toggleInputPos");
const menuToggleMobile = document.getElementById("menuToggleMobile");

let items = [];
let showPriority = false;
let draggedId = null;
let dropTargetId = null;
let dropPosition = null; // 'before' | 'after'
let undoStack = [];
let listTitle = "Checklist Queue";
let inputAtTop = false;
let editingTemplateId = null;

const PRIORITIES = [
  { level: 1, label: "Later" },
  { level: 2, label: "Low" },
  { level: 3, label: "High" },
  { level: 4, label: "Very\nHigh" },
  { level: 5, label: "NOW" }
];

// ===========================
// Editable Title
// ===========================
const titleEl = document.querySelector("header h1");

function setupTitleEdit() {
  titleEl.onclick = () => {
    const inputEl = document.createElement("input");
    inputEl.type = "text";
    inputEl.value = listTitle;
    inputEl.className = "rename";
    inputEl.style.fontSize = "2rem";
    inputEl.style.fontWeight = "800";

    const finish = () => {
      if (inputEl.value.trim()) {
        const oldTitle = listTitle;
        listTitle = inputEl.value.trim();
        titleEl.textContent = listTitle;

        // If editing a template, rename template; otherwise rename checklist
        if (editingTemplateId) {
          renameTemplate(editingTemplateId, listTitle);
        } else {
          const data = getStorageData();
          if (data.checklists[oldTitle]) {
            renameChecklist(oldTitle, listTitle);
          }
          saveChecklist(listTitle);
        }
      } else {
        titleEl.textContent = listTitle;
      }
      inputEl.replaceWith(titleEl);
      setupTitleEdit(); // Re-attach event
    };

    inputEl.onblur = finish;
    inputEl.onkeydown = e => { if (e.key === "Enter") finish(); };

    titleEl.replaceWith(inputEl);
    inputEl.focus();
    // Move cursor to end instead of selecting all
    inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
  };
}

setupTitleEdit();

// ===========================
// Undo helper
// ===========================
function pushUndo() {
  undoStack.push(JSON.parse(JSON.stringify(items)));
}

// ===========================
// Entry position toggle
// ===========================
function moveInputField() {
  const footer = document.querySelector("footer");
  const main = document.querySelector("main");
  const app = document.querySelector(".app");
  inputAtTop ? app.insertBefore(footer, main) : app.appendChild(footer);
}

moveInputField();
toggleInputPosBtn.textContent = inputAtTop ? "Top" : "Bottom";
toggleInputPosBtn.title = inputAtTop ? "Move entry field to bottom" : "Move entry field to top";

toggleInputPosBtn.onclick = () => {
  inputAtTop = !inputAtTop;
  toggleInputPosBtn.textContent = inputAtTop ? "Top" : "Bottom";
  toggleInputPosBtn.title = inputAtTop ? "Move entry field to bottom" : "Move entry field to top";
  moveInputField();
};

// ===========================
// Add Item / Import
// ===========================
function addItem(textValue = null) {
  let value = textValue || input.value.trim();
  if (!value) return;

  if (value.includes("::ITEM::") || value.includes("::TITLE::")) {
    pushUndo();
    importList(value);
  } else {
    const newItem = {
      id: crypto.randomUUID(),
      text: value,
      priority: 3,
      done: false
    };
    inputAtTop ? items.unshift(newItem) : items.push(newItem);
    renderFLIP();
  }
  input.value = "";
}

function importList(serialized, clearFirst = false) {
  if (clearFirst) {
    items = [];
  }
  
  const chunks = serialized.split("::ITEM::").map(c => c.trim()).filter(Boolean);
  chunks.forEach(chunk => {
    if (chunk.startsWith("::TITLE::")) {
      listTitle = chunk.replace("::TITLE::", "").trim();
      titleEl.textContent = listTitle;
      return;
    }
    const [text, pri, done] = chunk.split("||").map(s => s.trim());
    if (text) {
      const item = {
        id: crypto.randomUUID(),
        text,
        priority: parseInt(pri || 3),
        done: done === "true"
      };
      inputAtTop ? items.unshift(item) : items.push(item);
    }
  });
  renderFLIP();
}

input.addEventListener("keydown", e => e.key === "Enter" && addItem());
addBtn.onclick = () => addItem();

// ===========================
// Controls
// ===========================
togglePriorityBtn.onclick = () => {
  showPriority = !showPriority;
  document.body.classList.toggle("show-global-priority", showPriority);
  render();
};

sortPriorityBtn.onclick = () => {
  items.sort((a, b) => {
    // Undone items always come first
    if (a.done !== b.done) return a.done ? 1 : -1;

    // Within each group, sort by priority (high → low)
    return b.priority - a.priority;
  });
  renderFLIP();
};

deleteDoneBtn.onclick = () => { if (items.some(i => i.done)) { pushUndo(); items = items.filter(i => !i.done); renderFLIP(); }};
clearChecklistBtn.onclick = () => { if (items.length) { pushUndo(); items = []; renderFLIP(); }};
undoBtn.onclick = () => undoStack.length && (items = undoStack.pop(), renderFLIP());
copyListBtn.onclick = () => navigator.clipboard.writeText(serializeList());
saveFileBtn.onclick = () => saveListFile();

// ===========================
// Serialize / Save
// ===========================
function serializeList() {
  let out = `::TITLE:: ${listTitle}\n`;
  items.forEach(i => out += `::ITEM::\n${i.text} || ${i.priority} || ${i.done}\n`);
  return out;
}

function saveListFile() {
  const blob = new Blob([serializeList()], { type: "text/plain" });
  const name = `${listTitle.replace(/\W+/g,"_")}_${new Date().toISOString().slice(0,19)}.txt`;
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: name
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

// ===========================
// FLIP animation
// ===========================
function getPositions() {
  const map = new Map();
  [...list.children].forEach(el => map.set(el.dataset.id, el.getBoundingClientRect()));
  return map;
}

function animateFLIP(old) {
  [...list.children].forEach(el => {
    const prev = old.get(el.dataset.id);
    if (!prev) return;
    const now = el.getBoundingClientRect();
    const dx = prev.left - now.left;
    const dy = prev.top - now.top;
    (dx || dy) && el.animate(
      [{ transform: `translate(${dx}px,${dy}px)` }, { transform: "translate(0,0)" }],
      { duration: 250, easing: "ease-out" }
    );
  });
}

function renderFLIP() {
  const old = getPositions();
  render();
  requestAnimationFrame(() => animateFLIP(old));
}

// ===========================
// Render
// ===========================
function render() {
  // Preserve scroll position to prevent jumping
  const scrollTop = list.scrollTop;
  
  list.innerHTML = "";

  // helper to clear drop indicator classes
  function clearDropIndicators() {
    document.querySelectorAll(".item.drop-before, .item.drop-after").forEach(el => {
      el.classList.remove("drop-before", "drop-after");
    });
    dropTargetId = null;
    dropPosition = null;
  }

  items.forEach(item => {
    const li = document.createElement("li");
    li.className = "item" + (item.done ? " done" : "");
    li.dataset.id = item.id;
    li.dataset.priority = item.priority;
    li.draggable = true;

    li.ondragstart = (e) => {
      // Don't start drag if text is being edited (contentEditable = true)
      // This allows text selection to work naturally
      const textEl = li.querySelector('.text');
      if (textEl && textEl.contentEditable === 'true') {
        e.preventDefault();
        return;
      }
      draggedId = item.id;
    };
    li.ondragend = () => {
      draggedId = null;
      clearDropIndicators();
    };
    li.ondragover = e => e.preventDefault();
    li.ondragover = e => {
      e.preventDefault();
      if (!draggedId || draggedId === item.id) return;

      const rect = li.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;

      // update indicator classes
      if (dropTargetId !== item.id || dropPosition !== (before ? "before" : "after")) {
        clearDropIndicators();
        dropTargetId = item.id;
        dropPosition = before ? "before" : "after";
        li.classList.add(before ? "drop-before" : "drop-after");
      }
    };

    li.ondragleave = (e) => {
      // If leaving the element, we can clear indicator if we're not moving into a child.
      if (!li.contains(e.relatedTarget)) {
        li.classList.remove("drop-before", "drop-after");
        if (dropTargetId === item.id) {
          dropTargetId = null;
          dropPosition = null;
        }
      }
    };

    li.ondrop = e => {
      e.preventDefault();
      if (!draggedId || draggedId === item.id) return;

      const from = items.findIndex(i => i.id === draggedId);
      const targetIndex = items.findIndex(i => i.id === item.id);
      if (from < 0 || targetIndex < 0) return;

      const rect = li.getBoundingClientRect();
      const before = (dropPosition ? dropPosition === "before" : e.clientY < rect.top + rect.height / 2);

      // compute insertion index
      let insertAt = before ? targetIndex : targetIndex + 1;
      const [m] = items.splice(from, 1);
      // adjust insertion if removing from before insertion
      if (from < insertAt) insertAt -= 1;
      items.splice(insertAt, 0, m);

      clearDropIndicators();
      renderFLIP();
    };

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = item.done;
    cb.onchange = () => { item.done = cb.checked; renderFLIP(); };

    const text = document.createElement("div");
    text.className = "text";
    text.textContent = item.text;
    text.onclick = e => {
      e.stopPropagation();
      // Only start editing if not already editing
      if (text.contentEditable !== 'true') {
        startRename(text, item);
      }
    };

    // Mobile layout: checkbox, bubbles, toggle on one line; text below
    const isMobile = window.innerWidth <= 767;
    
    if (isMobile) {
      const itemRow1 = document.createElement("div");
      itemRow1.className = "item-row-1";
      
      const leftControls = document.createElement("div");
      leftControls.className = "item-left-controls";
      leftControls.appendChild(cb);
      
      const rightControls = document.createElement("div");
      rightControls.className = "item-right-controls";
      
      const bubbles = document.createElement("div");
      bubbles.className = "priority-bubbles";
      if (showPriority) bubbles.classList.add("show");
      
      PRIORITIES.forEach(p => {
        const b = document.createElement("div");
        b.className = "priority" + (item.priority === p.level ? " selected" : "");
        b.dataset.level = p.level;
        b.textContent = p.label;
        b.onclick = () => { item.priority = p.level; renderFLIP(); };
        bubbles.appendChild(b);
      });
      
      const toggle = document.createElement("div");
      toggle.className = "priority-toggle";
      
      const del = document.createElement("div");
      del.className = "delete-item";
      del.textContent = "🗑";
      del.onclick = e => {
        e.stopPropagation();
        pushUndo();
        items = items.filter(i => i.id !== item.id);
        renderFLIP();
      };
      
      function syncControls() {
        const editing = showPriority || bubbles.classList.contains("show");
        toggle.style.display = editing ? "none" : "flex";
        bubbles.style.display = editing ? "flex" : "none";
        del.style.display = editing ? "flex" : "none";
      }
      
      toggle.onclick = e => {
        e.stopPropagation();
        bubbles.classList.toggle("show");
        syncControls();
      };
      
      syncControls();
      rightControls.append(bubbles, toggle, del);
      itemRow1.append(leftControls, rightControls);
      
      const itemRow2 = document.createElement("div");
      itemRow2.className = "item-row-2";
      itemRow2.appendChild(text);
      
      li.append(itemRow1, itemRow2);
    } else {
      // Desktop layout: original layout
      const right = document.createElement("div");
      right.className = "right-controls";

      const toggle = document.createElement("div");
      toggle.className = "priority-toggle";

      const bubbles = document.createElement("div");
      bubbles.className = "priority-bubbles";
      if (showPriority) bubbles.classList.add("show");

      PRIORITIES.forEach(p => {
        const b = document.createElement("div");
        b.className = "priority" + (item.priority === p.level ? " selected" : "");
        b.dataset.level = p.level;
        b.textContent = p.label;
        b.onclick = () => { item.priority = p.level; renderFLIP(); };
        bubbles.appendChild(b);
      });

      const del = document.createElement("div");
      del.className = "delete-item";
      del.textContent = "🗑";
      del.onclick = e => {
        e.stopPropagation();
        pushUndo();
        items = items.filter(i => i.id !== item.id);
        renderFLIP();
      };

      function syncControls() {
        const editing = showPriority || bubbles.classList.contains("show");
        toggle.style.display = editing ? "none" : "flex";
        bubbles.style.display = editing ? "flex" : "none";
        del.style.display = editing ? "flex" : "none";
      }

      toggle.onclick = e => {
        e.stopPropagation();
        bubbles.classList.toggle("show");
        syncControls();
      };

      syncControls();
      right.append(toggle, bubbles, del);
      li.append(cb, text, right);
    }
    
    list.appendChild(li);
  });
  
  // Restore scroll position to prevent jumping
  list.scrollTop = scrollTop;
}

// ===========================
// Rename item
// ===========================

function startRename(textEl, item) {
  // Don't re-initialize if already editing
  if (textEl.contentEditable === 'true') {
    return;
  }
  
  // Use contentEditable like sidebar for consistent editing experience
  textEl.contentEditable = true;
  textEl.classList.add('editing');
  
  // Disable dragging on parent list item while editing
  const li = textEl.closest('.item');
  if (li) {
    li.draggable = false;
  }
  
  // Move cursor to end (only on first edit, not on subsequent clicks)
  // Use requestAnimationFrame to ensure DOM is ready
  requestAnimationFrame(() => {
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(textEl);
    range.collapse(false); // Collapse to end
    selection.removeAllRanges();
    selection.addRange(range);
    textEl.focus();
  });

  let finished = false;

  function finish() {
    if (finished) return;
    finished = true;

    const value = textEl.textContent.trim();
    if (value) {
      item.text = value;
    } else {
      // Restore original if empty
      textEl.textContent = item.text;
    }

    textEl.contentEditable = false;
    textEl.classList.remove('editing');
    
    // Re-enable dragging on parent list item
    if (li) {
      li.draggable = true;
    }
    
    render();
  }

  textEl.addEventListener("blur", finish);
  textEl.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      finish();
    }
    if (e.key === "Escape") {
      textEl.textContent = item.text;
      finish();
    }
  });

  textEl.addEventListener("click", e => e.stopPropagation());
  
  // Don't interfere with mousedown - let browser handle text selection naturally
  // The parent li's draggable=false and dragstart handler will prevent item drag
}

// ===========================
// Close individual priority menus on background click
// ===========================
document.addEventListener("click", (e) => {
  // Only close if global priority toggle is NOT active
  if (showPriority) return;

  // For each priority-bubbles div that is currently open
  document.querySelectorAll(".priority-bubbles.show").forEach(bubble => {
    // Close it if the click is outside this bubble
    if (!bubble.contains(e.target)) {
      bubble.classList.remove("show");
    }
  });

  setTimeout(() => {
    render();
  }, 0);
});

// ===========================
// Drag file load
// ===========================
document.body.ondragover = e => e.preventDefault();
document.body.ondrop = e => {
  e.preventDefault();
  if (!e.dataTransfer.files.length) return;
  const reader = new FileReader();
  reader.onload = ev => { pushUndo(); importList(ev.target.result); };
  reader.readAsText(e.dataTransfer.files[0]);
};

// ===========================
// Supabase & Storage Management
// ===========================

let supabaseClient = null;
let currentUser = null;
let deleteConfirmTimeouts = new Map();

// Initialize Supabase
function initSupabase() {
  if (typeof supabase === 'undefined') {
    console.warn('Supabase library not loaded. Make sure the script is included in index.html');
    return;
  }
  
  if (SUPABASE_CONFIG.url && SUPABASE_CONFIG.url !== 'YOUR_SUPABASE_URL' && 
      SUPABASE_CONFIG.anonKey && SUPABASE_CONFIG.anonKey !== 'YOUR_SUPABASE_ANON_KEY') {
    supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    
    // Listen for auth state changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        currentUser = session.user;
        updateAuthUI();
        syncFromCloud();
        syncTemplatesFromCloud();
        syncSettingsFromCloud();
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        updateAuthUI();
      }
    });

    // Check existing session
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        currentUser = session.user;
        updateAuthUI();
        syncFromCloud();
        syncTemplatesFromCloud();
        syncSettingsFromCloud();
      }
    });
  }
}

// ===========================
// Storage Management
// ===========================

function getStorageData() {
  const data = localStorage.getItem('checklistApp');
  const parsed = data ? JSON.parse(data) : { checklists: {}, mostRecent: null, currentChecklist: null };
  
  // Ensure currentChecklist exists for backward compatibility
  if (!parsed.hasOwnProperty('currentChecklist')) {
    parsed.currentChecklist = parsed.mostRecent;
  }
  
  return parsed;
}

function saveStorageData(data) {
  localStorage.setItem('checklistApp', JSON.stringify(data));
}

// Migrate old format to new structured format
function migrateOldFormat() {
  const data = getStorageData();
  let migrated = false;
  
  Object.keys(data.checklists).forEach(name => {
    const checklist = data.checklists[name];
    
    // If it's old format (has content but no items)
    if (checklist.content && !checklist.items) {
      // Parse the content to extract items
      const chunks = checklist.content.split("::ITEM::").map(c => c.trim()).filter(Boolean);
      const items = [];
      let title = name;
      
      chunks.forEach(chunk => {
        if (chunk.startsWith("::TITLE::")) {
          title = chunk.replace("::TITLE::", "").trim();
          return;
        }
        const [text, pri, done] = chunk.split("||").map(s => s.trim());
        if (text) {
          items.push({
            id: crypto.randomUUID(),
            text: text,
            priority: parseInt(pri || 3),
            done: done === "true"
          });
        }
      });
      
      // Convert to new format
      data.checklists[name] = {
        title: title,
        items: items,
        lastModified: checklist.lastModified || new Date().toISOString(),
        synced: checklist.synced || false
      };
      migrated = true;
    } else if (!checklist.items) {
      // Empty checklist - ensure it has items array
      data.checklists[name] = {
        title: checklist.title || name,
        items: [],
        lastModified: checklist.lastModified || new Date().toISOString(),
        synced: checklist.synced || false
      };
      migrated = true;
    }
  });
  
  if (migrated) {
    saveStorageData(data);
  }
  
  return migrated;
}

function saveChecklist(name, titleOverride = null) {
  const data = getStorageData();
  const title = titleOverride || listTitle || name;
  
  data.checklists[name] = {
    title: title,
    items: JSON.parse(JSON.stringify(items)), // Deep copy
    lastModified: new Date().toISOString(),
    synced: false
  };
  data.mostRecent = name;
  data.currentChecklist = name;

  if (!data.checklistOrder) data.checklistOrder = [];
  data.checklistOrder = data.checklistOrder.filter(n => n !== name);
  data.checklistOrder.unshift(name); // new at top / most recent at top
  saveStorageData(data);
  
  // Auto-sync to cloud if authenticated (convert to text format for cloud)
  if (currentUser && supabaseClient) {
    const content = serializeList();
    syncChecklistToCloud(name, content);
  }
}

function loadChecklist(name) {
  const data = getStorageData();
  if (data.checklists[name]) {
    pushUndo();
    
    // Clear items array first
    items = [];
    
    // Load from structured data if available, otherwise parse text format
    const checklist = data.checklists[name];
    if (checklist.items && Array.isArray(checklist.items)) {
      // New structured format
      listTitle = checklist.title || name;
      items = checklist.items.map(item => ({
        id: item.id || crypto.randomUUID(),
        text: item.text,
        priority: item.priority || 3,
        done: item.done || false
      }));
    } else if (checklist.content) {
      // Old text format - parse it (clearFirst = true to ensure clean load)
      importList(checklist.content, true);
    } else {
      // Empty checklist
      listTitle = name;
      items = [];
    }
    
    titleEl.textContent = listTitle;
    renderFLIP();
    
    // Update most recent and current
    data.mostRecent = name;
    data.currentChecklist = name;
    saveStorageData(data);
    
    // Update current checklist name display
    updateCurrentChecklistName();
    return true;
  }
  return false;
}

function getAllChecklists() {
  const data = getStorageData();
  if (!data.checklistOrder) data.checklistOrder = [];

  // keep order list in sync with existing keys
  const existing = new Set(Object.keys(data.checklists));
  data.checklistOrder = data.checklistOrder.filter(n => existing.has(n));
  Object.keys(data.checklists).forEach(n => {
    if (!data.checklistOrder.includes(n)) data.checklistOrder.unshift(n); // new at top
  });
  saveStorageData(data);
  return [...data.checklistOrder];
}

function getUniqueChecklistName(baseName) {
  const data = getStorageData();
  let name = baseName;
  let counter = 1;
  
  // Check if base name exists
  while (data.checklists[name]) {
    name = `${baseName} (${counter})`;
    counter++;
  }
  
  return name;
}

function deleteChecklist(name) {
  const data = getStorageData();
  if (data.checklists[name]) {
    delete data.checklists[name];
    if (data.mostRecent === name) {
      const remaining = Object.keys(data.checklists);
      data.mostRecent = remaining.length > 0 ? remaining[0] : null;
    }
    if (data.currentChecklist === name) {
      data.currentChecklist = null;
    }
    saveStorageData(data);
    
    // Delete from cloud if authenticated
    if (currentUser && supabaseClient) {
      deleteChecklistFromCloud(name);
    }
    
    renderChecklistList();
    return true;
  }
  return false;
}

function renameChecklist(oldName, newName) {
  if (!newName || newName.trim() === '' || oldName === newName) return false;
  newName = newName.trim();
  
  const data = getStorageData();
  if (!data.checklists[oldName] || data.checklists[newName]) return false;
  
  const checklist = data.checklists[oldName];
  data.checklists[newName] = {
    title: newName,
    items: checklist.items || [],
    lastModified: new Date().toISOString(),
    synced: checklist.synced || false
  };
  delete data.checklists[oldName];
  
  if (data.mostRecent === oldName) {
    data.mostRecent = newName;
  }
  
  if (data.currentChecklist === oldName) {
    data.currentChecklist = newName;
  }
  
  saveStorageData(data);
  
  // Update in cloud if authenticated
  if (currentUser && supabaseClient) {
    renameChecklistInCloud(oldName, newName);
  }
  
  renderChecklistList();
  updateCurrentChecklistName();
  return true;
}

function getMostRecentChecklist() {
  const data = getStorageData();
  return data.mostRecent;
}

// ===========================
// Cloud Sync Functions
// ===========================

async function syncChecklistToCloud(name, content) {
  if (!currentUser || !supabaseClient) return;
  
  // If content is not provided, get it from structured storage
  if (!content) {
    const data = getStorageData();
    const checklist = data.checklists[name];
    if (checklist) {
      // Temporarily set items and listTitle to serialize
      const savedItems = items;
      const savedTitle = listTitle;
      items = checklist.items || [];
      listTitle = checklist.title || name;
      content = serializeList();
      items = savedItems;
      listTitle = savedTitle;
    } else {
      return;
    }
  }
  
  try {
    const { error } = await supabaseClient
      .from('checklists')
      .upsert({
        user_id: currentUser.id,
        name: name,
        content: content,
        last_modified: new Date().toISOString()
      }, {
        onConflict: 'user_id,name'
      });
    
    if (!error) {
      const data = getStorageData();
      if (data.checklists[name]) {
        data.checklists[name].synced = true;
        saveStorageData(data);
      }
    }
  } catch (err) {
    console.error('Error syncing checklist to cloud:', err);
  }
}

async function syncFromCloud() {
  if (!currentUser || !supabaseClient) return;
  
  try {
    const { data: cloudChecklists, error } = await supabaseClient
      .from('checklists')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('last_modified', { ascending: false });
    
    if (error) {
      console.error('Error fetching from cloud:', error);
      return;
    }
    
    const localData = getStorageData();
    let hasChanges = false;
    
    // Merge cloud data with local
    cloudChecklists.forEach(cloudChecklist => {
      const localChecklist = localData.checklists[cloudChecklist.name];
      
      // Parse cloud content (text format) to structured format
      let cloudItems = [];
      let cloudTitle = cloudChecklist.name;
      
      if (cloudChecklist.content) {
        const chunks = cloudChecklist.content.split("::ITEM::").map(c => c.trim()).filter(Boolean);
        chunks.forEach(chunk => {
          if (chunk.startsWith("::TITLE::")) {
            cloudTitle = chunk.replace("::TITLE::", "").trim();
            return;
          }
          const [text, pri, done] = chunk.split("||").map(s => s.trim());
          if (text) {
            cloudItems.push({
              id: crypto.randomUUID(),
              text: text,
              priority: parseInt(pri || 3),
              done: done === "true"
            });
          }
        });
      }
      
      if (!localChecklist) {
        // New checklist from cloud
        localData.checklists[cloudChecklist.name] = {
          title: cloudTitle,
          items: cloudItems,
          lastModified: cloudChecklist.last_modified,
          synced: true
        };
        hasChanges = true;
      } else {
        // Use the most recent version
        const localTime = new Date(localChecklist.lastModified);
        const cloudTime = new Date(cloudChecklist.last_modified);
        
        if (cloudTime > localTime) {
          localData.checklists[cloudChecklist.name] = {
            title: cloudTitle,
            items: cloudItems,
            lastModified: cloudChecklist.last_modified,
            synced: true
          };
          hasChanges = true;
        } else if (localTime > cloudTime && !localChecklist.synced) {
          // Local is newer, sync it up
          syncChecklistToCloud(cloudChecklist.name);
        }
      }
    });
    
    if (hasChanges) {
      saveStorageData(localData);
      renderChecklistList();
      
      // If current checklist was updated, reload it
      if (localData.currentChecklist && cloudChecklists.some(c => c.name === localData.currentChecklist)) {
        const updated = cloudChecklists.find(c => c.name === localData.currentChecklist);
        if (updated) {
          const localTime = new Date(localData.checklists[updated.name].lastModified);
          const cloudTime = new Date(updated.last_modified);
          if (cloudTime > localTime) {
            loadChecklist(updated.name);
          }
        }
      }
    }
    
    // Sync all local checklists that aren't synced
    Object.keys(localData.checklists).forEach(name => {
      if (!localData.checklists[name].synced) {
        syncChecklistToCloud(name);
      }
    });
  } catch (err) {
    console.error('Error syncing from cloud:', err);
  }
}

async function deleteChecklistFromCloud(name) {
  if (!currentUser || !supabaseClient) return;
  try {
    await supabaseClient
      .from('checklists')
      .delete()
      .eq('user_id', currentUser.id)
      .eq('name', name);
  } catch (err) {
    console.error('Error deleting checklist from cloud:', err);
  }
}

async function renameChecklistInCloud(oldName, newName) {
  if (!currentUser || !supabaseClient) return;
  
  try {
    // Delete old, insert new
    await deleteChecklistFromCloud(oldName);
    await syncChecklistToCloud(newName);
  } catch (err) {
    console.error('Error renaming checklist in cloud:', err);
  }
}

// ===========================
// Authentication Functions
// ===========================

async function signInWithGoogle() {
  if (!supabaseClient) {
    alert('Supabase not initialized. Please check your config.js file.');
    return;
  }
  
  try {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
  } catch (err) {
    console.error('Error signing in:', err);
    alert('Failed to sign in: ' + err.message);
  }
}

async function signOut() {
  if (!supabaseClient) return;
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    currentUser = null;
    updateAuthUI();
  } catch (err) {
    console.error('Error signing out:', err);
  }
}

function updateAuthUI() {
  const signInBtn = document.getElementById('signInBtn');
  const signOutBtn = document.getElementById('signOutBtn');
  const userInfo = document.getElementById('userInfo');
  const userEmail = document.querySelector('.user-email');
  
  if (currentUser) {
    if (signInBtn) signInBtn.style.display = 'none';
    if (userInfo) userInfo.style.display = 'block';
    if (userEmail) userEmail.textContent = currentUser.email || 'Signed in';
  } else {
    if (signInBtn) signInBtn.style.display = 'block';
    if (userInfo) userInfo.style.display = 'none';
  }
}

// ===========================
// Menu Management
// ===========================

const menuToggle = document.getElementById('menuToggle');
const menuOverlay = document.getElementById('menuOverlay');
const sideMenu = document.getElementById('sideMenu');
const signInBtn = document.getElementById('signInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const newChecklistBtn = document.getElementById('newChecklistBtn');
const checklistsList = document.getElementById('checklistsList');
const toggleDarkSidebarBtn = document.getElementById('toggleDarkSidebar');
const colorToggleBtn = document.getElementById('colorToggle');
const colorCustomizerEl = document.getElementById('colorCustomizer');
const toggleTemplateMenuBtn = document.getElementById('toggleTemplateMenu');
const templateMenuEl = document.getElementById('templateMenu');
const templatesListEl = document.getElementById('templatesList');
const newTemplateBtn = document.getElementById('newTemplateBtn');
const saveTemplateBtn = document.getElementById('saveTemplateBtn');
const abcSortBtn = document.getElementById('abcSortBtn');

function openMenu() {
  sideMenu.classList.add('open');
  menuOverlay.classList.add('active');
  document.body.classList.add('menu-open');
  document.body.style.overflow = 'hidden';
  renderChecklistList();
  updateCurrentChecklistName();
}

function closeMenu() {
  sideMenu.classList.remove('open');
  sideMenu.classList.remove('template-open');
  // Close color customizer by removing color-open from its parent menu-section
  const appearanceSection = colorCustomizerEl?.closest('.menu-section');
  if (appearanceSection) appearanceSection.classList.remove('color-open');
  if (colorCustomizerEl) colorCustomizerEl.setAttribute('aria-hidden', 'true');
  if (templateMenuEl) templateMenuEl.setAttribute('aria-hidden', 'true');
  menuOverlay.classList.remove('active');
  document.body.classList.remove('menu-open');
  document.body.style.overflow = '';
}

function toggleMenu() {
  if (sideMenu.classList.contains('open')) {
    closeMenu();
  } else {
    openMenu();
  }
}

if (menuToggle) {
  menuToggle.onclick = () => toggleMenu();
}

if (menuToggleMobile) {
  menuToggleMobile.onclick = () => toggleMenu();
}

if (menuOverlay) {
  menuOverlay.onclick = () => closeMenu();
}

// Color customizer toggle
if (colorToggleBtn) {
  colorToggleBtn.onclick = (e) => {
    e.stopPropagation();
    const appearanceSection = colorCustomizerEl?.closest('.menu-section');
    if (appearanceSection) {
      const open = appearanceSection.classList.toggle('color-open');
      if (colorCustomizerEl) colorCustomizerEl.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
  };
}

// Templates menu toggle
if (toggleTemplateMenuBtn) {
  toggleTemplateMenuBtn.onclick = (e) => {
    e.stopPropagation();
    const open = sideMenu.classList.toggle('template-open');
    if (templateMenuEl) templateMenuEl.setAttribute('aria-hidden', open ? 'false' : 'true');
  };
}

function getTemplatesData() {
  const data = getStorageData();
  if (!data.templates) data.templates = {};
  if (!data.templateOrder) data.templateOrder = [];
  return data;
}

function ensureDefaultTemplates() {
  const data = getTemplatesData();
  if (data.templateOrder.length) return;

  const defaults = [
    {
      name: "Everyday tasks",
      items: [
        { id: crypto.randomUUID(), text: "Eat breakfast", priority: 3, done: false },
        { id: crypto.randomUUID(), text: "Make coffee", priority: 3, done: false },
        { id: crypto.randomUUID(), text: "Take vitamins", priority: 3, done: false },
        { id: crypto.randomUUID(), text: "Drink water", priority: 2, done: false },
        { id: crypto.randomUUID(), text: "Quick tidy", priority: 2, done: false }
      ]
    },
    {
      name: "Bike repair checklist",
      items: [
        { id: crypto.randomUUID(), text: "Inspect tires (pressure + wear)", priority: 4, done: false },
        { id: crypto.randomUUID(), text: "Check brakes (pads + cables)", priority: 5, done: false },
        { id: crypto.randomUUID(), text: "Lube chain", priority: 4, done: false },
        { id: crypto.randomUUID(), text: "Check gears shift smoothly", priority: 3, done: false },
        { id: crypto.randomUUID(), text: "Test ride", priority: 5, done: false }
      ]
    },
    {
      name: "Leaving for travel",
      items: [
        { id: crypto.randomUUID(), text: "Pack suitcase", priority: 5, done: false },
        { id: crypto.randomUUID(), text: "Check passport/ID", priority: 5, done: false },
        { id: crypto.randomUUID(), text: "Confirm flight/hotel", priority: 4, done: false },
        { id: crypto.randomUUID(), text: "Arrange pet care", priority: 4, done: false },
        { id: crypto.randomUUID(), text: "Lock doors/windows", priority: 5, done: false },
        { id: crypto.randomUUID(), text: "Set out-of-office email", priority: 3, done: false }
      ]
    }
  ];

  defaults.forEach(template => {
    const id = crypto.randomUUID();
    data.templates[id] = {
      id: id,
      name: template.name,
      items: template.items,
      lastModified: new Date().toISOString(),
      synced: false
    };
    data.templateOrder.push(id);
  });

  saveStorageData(data);
}

function saveTemplate(templateId, name, templateItems) {
  const data = getTemplatesData();
  data.templates[templateId] = {
    id: templateId,
    name: name,
    items: JSON.parse(JSON.stringify(templateItems)),
    lastModified: new Date().toISOString(),
    synced: false
  };
  if (!data.templateOrder.includes(templateId)) {
    data.templateOrder.unshift(templateId);
  }
  saveStorageData(data);
  
  if (currentUser && supabaseClient) {
    syncTemplateToCloud(templateId);
  }
}

function loadTemplate(templateId) {
  const data = getTemplatesData();
  const template = data.templates[templateId];
  if (!template) return false;
  
  pushUndo();
  items = JSON.parse(JSON.stringify(template.items || []));
  // Generate unique name for checklist from template
  listTitle = getUniqueChecklistName(template.name);
  titleEl.textContent = listTitle;
  editingTemplateId = null;
  if (saveTemplateBtn) saveTemplateBtn.style.display = 'none';
  renderFLIP();
  
  // Save as new checklist
  const checklistName = listTitle;
  saveChecklist(checklistName);
  return true;
}

function deleteTemplate(templateId) {
  const data = getTemplatesData();
  if (!data.templates[templateId]) return false;
  const name = data.templates[templateId].name;
  delete data.templates[templateId];
  data.templateOrder = data.templateOrder.filter(id => id !== templateId);
  saveStorageData(data);
  renderTemplatesList();
  if (currentUser && supabaseClient && name) deleteTemplateFromCloudByName(name);
  return true;
}

function renameTemplate(templateId, newName) {
  if (!newName || newName.trim() === '') return false;
  newName = newName.trim();
  
  const data = getTemplatesData();
  const tpl = data.templates[templateId];
  if (!tpl || tpl.name === newName) return false;
  
  const oldName = tpl.name;
  tpl.name = newName;
  tpl.lastModified = new Date().toISOString();
  tpl.synced = false;
  saveStorageData(data);
  renderTemplatesList();
  if (currentUser && supabaseClient) renameTemplateInCloud(oldName, tpl.name);
  return true;
}

function renderTemplatesList() {
  if (!templatesListEl) return;
  templatesListEl.innerHTML = '';
  const data = getTemplatesData();
  const templates = data.templateOrder.map(id => ({ id, ...data.templates[id] })).filter(t => t.name);
  
  let draggedTemplateId = null;
  const clearTemplateDropIndicators = () => {
    templatesListEl.querySelectorAll('.template-item.drop-before, .template-item.drop-after').forEach(el => {
      el.classList.remove('drop-before', 'drop-after');
    });
  };
  
  templates.forEach(({ id, name, items: templateItems }) => {
    const item = document.createElement('div');
    item.className = 'template-item';
    item.draggable = true;
    item.dataset.id = id;
    
    item.ondragstart = () => { draggedTemplateId = id; };
    item.ondragend = () => { draggedTemplateId = null; clearTemplateDropIndicators(); };
    item.ondragover = (e) => {
      e.preventDefault();
      if (!draggedTemplateId || draggedTemplateId === id) return;
      const rect = item.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      clearTemplateDropIndicators();
      item.classList.add(before ? 'drop-before' : 'drop-after');
      item.dataset.dropPos = before ? 'before' : 'after';
    };
    item.ondrop = (e) => {
      e.preventDefault();
      if (!draggedTemplateId || draggedTemplateId === id) return;
      const data = getTemplatesData();
      const from = data.templateOrder.indexOf(draggedTemplateId);
      const to = data.templateOrder.indexOf(id);
      if (from < 0 || to < 0) return;
      const before = item.dataset.dropPos === 'before';
      let insertAt = before ? to : to + 1;
      const [m] = data.templateOrder.splice(from, 1);
      if (from < insertAt) insertAt -= 1;
      data.templateOrder.splice(insertAt, 0, m);
      saveStorageData(data);
      clearTemplateDropIndicators();
      renderTemplatesList();
    };
    
    const nameEl = document.createElement('div');
    nameEl.className = 'template-item-name';
    nameEl.textContent = name;
    nameEl.contentEditable = false;
    
    nameEl.onclick = (e) => {
      e.stopPropagation();
      if (nameEl.contentEditable === 'true') return;
      nameEl.contentEditable = 'true';
      // Disable dragging on parent while editing
      item.draggable = false;
      nameEl.focus();
      
      const finish = () => {
        nameEl.contentEditable = 'false';
        // Re-enable dragging on parent
        item.draggable = true;
        const newName = nameEl.textContent.trim();
        if (newName && newName !== name) {
          renameTemplate(id, newName);
        } else {
          nameEl.textContent = name;
        }
      };
      
      nameEl.onblur = finish;
      nameEl.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finish();
        }
        if (e.key === 'Escape') {
          nameEl.textContent = name;
          finish();
        }
      };
      
      // Prevent drag events from bubbling up to parent
      nameEl.addEventListener("dragstart", e => {
        e.stopPropagation();
        e.preventDefault();
      });
      nameEl.addEventListener("mousedown", e => {
        if (nameEl.contentEditable === 'true') {
          e.stopPropagation();
        }
      });
    };
    
    const actions = document.createElement('div');
    actions.className = 'template-item-actions';
    
    const newBtn = document.createElement('button');
    newBtn.className = 'template-action-btn new';
    newBtn.textContent = '+';
    newBtn.title = 'Create checklist from template';
    newBtn.onclick = (e) => {
      e.stopPropagation();
      loadTemplate(id);
      closeMenu();
    };
    
    const editBtn = document.createElement('button');
    editBtn.className = 'template-action-btn edit';
    editBtn.textContent = '✎';
    editBtn.title = 'Edit template';
    editBtn.onclick = (e) => { e.stopPropagation(); openTemplateForEdit(id); closeMenu(); };
    
    const delBtn = document.createElement('button');
    delBtn.className = 'template-action-btn delete';
    delBtn.textContent = '×';
    delBtn.title = 'Delete template';
    
    const templateDeleteTimeouts = new Map();
    delBtn.onclick = (e) => {
      e.stopPropagation();
      if (delBtn.classList.contains('confirming')) {
        deleteTemplate(id);
        if (templateDeleteTimeouts.has(id)) {
          clearTimeout(templateDeleteTimeouts.get(id));
          templateDeleteTimeouts.delete(id);
        }
      } else {
        delBtn.classList.add('confirming');
        delBtn.textContent = '!';
        delBtn.title = 'Click again to confirm delete';
        const timeout = setTimeout(() => {
          delBtn.classList.remove('confirming');
          delBtn.textContent = '×';
          delBtn.title = 'Delete template';
          templateDeleteTimeouts.delete(id);
        }, 3000);
        templateDeleteTimeouts.set(id, timeout);
      }
    };
    
    actions.append(newBtn, editBtn, delBtn);
    item.append(nameEl, actions);
    
    // Click on item (not name) to create checklist
    item.onclick = (e) => {
      if (e.target === nameEl || nameEl.contains(e.target)) return;
      if (e.target.closest('.template-item-actions')) return;
      loadTemplate(id);
      closeMenu();
    };
    
    templatesListEl.appendChild(item);
  });
}

function openTemplateForEdit(templateId) {
  const data = getTemplatesData();
  const tpl = data.templates[templateId];
  if (!tpl) return;
  editingTemplateId = templateId;
  items = JSON.parse(JSON.stringify(tpl.items || []));
  listTitle = tpl.name;
  titleEl.textContent = listTitle;
  if (saveTemplateBtn) saveTemplateBtn.style.display = 'inline-block';
  renderFLIP();
}

// ===========================
// Templates Cloud Sync
// ===========================

function serializeTemplateContent(template) {
  let out = `::TITLE:: ${template.name}\n`;
  template.items.forEach(item => {
    out += `::ITEM::\n${item.text} || ${item.priority} || ${item.done}\n`;
  });
  return out;
}

function parseTemplateContent(content, fallbackName) {
  const chunks = (content || "").split("::ITEM::").map(c => c.trim()).filter(Boolean);
  const itemsOut = [];
  let name = fallbackName || "Template";
  chunks.forEach(chunk => {
    if (chunk.startsWith("::TITLE::")) {
      name = chunk.replace("::TITLE::", "").trim() || name;
      return;
    }
    const [text, pri, done] = chunk.split("||").map(s => s.trim());
    if (text) {
      itemsOut.push({
        id: crypto.randomUUID(),
        text: text,
        priority: parseInt(pri || 3),
        done: done === "true"
      });
    }
  });
  return { name, items: itemsOut };
}

async function syncTemplateToCloud(templateId) {
  if (!currentUser || !supabaseClient) return;
  const data = getTemplatesData();
  const tpl = data.templates[templateId];
  if (!tpl) return;
  const content = serializeTemplateContent(tpl);
  try {
    const { error } = await supabaseClient
      .from('templates')
      .upsert({
        user_id: currentUser.id,
        name: tpl.name,
        content,
        last_modified: new Date().toISOString()
      }, { onConflict: 'user_id,name' });

    if (!error) {
      const d = getTemplatesData();
      if (d.templates[templateId]) {
        d.templates[templateId].synced = true;
        saveStorageData(d);
      }
    }
  } catch (err) {
    console.error('Error syncing template to cloud:', err);
  }
}

async function syncTemplatesFromCloud() {
  if (!currentUser || !supabaseClient) return;
  try {
    const { data: cloudTemplates, error } = await supabaseClient
      .from('templates')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('last_modified', { ascending: false });

    if (error) {
      console.error('Error fetching templates from cloud:', error);
      return;
    }

    const local = getTemplatesData();
    let changed = false;

    cloudTemplates.forEach(ct => {
      const existingId = Object.keys(local.templates).find(id => local.templates[id].name === ct.name);
      const parsed = parseTemplateContent(ct.content, ct.name);

      if (!existingId) {
        const id = crypto.randomUUID();
        local.templates[id] = {
          id,
          name: parsed.name,
          items: parsed.items,
          lastModified: ct.last_modified,
          synced: true
        };
        local.templateOrder.unshift(id);
        changed = true;
      } else {
        const lt = local.templates[existingId];
        const localTime = new Date(lt.lastModified || 0);
        const cloudTime = new Date(ct.last_modified || 0);
        if (cloudTime > localTime) {
          lt.name = parsed.name;
          lt.items = parsed.items;
          lt.lastModified = ct.last_modified;
          lt.synced = true;
          changed = true;
        } else if (localTime > cloudTime && !lt.synced) {
          syncTemplateToCloud(existingId);
        }
      }
    });

    if (changed) {
      saveStorageData(local);
      renderTemplatesList();
    }
  } catch (err) {
    console.error('Error syncing templates from cloud:', err);
  }
}

async function deleteTemplateFromCloudByName(name) {
  if (!currentUser || !supabaseClient) return;
  try {
    await supabaseClient
      .from('templates')
      .delete()
      .eq('user_id', currentUser.id)
      .eq('name', name);
  } catch (err) {
    console.error('Error deleting template from cloud:', err);
  }
}

async function renameTemplateInCloud(oldName, newName) {
  if (!currentUser || !supabaseClient) return;
  try {
    await deleteTemplateFromCloudByName(oldName);
    // find template by newName and sync
    const data = getTemplatesData();
    const templateId = Object.keys(data.templates).find(id => data.templates[id].name === newName);
    if (templateId) {
      await syncTemplateToCloud(templateId);
    }
  } catch (err) {
    console.error('Error renaming template in cloud:', err);
  }
}

// ===========================
// Checklist List Rendering
// ===========================

function renderChecklistList() {
  if (!checklistsList) return;
  
  checklistsList.innerHTML = '';
  const checklists = getAllChecklists();
  
  let draggedChecklistName = null;
  const clearChecklistDropIndicators = () => {
    checklistsList.querySelectorAll('.checklist-item.drop-before, .checklist-item.drop-after').forEach(el => {
      el.classList.remove('drop-before', 'drop-after');
    });
  };

  checklists.forEach(name => {
    const item = document.createElement('div');
    item.className = 'checklist-item';
    item.draggable = true;
    item.dataset.name = name;

    item.ondragstart = () => { draggedChecklistName = name; };
    item.ondragend = () => { draggedChecklistName = null; clearChecklistDropIndicators(); };
    item.ondragover = (e) => {
      e.preventDefault();
      if (!draggedChecklistName || draggedChecklistName === name) return;
      const rect = item.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      clearChecklistDropIndicators();
      item.classList.add(before ? 'drop-before' : 'drop-after');
      item.dataset.dropPos = before ? 'before' : 'after';
    };
    item.ondrop = (e) => {
      e.preventDefault();
      if (!draggedChecklistName || draggedChecklistName === name) return;
      const data = getStorageData();
      if (!data.checklistOrder) data.checklistOrder = getAllChecklists();
      const from = data.checklistOrder.indexOf(draggedChecklistName);
      const to = data.checklistOrder.indexOf(name);
      if (from < 0 || to < 0) return;
      const before = item.dataset.dropPos === 'before';
      let insertAt = before ? to : to + 1;
      const [m] = data.checklistOrder.splice(from, 1);
      if (from < insertAt) insertAt -= 1;
      data.checklistOrder.splice(insertAt, 0, m);
      saveStorageData(data);
      clearChecklistDropIndicators();
      renderChecklistList();
    };
    
    const nameEl = document.createElement('div');
    nameEl.className = 'checklist-item-name';
    nameEl.textContent = name;
    nameEl.contentEditable = false;
    
    // Make name editable
    nameEl.onclick = (e) => {
      e.stopPropagation();
      if (nameEl.contentEditable === 'true') return;
      
      nameEl.contentEditable = 'true';
      // Disable dragging on parent while editing
      item.draggable = false;
      nameEl.focus();
      
      const finish = () => {
        nameEl.contentEditable = 'false';
        // Re-enable dragging on parent
        item.draggable = true;
        const newName = nameEl.textContent.trim();
        if (newName && newName !== name) {
          renameChecklist(name, newName);
          if (listTitle === name) {
            listTitle = newName;
            titleEl.textContent = listTitle;
          }
        } else {
          nameEl.textContent = name;
        }
      };
      
      nameEl.onblur = finish;
      nameEl.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finish();
        }
        if (e.key === 'Escape') {
          nameEl.textContent = name;
          finish();
        }
      };
      
      // Prevent drag events from bubbling up to parent
      nameEl.addEventListener("dragstart", e => {
        e.stopPropagation();
        e.preventDefault();
      });
      nameEl.addEventListener("mousedown", e => {
        if (nameEl.contentEditable === 'true') {
          e.stopPropagation();
        }
      });
    };
    
    const actions = document.createElement('div');
    actions.className = 'checklist-item-actions';
    
    // Load button
    const loadBtn = document.createElement('button');
    loadBtn.className = 'checklist-action-btn load';
    loadBtn.textContent = '→';
    loadBtn.title = 'Load checklist';
    loadBtn.onclick = (e) => {
      e.stopPropagation();
      if (loadChecklist(name)) {
        closeMenu();
      }
    };
    
    // Download button
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'checklist-action-btn download';
    downloadBtn.textContent = '↓';
    downloadBtn.title = 'Download checklist';
    downloadBtn.onclick = (e) => {
      e.stopPropagation();
      const data = getStorageData();
      if (data.checklists[name]) {
        const checklist = data.checklists[name];
        let content;
        
        // Convert structured format to text format for download
        if (checklist.items && Array.isArray(checklist.items)) {
          // New structured format - convert to text
          content = `::TITLE:: ${checklist.title || name}\n`;
          checklist.items.forEach(item => {
            content += `::ITEM::\n${item.text} || ${item.priority} || ${item.done}\n`;
          });
        } else if (checklist.content) {
          // Old format - use as is
          content = checklist.content;
        } else {
          // Empty checklist
          content = `::TITLE:: ${checklist.title || name}\n`;
        }
        
        const blob = new Blob([content], { type: "text/plain" });
        const fileName = `${name.replace(/\W+/g,"_")}_${new Date().toISOString().slice(0,19)}.txt`;
        const a = Object.assign(document.createElement("a"), {
          href: URL.createObjectURL(blob),
          download: fileName
        });
        a.click();
        URL.revokeObjectURL(a.href);
      }
    };
    
    // Delete button (two-click confirmation)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'checklist-action-btn delete';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Delete checklist';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      handleDeleteChecklist(name, deleteBtn);
    };
    
    actions.append(loadBtn, downloadBtn, deleteBtn);
    item.append(nameEl, actions);
    checklistsList.appendChild(item);
  });
}

function handleDeleteChecklist(name, button) {
  if (button.classList.contains('confirming')) {
    // Second click - actually delete
    deleteChecklist(name);
    if (listTitle === name) {
      // If we deleted the current checklist, load most recent or create new
      const mostRecent = getMostRecentChecklist();
      if (mostRecent) {
        loadChecklist(mostRecent);
      } else {
        pushUndo();
        items = [];
        listTitle = "Checklist Queue";
        titleEl.textContent = listTitle;
        renderFLIP();
      }
    }
    // Clear timeout if it exists
    if (deleteConfirmTimeouts.has(name)) {
      clearTimeout(deleteConfirmTimeouts.get(name));
      deleteConfirmTimeouts.delete(name);
    }
  } else {
    // First click - show confirmation
    button.classList.add('confirming');
    button.textContent = '!';
    button.title = 'Click again to confirm delete';
    const timeout = setTimeout(() => {
      button.classList.remove('confirming');
      button.textContent = '×';
      button.title = 'Delete checklist';
      deleteConfirmTimeouts.delete(name);
    }, 3000);
    deleteConfirmTimeouts.set(name, timeout);
  }
}

// ===========================
// New Checklist Button
// ===========================

if (newChecklistBtn) {
  newChecklistBtn.onclick = () => {
    pushUndo();
    items = [];
    // Generate unique name for new checklist
    listTitle = getUniqueChecklistName("Checklist Queue");
    titleEl.textContent = listTitle;
    editingTemplateId = null;
    if (saveTemplateBtn) saveTemplateBtn.style.display = 'none';
    renderFLIP();
    closeMenu();
  };
}

// ===========================
// Template Management
// ===========================

if (newTemplateBtn) {
  newTemplateBtn.onclick = () => {
    const name = prompt('Template name:');
    if (!name || !name.trim()) return;
    pushUndo();
    items = [];
    listTitle = name.trim();
    titleEl.textContent = listTitle;
    editingTemplateId = null;
    if (saveTemplateBtn) saveTemplateBtn.style.display = 'inline-block';
    renderFLIP();
    closeMenu();
  };
}

if (saveTemplateBtn) {
  saveTemplateBtn.onclick = () => {
    if (editingTemplateId) {
      saveTemplate(editingTemplateId, listTitle, items);
    } else {
      const id = crypto.randomUUID();
      saveTemplate(id, listTitle, items);
      editingTemplateId = id;
    }
    if (saveTemplateBtn) saveTemplateBtn.style.display = 'none';
    editingTemplateId = null;
    renderTemplatesList();
    renderChecklistList();
    updateCurrentChecklistName();
    closeMenu();
  };
}

// ===========================
// ABC Sort Button
// ===========================

if (abcSortBtn) {
  abcSortBtn.onclick = () => {
    sortAlphabetically('checklists');
    sortAlphabetically('templates');
    renderChecklistList();
    renderTemplateList();
  };
}

function sortAlphabetically(listType) {
  const data = getStorageData();
  if (listType === 'checklists') {
    if (!data.checklistOrder) data.checklistOrder = [];
    data.checklistOrder.sort((a, b) => {
      const aTitle = data.checklists[a]?.title || a;
      const bTitle = data.checklists[b]?.title || b;
      return aTitle.localeCompare(bTitle);
    });
  } else if (listType === 'templates') {
    const templateData = getTemplatesData();
    templateData.templateOrder.sort((a, b) => {
      const aName = templateData.templates[a]?.name || '';
      const bName = templateData.templates[b]?.name || '';
      return aName.localeCompare(bName);
    });
    saveStorageData(templateData);
    return;
  }
  saveStorageData(data);
}

function reorderList(listType, fromIndex, toIndex) {
  const data = getStorageData();
  if (listType === 'checklists') {
    if (!data.checklistOrder) data.checklistOrder = getAllChecklists();
    const [moved] = data.checklistOrder.splice(fromIndex, 1);
    data.checklistOrder.splice(toIndex, 0, moved);
  } else if (listType === 'templates') {
    const templateData = getTemplatesData();
    const [moved] = templateData.templateOrder.splice(fromIndex, 1);
    templateData.templateOrder.splice(toIndex, 0, moved);
    saveStorageData(templateData);
    return;
  }
  saveStorageData(data);
}

// ===========================
// Dark Mode Toggle (Sidebar)
// ===========================

if (toggleDarkSidebarBtn) {
  toggleDarkSidebarBtn.onclick = () => document.body.classList.toggle("dark");
}

// ===========================
// Priority Color Customization
// ===========================

function hexToRgbVar(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `${r}, ${g}, ${b}`;
}

function rgbVarToHex(rgbVar) {
  if (!rgbVar) return null;
  const m = /(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(rgbVar);
  if (!m) return null;
  const toHex = (v) => {
    const n = Math.max(0, Math.min(255, parseInt(v, 10) || 0));
    return n.toString(16).padStart(2, '0');
  };
  const r = toHex(m[1]);
  const g = toHex(m[2]);
  const b = toHex(m[3]);
  return `#${r}${g}${b}`;
}

function getThemeData() {
  const data = getStorageData();
  if (!data.theme) data.theme = { priorityColors: {} };
  if (!data.theme.priorityColors) data.theme.priorityColors = {};
  return data;
}

function applyPriorityColors(priorityColors) {
  const root = document.documentElement;
  const mapping = {
    "1": "--later",
    "2": "--low",
    "3": "--high",
    "4": "--very-high",
    "5": "--now"
  };
  Object.entries(mapping).forEach(([level, cssVar]) => {
    if (priorityColors[level]) root.style.setProperty(cssVar, priorityColors[level]);
  });
}

function setPriorityColor(level, rgbVar) {
  const data = getThemeData();
  if (!data.theme) data.theme = {};
  if (!data.theme.priorityColors) data.theme.priorityColors = {};
  
  data.theme.priorityColors[String(level)] = rgbVar;
  data.theme.lastModified = new Date().toISOString();
  data.theme.synced = false;
  
  // Force save to localStorage
  saveStorageData(data);
  
  // Verify it was saved
  const verify = getStorageData();
  if (!verify.theme?.priorityColors?.[String(level)]) {
    console.error('Failed to save priority color!', level, rgbVar);
    // Try again
    const retry = getThemeData();
    retry.theme.priorityColors[String(level)] = rgbVar;
    retry.theme.lastModified = new Date().toISOString();
    saveStorageData(retry);
  }
  
  applyPriorityColors(data.theme.priorityColors);
  updateColorBubbleBackgrounds(); // Update bubble backgrounds when color is saved
  if (currentUser && supabaseClient) syncSettingsToCloud();
}

async function syncSettingsToCloud() {
  if (!currentUser || !supabaseClient) return;
  try {
    const data = getStorageData();
    const payload = data.theme?.priorityColors || {};
    const { error } = await supabaseClient
      .from('user_settings')
      .upsert({
        user_id: currentUser.id,
        priority_colors: payload,
        last_modified: new Date().toISOString()
      }, { onConflict: 'user_id' });
    if (!error) {
      const d = getStorageData();
      if (!d.theme) d.theme = {};
      d.theme.synced = true;
      saveStorageData(d);
    }
  } catch (err) {
    console.error('Error syncing settings to cloud:', err);
  }
}

async function syncSettingsFromCloud() {
  if (!currentUser || !supabaseClient) return;
  try {
    const { data: rows, error } = await supabaseClient
      .from('user_settings')
      .select('*')
      .eq('user_id', currentUser.id)
      .limit(1);
    if (error) {
      console.error('Error fetching settings from cloud:', error);
      return;
    }
    if (!rows || rows.length === 0) return;
    
    const cloud = rows[0];
    const local = getThemeData();
    const localTime = new Date(local.theme.lastModified || 0);
    const cloudTime = new Date(cloud.last_modified || 0);

    if (!local.theme) local.theme = {};
    if (!local.theme.priorityColors) local.theme.priorityColors = {};

    if (cloudTime > localTime) {
      local.theme.priorityColors = cloud.priority_colors || {};
      local.theme.lastModified = cloud.last_modified;
      local.theme.synced = true;
      saveStorageData(local);
      applyPriorityColors(local.theme.priorityColors);
      updateColorBubbleBackgrounds(); // Update bubble backgrounds when syncing from cloud
    } else if (localTime > cloudTime && !local.theme.synced) {
      syncSettingsToCloud();
    }
  } catch (err) {
    console.error('Error syncing settings from cloud:', err);
  }
}

// Update color bubble backgrounds to reflect saved colors
function updateColorBubbleBackgrounds() {
  if (!colorCustomizerEl) return;
  const data = getThemeData();
  const priorityColors = data.theme.priorityColors || {};
  
  colorCustomizerEl.querySelectorAll('.color-bubble').forEach(btn => {
    const level = btn.dataset.level;
    const rgbVar = priorityColors[level];
    if (rgbVar) {
      // Convert RGB var (e.g., "126, 87, 194") to hex for background
      const hex = rgbVarToHex(rgbVar);
      if (hex) {
        btn.style.background = hex;
      }
    }
  });
}

// Initialize priority colors from storage
function initializePriorityColors() {
  const themeData = getThemeData();
  if (themeData.theme && themeData.theme.priorityColors && Object.keys(themeData.theme.priorityColors).length > 0) {
    applyPriorityColors(themeData.theme.priorityColors);
    updateColorBubbleBackgrounds();
  }
}

// Color picker functionality
if (colorCustomizerEl) {
  const picker = document.getElementById('priorityColorPicker');
  if (picker) {
    let pendingLevel = null;
    let activeBubble = null;
    let saveTimeout = null;
    let blurTimeout = null;
    let lastSavedHex = null;
    let isSelectingNewColor = false; // Flag to prevent blur from clearing state when switching bubbles
    
    // Clicking a bubble selects which priority we're editing and opens the native picker
    colorCustomizerEl.querySelectorAll('.color-bubble').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Clear any pending blur timeout that might clear state
        if (blurTimeout) {
          clearTimeout(blurTimeout);
          blurTimeout = null;
        }
        
        // Set flag to prevent blur from clearing state
        isSelectingNewColor = true;
        
        // Save any pending changes from previous selection
        if (saveTimeout) {
          clearTimeout(saveTimeout);
          saveTimeout = null;
        }
        if (pendingLevel) {
          saveColor();
        }
        
        // Set up new selection
        pendingLevel = btn.dataset.level;
        activeBubble = btn;
        // Try to prefill with existing color for this level
        const data = getThemeData();
        const currentRgb = data.theme.priorityColors?.[btn.dataset.level];
        const hex = rgbVarToHex(currentRgb) || '#ffffff';
        picker.value = hex;
        lastSavedHex = hex; // Track what we started with
        
        // Reset flag after a short delay (allows picker to open)
        setTimeout(() => {
          isSelectingNewColor = false;
        }, 200);
        
        picker.focus();
        picker.click();
      });
    });

    // Function to save color (called on change, blur, or debounced input)
    function saveColor() {
      if (!pendingLevel) return;
      const hex = picker.value;
      const rgb = hexToRgbVar(hex);
      if (!rgb) return;
      
      // Only save if color actually changed
      if (hex !== lastSavedHex) {
        setPriorityColor(pendingLevel, rgb);
        lastSavedHex = hex;
        // Update the active bubble background to match
        if (activeBubble) {
          activeBubble.style.background = hex;
        }
      }
    }

    // Update bubble color in real-time as user drags/selects in the color picker
    picker.addEventListener('input', () => {
      if (!pendingLevel || !activeBubble) return;
      const hex = picker.value;
      // Update the bubble's background color immediately for visual feedback
      activeBubble.style.background = hex;
      // Update CSS variables in real-time so the whole app reflects the change
      const rgb = hexToRgbVar(hex);
      if (rgb) {
        applyPriorityColors({ [pendingLevel]: rgb });
      }
      
      // Debounce save - save after user stops dragging for 500ms
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveColor();
      }, 500);
    });

    // Save immediately when user finishes selecting (on change event)
    picker.addEventListener('change', () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = null;
      saveColor();
    });

    // Save when picker loses focus (in case change didn't fire)
    picker.addEventListener('blur', () => {
      // Don't clear state if we're in the middle of selecting a new color
      if (isSelectingNewColor) {
        return;
      }
      
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }
      saveColor();
      
      // Clear pending state after a delay, but only if not selecting new color
      if (blurTimeout) clearTimeout(blurTimeout);
      blurTimeout = setTimeout(() => {
        if (!isSelectingNewColor) {
          pendingLevel = null;
          activeBubble = null;
          lastSavedHex = null;
        }
        blurTimeout = null;
      }, 300);
    });
  }
}

if (signInBtn) {
  signInBtn.onclick = () => signInWithGoogle();
}

if (signOutBtn) {
  signOutBtn.onclick = () => signOut();
}

// ===========================
// Current Checklist Name Display
// ===========================

function updateCurrentChecklistName() {
  const currentChecklistNameEl = document.getElementById('currentChecklistName');
  if (currentChecklistNameEl) {
    const data = getStorageData();
    const currentName = data.currentChecklist || listTitle;
    currentChecklistNameEl.textContent = currentName || 'No checklist loaded';
  }
}

// ===========================
// Auto-save on changes
// ===========================

let autoSaveTimeout = null;

function autoSave() {
  if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => {
    if (listTitle && listTitle.trim()) {
      saveChecklist(listTitle);
    }
  }, 1000); // Debounce: save 1 second after last change
}

// Hook into existing functions to trigger auto-save
const originalRenderFLIP = renderFLIP;
renderFLIP = function() {
  originalRenderFLIP();
  autoSave();
};

// ===========================
// Modify saveListFile to also save to storage
// ===========================

const originalSaveListFile = saveListFile;
saveListFile = function() {
  saveChecklist(listTitle, serializeList());
  originalSaveListFile();
};

// ===========================
// Load most recent checklist on startup
// ===========================

function loadMostRecentChecklist() {
  const mostRecent = getMostRecentChecklist();
  if (mostRecent) {
    loadChecklist(mostRecent);
  } else {
    // Save the default checklist
    saveChecklist(listTitle);
  }
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

function initializeApp() {
  // Migrate old format to new format first
  migrateOldFormat();
  
  ensureDefaultTemplates();
  
  // Initialize priority colors from local storage
  initializePriorityColors();
  
  initSupabase();
  loadMostRecentChecklist();
  updateAuthUI();
  renderTemplatesList();
  renderChecklistList();
  updateCurrentChecklistName();
  
  // Update menu mode on window resize (for mobile/desktop detection)
  window.addEventListener('resize', () => {
    render(); // Re-render to apply correct layout
  });
}
