const STORAGE_KEY = "giapha-admin-demo-v1";

const initialState = {
  people: [
    { id: "P001", name: "Nguyễn Văn Tổ", birth: 1902, death: 1978, visibility: "public", archived: false, x: 90, y: 70 },
    { id: "P002", name: "Nguyễn Thị An", birth: 1908, death: 1987, visibility: "public", archived: false, x: 390, y: 70 },
    { id: "P003", name: "Nguyễn Văn Bình", birth: 1932, death: 2004, visibility: "public", archived: false, x: 240, y: 250 },
    { id: "P004", name: "Nguyễn Thị Mai", birth: 1936, death: null, visibility: "private", archived: false, x: 540, y: 250 },
    { id: "P005", name: "Nguyễn Văn Cường", birth: 1958, death: null, visibility: "public", archived: false, x: 240, y: 450 },
    { id: "P006", name: "Nguyễn Thị Lan", birth: 1962, death: null, visibility: "private", archived: false, x: 540, y: 450 }
  ],
  relationships: [
    { id: "R001", kind: "partnership", source: "P001", target: "P002" },
    { id: "R002", kind: "parent_child", source: "P001", target: "P003" },
    { id: "R003", kind: "parent_child", source: "P002", target: "P003" },
    { id: "R004", kind: "partnership", source: "P003", target: "P004" },
    { id: "R005", kind: "parent_child", source: "P003", target: "P005" },
    { id: "R006", kind: "parent_child", source: "P004", target: "P005" },
    { id: "R007", kind: "partnership", source: "P005", target: "P006" }
  ]
};

let state = loadState();
let selectedId = null;
let history = [];
let future = [];
let relationshipMode = null;
let searchTerm = "";
let showArchived = false;
let dragContext = null;

const canvas = document.querySelector("#canvas");
const nodesLayer = document.querySelector("#nodes");
const edgesSvg = document.querySelector("#edges");
const saveStatus = document.querySelector("#saveStatus");
const emptySearch = document.querySelector("#emptySearch");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : clone(initialState);
  } catch {
    return clone(initialState);
  }
}

function persistState(message = "Đã lưu demo trong trình duyệt") {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  saveStatus.textContent = message;
  window.setTimeout(() => {
    saveStatus.textContent = "Demo local · chưa kết nối Supabase";
  }, 1500);
}

function checkpoint() {
  history.push(clone(state));
  if (history.length > 40) history.shift();
  future = [];
}

function restoreSnapshot(snapshot, message) {
  state = clone(snapshot);
  persistState(message);
  render();
}

function nextPersonId() {
  const max = state.people.reduce((value, person) => Math.max(value, Number(person.id.slice(1)) || 0), 0);
  return `P${String(max + 1).padStart(3, "0")}`;
}

function nextRelationshipId() {
  const max = state.relationships.reduce((value, relation) => Math.max(value, Number(relation.id.slice(1)) || 0), 0);
  return `R${String(max + 1).padStart(3, "0")}`;
}

function getPerson(id) {
  return state.people.find((person) => person.id === id) ?? null;
}

function visiblePeople() {
  return state.people.filter((person) => {
    if (!showArchived && person.archived) return false;
    if (!searchTerm) return true;
    return person.name.toLowerCase().includes(searchTerm);
  });
}

function nodeCenter(person) {
  return { x: person.x + 89, y: person.y + 39 };
}

function formatYears(person) {
  const birth = person.birth ?? "?";
  const death = person.death ?? "nay";
  return `${birth} – ${death}`;
}

function relationshipLabel(relation, selectedPersonId) {
  if (relation.kind === "partnership") return "Hôn phối";
  return relation.source === selectedPersonId ? "Con" : "Cha / mẹ";
}

function renderEdges() {
  edgesSvg.replaceChildren();
  const displayed = new Set(visiblePeople().map((person) => person.id));

  state.relationships.forEach((relation) => {
    if (!displayed.has(relation.source) || !displayed.has(relation.target)) return;
    const source = getPerson(relation.source);
    const target = getPerson(relation.target);
    if (!source || !target) return;

    const a = nodeCenter(source);
    const b = nodeCenter(target);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", a.x);
    line.setAttribute("y1", a.y);
    line.setAttribute("x2", b.x);
    line.setAttribute("y2", b.y);
    line.setAttribute("class", relation.kind === "partnership" ? "edge-partner" : "edge-parent");
    edgesSvg.appendChild(line);
  });
}

