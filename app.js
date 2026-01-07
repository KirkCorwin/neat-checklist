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
const toggleDarkBtn = document.getElementById("toggleDark");
const toggleInputPosBtn = document.getElementById("toggleInputPos");

let items = [];
let showPriority = false;
let draggedId = null;
let undoStack = [];
let listTitle = "Checklist Queue";
let inputAtTop = false;

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

titleEl.onclick = () => {
  const inputEl = document.createElement("input");
  inputEl.type = "text";
  inputEl.value = listTitle;
  inputEl.className = "rename";
  inputEl.style.fontSize = "2rem";
  inputEl.style.fontWeight = "800";

  const finish = () => {
    if (inputEl.value.trim()) listTitle = inputEl.value.trim();
    titleEl.textContent = listTitle;
    inputEl.replaceWith(titleEl);
  };

  inputEl.onblur = finish;
  inputEl.onkeydown = e => { if (e.key === "Enter") finish(); };

  titleEl.replaceWith(inputEl);
  inputEl.focus();
  inputEl.select();
};

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

function importList(serialized) {
  const chunks = serialized.split("::ITEM::").map(c => c.trim()).filter(Boolean);
  chunks.forEach(chunk => {
    if (chunk.startsWith("::TITLE::")) {
      listTitle = chunk.replace("::TITLE::", "").trim();
      titleEl.textContent = listTitle;
      return;
    }
    const [text, pri, done] = chunk.split("||").map(s => s.trim());
    const item = {
      id: crypto.randomUUID(),
      text,
      priority: parseInt(pri || 3),
      done: done === "true"
    };
    inputAtTop ? items.unshift(item) : items.push(item);
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
toggleDarkBtn.onclick = () => document.body.classList.toggle("dark");
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
  list.innerHTML = "";

  items.forEach(item => {
    const li = document.createElement("li");
    li.className = "item" + (item.done ? " done" : "");
    li.dataset.id = item.id;
    li.dataset.priority = item.priority;
    li.draggable = true;

    li.ondragstart = () => draggedId = item.id;
    li.ondragover = e => e.preventDefault();
    li.ondrop = () => {
      const from = items.findIndex(i => i.id === draggedId);
      const to = items.findIndex(i => i.id === item.id);
      const [m] = items.splice(from, 1);
      items.splice(to, 0, m);
      renderFLIP();
    };

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = item.done;
    cb.onchange = () => { item.done = cb.checked; render(); };

    const text = document.createElement("div");
    text.className = "text";
    text.textContent = item.text;
    text.onclick = e => {
      e.stopPropagation();
      startRename(text, item);
    };

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
      b.onclick = () => { item.priority = p.level; render(); };
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
    list.appendChild(li);
  });
}

// ===========================
// Rename item
// ===========================

function startRename(textEl, item) {
  const inputEl = document.createElement("input");
  inputEl.className = "rename";
  inputEl.value = item.text;

  let finished = false;

  function finish() {
    if (finished) return;
    finished = true;

    const value = inputEl.value.trim();
    if (value) item.text = value;

    render();
  }

  inputEl.addEventListener("blur", finish);
  inputEl.addEventListener("keydown", e => {
    if (e.key === "Enter") finish();
    if (e.key === "Escape") render();
  });

  inputEl.addEventListener("click", e => e.stopPropagation());
  inputEl.addEventListener("mousedown", e => e.stopPropagation());

  textEl.replaceWith(inputEl);
  inputEl.focus();
  inputEl.select();
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

  // Update per-item controls so the toggle/shaded circle reappears
//   render(); // optional if your syncControls already handles it

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