function renderNodes() {
  nodesLayer.replaceChildren();
  const displayed = visiblePeople();

  displayed.forEach((person) => {
    const node = document.createElement("button");
    node.type = "button";
    node.className = [
      "person-node",
      person.id === selectedId ? "selected" : "",
      person.visibility === "private" ? "private" : "",
      person.archived ? "archived" : ""
    ].filter(Boolean).join(" ");
    node.style.left = `${person.x}px`;
    node.style.top = `${person.y}px`;
    node.dataset.personId = person.id;
    node.innerHTML = `
      <strong>${escapeHtml(person.name)}</strong>
      <small>${formatYears(person)}</small>
      <span class="node-badges">
        <span class="node-badge ${person.visibility === "private" ? "private" : ""}">${person.visibility === "private" ? "Riêng tư" : "Công khai"}</span>
        ${person.archived ? '<span class="node-badge private">Đã lưu trữ</span>' : ""}
      </span>
    `;

    node.addEventListener("click", () => {
      selectedId = person.id;
      render();
    });
    node.addEventListener("pointerdown", startDrag);
    nodesLayer.appendChild(node);
  });

  emptySearch.hidden = displayed.length > 0;
}

function renderInspector() {
  const person = getPerson(selectedId);
  document.querySelector("#inspectorEmpty").hidden = Boolean(person);
  document.querySelector("#inspectorContent").hidden = !person;

  if (!person) return;

  const pill = document.querySelector("#privacyPill");
  pill.textContent = person.visibility === "private" ? "Riêng tư" : "Công khai";
  pill.classList.toggle("private", person.visibility === "private");
  document.querySelector("#personName").textContent = person.name;
  document.querySelector("#personYears").textContent = formatYears(person);
  document.querySelector("#personId").textContent = person.id;
  document.querySelector("#personState").textContent = person.archived ? "Đã lưu trữ" : "Đang hoạt động";
  document.querySelector("#personPosition").textContent = `${Math.round(person.x)}, ${Math.round(person.y)}`;

  const list = document.querySelector("#relationList");
  list.replaceChildren();
  const related = state.relationships.filter((relation) => relation.source === person.id || relation.target === person.id);

  if (!related.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Chưa có quan hệ trực tiếp.";
    list.appendChild(empty);
    return;
  }

  related.forEach((relation) => {
    const otherId = relation.source === person.id ? relation.target : relation.source;
    const other = getPerson(otherId);
    if (!other) return;
    const item = document.querySelector("#relationTemplate").content.firstElementChild.cloneNode(true);
    item.querySelector(".relation-name").textContent = other.name;
    item.querySelector(".relation-kind").textContent = relationshipLabel(relation, person.id);
    item.querySelector(".relation-remove").addEventListener("click", () => removeRelationship(relation.id));
    list.appendChild(item);
  });
}

function render() {
  renderEdges();
  renderNodes();
  renderInspector();
  document.querySelector("#editPerson").disabled = !selectedId;
  document.querySelector("#addParent").disabled = !selectedId;
  document.querySelector("#addChild").disabled = !selectedId;
  document.querySelector("#addPartner").disabled = !selectedId;
  document.querySelector("#archivePerson").disabled = !selectedId;
  document.querySelector("#focusSelected").disabled = !selectedId;
  document.querySelector("#undoButton").disabled = history.length === 0;
  document.querySelector("#redoButton").disabled = future.length === 0;
}

function startDrag(event) {
  if (event.button !== 0) return;
  const id = event.currentTarget.dataset.personId;
  const person = getPerson(id);
  if (!person) return;
  selectedId = id;
  checkpoint();
  dragContext = {
    id,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    personX: person.x,
    personY: person.y
  };
  event.currentTarget.setPointerCapture(event.pointerId);
  event.currentTarget.addEventListener("pointermove", moveDrag);
  event.currentTarget.addEventListener("pointerup", endDrag, { once: true });
  renderInspector();
}

function moveDrag(event) {
  if (!dragContext || event.pointerId !== dragContext.pointerId) return;
  const person = getPerson(dragContext.id);
  if (!person) return;
  const bounds = canvas.getBoundingClientRect();
  const nextX = dragContext.personX + event.clientX - dragContext.startX;
  const nextY = dragContext.personY + event.clientY - dragContext.startY;
  person.x = Math.max(12, Math.min(bounds.width - 190, nextX));
  person.y = Math.max(12, Math.min(bounds.height - 90, nextY));
  const node = document.querySelector(`[data-person-id="${person.id}"]`);
  if (node) {
    node.style.left = `${person.x}px`;
    node.style.top = `${person.y}px`;
  }
  renderEdges();
  renderInspector();
}

function endDrag(event) {
  if (!dragContext) return;
  event.currentTarget.removeEventListener("pointermove", moveDrag);
  dragContext = null;
  persistState("Đã lưu vị trí demo");
  render();
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function openPersonDialog(person = null) {
  const dialog = document.querySelector("#personDialog");
  document.querySelector("#dialogTitle").textContent = person ? "Sửa người" : "Thêm người";
  document.querySelector("#editingId").value = person?.id ?? "";
  document.querySelector("#nameField").value = person?.name ?? "";
  document.querySelector("#birthField").value = person?.birth ?? "";
  document.querySelector("#deathField").value = person?.death ?? "";
  document.querySelector("#visibilityField").value = person?.visibility ?? "private";
  dialog.showModal();
  document.querySelector("#nameField").focus();
}

function savePersonFromDialog() {
  const id = document.querySelector("#editingId").value;
  const name = document.querySelector("#nameField").value.trim();
  const birthRaw = document.querySelector("#birthField").value;
  const deathRaw = document.querySelector("#deathField").value;
  const birth = birthRaw ? Number(birthRaw) : null;
  const death = deathRaw ? Number(deathRaw) : null;
  const visibility = document.querySelector("#visibilityField").value;

  if (!name) return false;
  if (birth && death && birth > death) {
    window.alert("Năm sinh không thể sau năm mất.");
    return false;
  }

  checkpoint();

  if (id) {
    const person = getPerson(id);
    if (!person) return false;
    Object.assign(person, { name, birth, death, visibility });
    selectedId = id;
  } else {
    const bounds = canvas.getBoundingClientRect();
    const person = {
      id: nextPersonId(),
      name,
      birth,
      death,
      visibility,
      archived: false,
      x: Math.max(40, bounds.width / 2 - 89),
      y: Math.max(40, bounds.height / 2 - 39)
    };
    state.people.push(person);
    selectedId = person.id;
  }

  persistState(id ? "Đã cập nhật người trong demo" : "Đã thêm người vào demo");
  render();
  return true;
}

function openRelationshipDialog(mode) {
  const source = getPerson(selectedId);
  if (!source) return;
  relationshipMode = mode;

  const labels = {
    parent: ["Thêm cha / mẹ", "Chọn người sẽ là cha hoặc mẹ của người đang chọn."],
    child: ["Thêm con", "Chọn người sẽ là con của người đang chọn."],
    partner: ["Thêm hôn phối", "Chọn người sẽ có quan hệ hôn phối với người đang chọn."]
  };

  document.querySelector("#relationshipTitle").textContent = labels[mode][0];
  document.querySelector("#relationshipSummary").textContent = `${labels[mode][1]} Đang chọn: ${source.name}`;

  const select = document.querySelector("#relationshipTarget");
  select.replaceChildren();
  state.people
    .filter((person) => person.id !== source.id && !person.archived)
    .forEach((person) => {
      const option = document.createElement("option");
      option.value = person.id;
      option.textContent = `${person.name} · ${formatYears(person)}`;
      select.appendChild(option);
    });

  document.querySelector("#relationshipDialog").showModal();
}

function wouldDuplicate(kind, source, target) {
  return state.relationships.some((relation) => {
    if (relation.kind !== kind) return false;
    if (kind === "partnership") {
      return (relation.source === source && relation.target === target) ||
        (relation.source === target && relation.target === source);
    }
    return relation.source === source && relation.target === target;
  });
}

function descendantsOf(personId) {
  const visited = new Set();
  const queue = [personId];
  while (queue.length) {
    const current = queue.shift();
    state.relationships
      .filter((relation) => relation.kind === "parent_child" && relation.source === current)
      .forEach((relation) => {
        if (!visited.has(relation.target)) {
          visited.add(relation.target);
          queue.push(relation.target);
        }
      });
  }
  return visited;
}

function saveRelationshipFromDialog() {
  const selected = selectedId;
  const target = document.querySelector("#relationshipTarget").value;
  if (!selected || !target || !relationshipMode) return false;

  let kind = "parent_child";
  let source = selected;
  let destination = target;

  if (relationshipMode === "parent") {
    source = target;
    destination = selected;
  } else if (relationshipMode === "partner") {
    kind = "partnership";
  }

  if (source === destination) {
    window.alert("Không thể tạo quan hệ với chính người đó.");
    return false;
  }

  if (wouldDuplicate(kind, source, destination)) {
    window.alert("Quan hệ này đã tồn tại.");
    return false;
  }

  if (kind === "parent_child" && descendantsOf(destination).has(source)) {
    window.alert("Quan hệ này sẽ tạo vòng lặp tổ tiên nên bị từ chối.");
    return false;
  }

  checkpoint();
  state.relationships.push({
    id: nextRelationshipId(),
    kind,
    source,
    target: destination
  });
  persistState("Đã tạo quan hệ demo");
  render();
  return true;
}

function removeRelationship(id) {
  const relation = state.relationships.find((item) => item.id === id);
  if (!relation) return;
  if (!window.confirm("Xóa quan hệ này? Hai người sẽ không bị xóa.")) return;
  checkpoint();
  state.relationships = state.relationships.filter((item) => item.id !== id);
  persistState("Đã xóa quan hệ demo");
  render();
}

function archiveSelected() {
  const person = getPerson(selectedId);
  if (!person) return;
  const connected = state.relationships.filter((relation) => relation.source === person.id || relation.target === person.id).length;
  const action = person.archived ? "khôi phục" : "lưu trữ";
  if (!window.confirm(`${action[0].toUpperCase() + action.slice(1)} ${person.name}? Người này hiện có ${connected} quan hệ; các quan hệ sẽ được giữ nguyên trong demo.`)) return;
  checkpoint();
  person.archived = !person.archived;
  persistState(person.archived ? "Đã lưu trữ người trong demo" : "Đã khôi phục người trong demo");
  render();
}

function focusPerson(person) {
  if (!person) return;
  const bounds = canvas.getBoundingClientRect();
  checkpoint();
  person.x = Math.max(20, bounds.width / 2 - 89);
  person.y = Math.max(20, bounds.height / 2 - 39);
  persistState("Đã focus người trong demo");
  render();
}

document.querySelector("#addPerson").addEventListener("click", () => openPersonDialog());
document.querySelector("#editPerson").addEventListener("click", () => openPersonDialog(getPerson(selectedId)));
document.querySelector("#addParent").addEventListener("click", () => openRelationshipDialog("parent"));
document.querySelector("#addChild").addEventListener("click", () => openRelationshipDialog("child"));
document.querySelector("#addPartner").addEventListener("click", () => openRelationshipDialog("partner"));
document.querySelector("#archivePerson").addEventListener("click", archiveSelected);
document.querySelector("#focusSelected").addEventListener("click", () => focusPerson(getPerson(selectedId)));

document.querySelector("#personForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  if (!savePersonFromDialog()) event.preventDefault();
});

document.querySelector("#relationshipForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  if (!saveRelationshipFromDialog()) event.preventDefault();
});

document.querySelector("#searchInput").addEventListener("input", (event) => {
  searchTerm = event.target.value.trim().toLowerCase();
  render();
});

document.querySelector("#showArchived").addEventListener("change", (event) => {
  showArchived = event.target.checked;
  render();
});

document.querySelector("#resetDemo").addEventListener("click", () => {
  if (!window.confirm("Reset toàn bộ dữ liệu demo về trạng thái ban đầu?")) return;
  history = [];
  future = [];
  state = clone(initialState);
  selectedId = null;
  localStorage.removeItem(STORAGE_KEY);
  render();
});

document.querySelector("#undoButton").addEventListener("click", () => {
  if (!history.length) return;
  future.push(clone(state));
  restoreSnapshot(history.pop(), "Đã hoàn tác demo");
});

document.querySelector("#redoButton").addEventListener("click", () => {
  if (!future.length) return;
  history.push(clone(state));
  restoreSnapshot(future.pop(), "Đã làm lại demo");
});

document.querySelector("#fitButton").addEventListener("click", () => {
  checkpoint();
  const positions = [
    [90, 70], [390, 70], [240, 250], [540, 250], [240, 450], [540, 450],
    [90, 630], [390, 630], [690, 630]
  ];
  state.people.filter((person) => !person.archived).forEach((person, index) => {
    const position = positions[index] ?? [90 + (index % 3) * 300, 70 + Math.floor(index / 3) * 180];
    person.x = position[0];
    person.y = position[1];
  });
  persistState("Đã sắp xếp lại demo");
  render();
});

window.addEventListener("resize", renderEdges);
render();
