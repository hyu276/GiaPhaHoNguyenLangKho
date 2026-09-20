const STORAGE_KEY = "giapha-admin-demo-v4";

const initialState = {
  people: [
    {
      id: "P001",
      name: "Nguyễn Văn Tổ",
      description: "Thủy tổ của nhánh demo, lưu lại để minh họa hồ sơ tiểu sử.",
      birth: 1902,
      death: 1978,
      sex: "male",
      visibility: "public",
      archived: false,
      x: 90,
      y: 70,
    },
    {
      id: "P002",
      name: "Nguyễn Thị An",
      description: "Hồ sơ synthetic dùng để thử chỉnh sửa mô tả và visibility.",
      birth: 1908,
      death: 1987,
      sex: "female",
      visibility: "public",
      archived: false,
      x: 390,
      y: 70,
    },
    {
      id: "P003",
      name: "Nguyễn Văn Bình",
      description: "Đại diện thế hệ thứ hai trong cây demo.",
      birth: 1932,
      death: 2004,
      sex: "male",
      visibility: "public",
      archived: false,
      x: 240,
      y: 250,
    },
    {
      id: "P004",
      name: "Nguyễn Thị Mai",
      description: "Ví dụ hồ sơ riêng tư của người còn sống.",
      birth: 1936,
      death: null,
      sex: "female",
      visibility: "private",
      archived: false,
      x: 540,
      y: 250,
    },
    {
      id: "P005",
      name: "Nguyễn Văn Cường",
      description: "Bản ghi synthetic phục vụ kiểm thử Person CRUD.",
      birth: 1958,
      death: null,
      sex: "male",
      visibility: "public",
      archived: false,
      x: 240,
      y: 450,
    },
    {
      id: "P006",
      name: "Nguyễn Thị Lan",
      description: null,
      birth: 1962,
      death: null,
      sex: "female",
      visibility: "private",
      archived: false,
      x: 540,
      y: 450,
    },
  ],
  relationships: [
    { id: "R001", kind: "partnership", source: "P001", target: "P002" },
    { id: "R002", kind: "parent_child", source: "P001", target: "P003" },
    { id: "R003", kind: "parent_child", source: "P002", target: "P003" },
    { id: "R004", kind: "partnership", source: "P003", target: "P004" },
    { id: "R005", kind: "parent_child", source: "P003", target: "P005" },
    { id: "R006", kind: "parent_child", source: "P004", target: "P005" },
    { id: "R007", kind: "partnership", source: "P005", target: "P006" },
  ],
};

let state = loadState();
let selectedId = null;
let history = [];
let future = [];
let relationshipMode = null;
let searchTerm = "";
let lifeFilter = "all";
let visibilityFilter = "all";
let archiveFilter = "active";
let focusedId = null;
let collapsedBranchIds = new Set();
let lockedPersonIds = new Set();
let layoutHistory = [];
let layoutFuture = [];
let dragContext = null;

const canvas = document.querySelector("#canvas");
const nodesLayer = document.querySelector("#nodes");
const edgesSvg = document.querySelector("#edges");
const saveStatus = document.querySelector("#saveStatus");
const emptySearch = document.querySelector("#emptySearch");
const filterStatus = document.querySelector("#filterStatus");

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
  layoutHistory = [];
  layoutFuture = [];
  persistState(message);
  render();
}

function nextPersonId() {
  const max = state.people.reduce(
    (value, person) => Math.max(value, Number(person.id.slice(1)) || 0),
    0,
  );
  return `P${String(max + 1).padStart(3, "0")}`;
}

function nextRelationshipId() {
  const max = state.relationships.reduce(
    (value, relation) => Math.max(value, Number(relation.id.slice(1)) || 0),
    0,
  );
  return `R${String(max + 1).padStart(3, "0")}`;
}

function getPerson(id) {
  return state.people.find((person) => person.id === id) ?? null;
}

function getFallbackPosition(index) {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return { x: 80 + column * 260, y: 80 + row * 180 };
}

function getBranchPersonIds(rootId) {
  return new Set([rootId, ...descendantsOf(rootId)]);
}

function getFallbackLayoutPositions(targetIds) {
  const positions = new Map();

  state.people.forEach((person, index) => {
    if (!targetIds.has(person.id) || lockedPersonIds.has(person.id)) return;
    positions.set(person.id, getFallbackPosition(index));
  });

  return positions;
}

function buildChildAdjacency() {
  const childrenByParent = new Map();

  state.relationships.forEach((relation) => {
    if (relation.kind !== "parent_child") return;
    const children = childrenByParent.get(relation.source) ?? [];
    if (children.includes(relation.target)) return;
    children.push(relation.target);
    childrenByParent.set(relation.source, children);
  });

  return childrenByParent;
}

function getBranchDepths(rootId) {
  const childrenByParent = buildChildAdjacency();
  const depths = new Map([[rootId, 0]]);
  const queue = [rootId];

  while (queue.length) {
    const personId = queue.shift();
    const nextDepth = (depths.get(personId) ?? 0) + 1;

    for (const childId of childrenByParent.get(personId) ?? []) {
      if (depths.has(childId)) continue;
      depths.set(childId, nextDepth);
      queue.push(childId);
    }
  }

  return depths;
}

function getAutoLayoutPositions(rootId) {
  const root = getPerson(rootId);
  if (!root) return new Map();

  const branchIds = getBranchPersonIds(rootId);
  const depths = getBranchDepths(rootId);
  const idsByDepth = new Map();

  state.people.forEach((person) => {
    if (
      person.id === rootId ||
      !branchIds.has(person.id) ||
      lockedPersonIds.has(person.id)
    ) {
      return;
    }

    const depth = depths.get(person.id);
    if (depth === undefined) return;
    const ids = idsByDepth.get(depth) ?? [];
    ids.push(person.id);
    idsByDepth.set(depth, ids);
  });

  const positions = new Map();
  idsByDepth.forEach((personIds, depth) => {
    const centerOffset = (personIds.length - 1) / 2;
    personIds.forEach((personId, index) => {
      positions.set(personId, {
        x: root.x + (index - centerOffset) * 260,
        y: root.y + depth * 180,
      });
    });
  });

  return positions;
}

function pushLayoutHistory(before, after) {
  layoutHistory.push({ before: [...before], after: [...after] });
  if (layoutHistory.length > 50) layoutHistory.shift();
  layoutFuture = [];
}

function applyLayoutPositions(positions, message, recordHistory = true) {
  const before = new Map();
  const after = new Map();

  positions.forEach((position, personId) => {
    const person = getPerson(personId);
    if (!person || person.archived) return;
    if (person.x === position.x && person.y === position.y) return;

    before.set(personId, { x: person.x, y: person.y });
    after.set(personId, position);
  });

  if (!after.size) return false;
  if (recordHistory) checkpoint();

  after.forEach((position, personId) => {
    const person = getPerson(personId);
    person.x = position.x;
    person.y = position.y;
  });

  if (recordHistory) pushLayoutHistory(before, after);
  persistState(message);
  render();
  return true;
}

function hiddenBranchIds() {
  const hidden = new Set();
  collapsedBranchIds.forEach((rootId) => {
    descendantsOf(rootId).forEach((personId) => hidden.add(personId));
  });
  return hidden;
}

function matchesArchiveFilter(person) {
  if (archiveFilter === "active") return !person.archived;
  if (archiveFilter === "archived") return person.archived;
  return true;
}

function matchesLifeFilter(person) {
  const isLiving = person.death === null;
  if (lifeFilter === "living") return isLiving;
  if (lifeFilter === "deceased") return !isLiving;
  return true;
}

function matchesVisibilityFilter(person) {
  return visibilityFilter === "all" || person.visibility === visibilityFilter;
}

function matchesSearchTerm(person) {
  if (!searchTerm) return true;
  return person.name.toLocaleLowerCase("vi-VN").includes(searchTerm);
}

function isVisiblePerson(person, hidden) {
  return (
    !hidden.has(person.id) &&
    matchesArchiveFilter(person) &&
    matchesLifeFilter(person) &&
    matchesVisibilityFilter(person) &&
    matchesSearchTerm(person)
  );
}

function visiblePeople() {
  const hidden = hiddenBranchIds();
  return state.people.filter((person) => isVisiblePerson(person, hidden));
}

function nodeCenter(person) {
  return { x: person.x + 89, y: person.y + 39 };
}

function formatYears(person) {
  const birth = person.birth ?? "?";
  const death = person.death ?? "nay";
  return `${birth} – ${death}`;
}

function sexLabel(sex, maleLabel, femaleLabel, unknownLabel) {
  if (sex === "male") return maleLabel;
  if (sex === "female") return femaleLabel;
  return unknownLabel;
}

function relationshipLabel(relation, selectedPersonId) {
  const otherId =
    relation.source === selectedPersonId ? relation.target : relation.source;
  const other = getPerson(otherId);
  const otherSex = other?.sex ?? null;

  if (relation.kind === "partnership") {
    return sexLabel(otherSex, "Chồng", "Vợ", "Hôn phối");
  }

  if (relation.source === selectedPersonId) {
    return sexLabel(otherSex, "Con trai", "Con gái", "Con");
  }

  return sexLabel(otherSex, "Cha", "Mẹ", "Cha / mẹ");
}

function renderEdges() {
  edgesSvg.replaceChildren();
  const displayed = new Set(visiblePeople().map((person) => person.id));

  state.relationships.forEach((relation) => {
    if (!displayed.has(relation.source) || !displayed.has(relation.target))
      return;
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
    line.setAttribute(
      "class",
      relation.kind === "partnership" ? "edge-partner" : "edge-parent",
    );
    edgesSvg.appendChild(line);
  });
}

function getNodeClassName(person) {
  return [
    "person-node",
    person.id === selectedId ? "selected" : "",
    person.visibility === "private" ? "private" : "",
    person.archived ? "archived" : "",
    person.id === focusedId ? "focused" : "",
    focusedId && person.id !== focusedId ? "deemphasized" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function createVisibilityBadge(person) {
  const badge = document.createElement("span");
  badge.className = [
    "node-badge",
    person.visibility === "private" ? "private" : "",
  ]
    .filter(Boolean)
    .join(" ");
  badge.textContent =
    person.visibility === "private" ? "Riêng tư" : "Công khai";
  return badge;
}

function appendArchivedBadge(badges, person) {
  if (!person.archived) return;

  const archivedBadge = document.createElement("span");
  archivedBadge.className = "node-badge private";
  archivedBadge.textContent = "Đã lưu trữ";
  badges.appendChild(archivedBadge);
}

function appendLockedBadge(badges, person) {
  if (!lockedPersonIds.has(person.id)) return;

  const lockedBadge = document.createElement("span");
  lockedBadge.className = "node-badge";
  lockedBadge.textContent = "Khóa vị trí";
  badges.appendChild(lockedBadge);
}

function createPersonNode(person) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = getNodeClassName(person);
  node.style.left = `${person.x}px`;
  node.style.top = `${person.y}px`;
  node.dataset.personId = person.id;

  const name = document.createElement("strong");
  name.textContent = person.name;

  const years = document.createElement("small");
  years.textContent = formatYears(person);

  const badges = document.createElement("span");
  badges.className = "node-badges";
  badges.appendChild(createVisibilityBadge(person));
  appendArchivedBadge(badges, person);
  appendLockedBadge(badges, person);

  node.append(name, years, badges);
  node.addEventListener("click", () => {
    selectedId = person.id;
    render();
  });
  node.addEventListener("pointerdown", startDrag);

  return node;
}

function renderNodes() {
  nodesLayer.replaceChildren();
  const displayed = visiblePeople();

  displayed.forEach((person) => {
    nodesLayer.appendChild(createPersonNode(person));
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
  document.querySelector("#personDescription").textContent =
    person.description || "Chưa có mô tả.";
  document.querySelector("#personId").textContent = person.id;
  document.querySelector("#personState").textContent = person.archived
    ? "Đã lưu trữ"
    : "Đang hoạt động";
  document.querySelector("#personPosition").textContent =
    `${Math.round(person.x)}, ${Math.round(person.y)}`;

  const list = document.querySelector("#relationList");
  list.replaceChildren();
  const related = state.relationships.filter(
    (relation) =>
      relation.source === person.id || relation.target === person.id,
  );

  if (!related.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Chưa có quan hệ trực tiếp.";
    list.appendChild(empty);
    return;
  }

  related.forEach((relation) => {
    const otherId =
      relation.source === person.id ? relation.target : relation.source;
    const other = getPerson(otherId);
    if (!other) return;
    const item = document
      .querySelector("#relationTemplate")
      .content.firstElementChild.cloneNode(true);
    item.querySelector(".relation-name").textContent = other.name;
    item.querySelector(".relation-kind").textContent = relationshipLabel(
      relation,
      person.id,
    );
    const jumpButton = item.querySelector(".relation-jump");
    jumpButton.addEventListener("click", () => jumpToPerson(other.id));

    const removeButton = item.querySelector(".relation-remove");
    const lockedByArchive = person.archived || other.archived;
    removeButton.disabled = lockedByArchive;
    removeButton.textContent = lockedByArchive
      ? "Giữ nguyên khi lưu trữ"
      : "Xóa quan hệ";
    removeButton.addEventListener("click", () =>
      removeRelationship(relation.id),
    );
    list.appendChild(item);
  });
}

function renderArchiveImpact(selectedPerson, selectedArchived) {
  const impact = document.querySelector("#archiveImpact");
  if (!impact) return;

  if (!selectedPerson) {
    impact.hidden = true;
    return;
  }

  const connected = state.relationships.filter(
    (relation) =>
      relation.source === selectedPerson.id ||
      relation.target === selectedPerson.id,
  ).length;

  impact.hidden = false;
  impact.textContent = selectedArchived
    ? `Hồ sơ đang lưu trữ. ${connected} quan hệ và vị trí vẫn được giữ nguyên.`
    : `Impact preview: ${connected} quan hệ trực tiếp và vị trí sẽ được giữ nguyên khi lưu trữ.`;
}

function render() {
  renderEdges();
  renderNodes();
  renderInspector();

  const selectedPerson = getPerson(selectedId);
  const selectedArchived = Boolean(selectedPerson?.archived);
  const hasSelection = Boolean(selectedPerson);
  const mutableSelection = hasSelection && !selectedArchived;
  const selectedLocked = Boolean(
    selectedPerson && lockedPersonIds.has(selectedPerson.id),
  );
  const archiveButton = document.querySelector("#archivePerson");

  document.querySelector("#editPerson").disabled = !mutableSelection;
  document.querySelector("#addParent").disabled = !mutableSelection;
  document.querySelector("#addChild").disabled = !mutableSelection;
  document.querySelector("#addPartner").disabled = !mutableSelection;
  archiveButton.disabled = !hasSelection;
  archiveButton.textContent = selectedArchived ? "Khôi phục" : "Lưu trữ";
  document.querySelector("#focusSelected").disabled = !hasSelection;
  document.querySelector("#toggleBranch").disabled = !hasSelection;
  document.querySelector("#toggleBranch").textContent =
    hasSelection && collapsedBranchIds.has(selectedPerson.id)
      ? "Mở nhánh con"
      : "Thu nhánh con";
  document.querySelector("#clearFocus").disabled = focusedId === null;
  document.querySelector("#undoButton").disabled = history.length === 0;
  document.querySelector("#redoButton").disabled = future.length === 0;
  document.querySelector("#layoutLock").disabled = !mutableSelection;
  document.querySelector("#layoutLock").textContent = selectedLocked
    ? "Mở khóa vị trí"
    : "Khóa vị trí";
  document.querySelector("#resetPersonLayout").disabled =
    !mutableSelection || selectedLocked;
  document.querySelector("#resetBranchLayout").disabled = !mutableSelection;
  document.querySelector("#autoLayoutBranch").disabled = !mutableSelection;
  document.querySelector("#layoutUndo").disabled = layoutHistory.length === 0;
  document.querySelector("#layoutRedo").disabled = layoutFuture.length === 0;
  filterStatus.textContent = `${visiblePeople().length} người phù hợp`;

  renderArchiveImpact(selectedPerson, selectedArchived);
}

function startDrag(event) {
  if (event.button !== 0) return;
  const id = event.currentTarget.dataset.personId;
  const person = getPerson(id);
  if (!person || person.archived || lockedPersonIds.has(id)) return;
  selectedId = id;
  checkpoint();
  dragContext = {
    id,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    personX: person.x,
    personY: person.y,
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
  const person = getPerson(dragContext.id);

  if (
    person &&
    (person.x !== dragContext.personX || person.y !== dragContext.personY)
  ) {
    pushLayoutHistory(
      new Map([
        [
          person.id,
          { x: dragContext.personX, y: dragContext.personY },
        ],
      ]),
      new Map([[person.id, { x: person.x, y: person.y }]]),
    );
  }

  dragContext = null;
  persistState("Đã lưu vị trí demo");
  render();
}

function getPersonField(person, field, fallback = "") {
  if (!person) return fallback;
  const value = person[field];
  return value === null || value === undefined ? fallback : value;
}

function openPersonDialog(person = null) {
  if (person?.archived) return;
  const dialog = document.querySelector("#personDialog");
  const title = person ? "Sửa người" : "Thêm người";

  document.querySelector("#dialogTitle").textContent = title;
  document.querySelector("#editingId").value = getPersonField(person, "id");
  document.querySelector("#nameField").value = getPersonField(person, "name");
  document.querySelector("#descriptionField").value = getPersonField(
    person,
    "description",
  );
  updateDescriptionCount();
  document.querySelector("#birthField").value = getPersonField(person, "birth");
  document.querySelector("#deathField").value = getPersonField(person, "death");
  document.querySelector("#sexField").value = getPersonField(person, "sex");
  document.querySelector("#visibilityField").value = getPersonField(
    person,
    "visibility",
    "private",
  );

  dialog.showModal();
  document.querySelector("#nameField").focus();
}

function updateDescriptionCount() {
  document.querySelector("#descriptionCount").textContent = document
    .querySelector("#descriptionField")
    .value.length.toString();
}

function readNullableYear(selector) {
  const raw = document.querySelector(selector).value;
  return raw ? Number(raw) : null;
}

function readPersonDraft() {
  return {
    name: document.querySelector("#nameField").value.trim(),
    description:
      document.querySelector("#descriptionField").value.trim() || null,
    birth: readNullableYear("#birthField"),
    death: readNullableYear("#deathField"),
    sex: document.querySelector("#sexField").value || null,
    visibility: document.querySelector("#visibilityField").value,
  };
}

function validatePersonDraft(draft) {
  if (!draft.name) return false;

  const hasBothYears = draft.birth !== null && draft.death !== null;
  if (hasBothYears && draft.birth > draft.death) {
    window.alert("Năm sinh không thể sau năm mất.");
    return false;
  }

  return true;
}

function updatePersonRecord(id, draft) {
  const person = getPerson(id);
  if (!person) return false;

  Object.assign(person, draft);
  selectedId = id;
  return true;
}

function createPersonRecord(draft) {
  const bounds = canvas.getBoundingClientRect();
  const person = {
    id: nextPersonId(),
    ...draft,
    archived: false,
    x: Math.max(40, bounds.width / 2 - 89),
    y: Math.max(40, bounds.height / 2 - 39),
  };

  state.people.push(person);
  selectedId = person.id;
  return true;
}

function applyPersonDraft(id, draft) {
  return id ? updatePersonRecord(id, draft) : createPersonRecord(draft);
}

function getPersonSaveMessage(id) {
  return id ? "Đã cập nhật người trong demo" : "Đã thêm người vào demo";
}

function savePersonFromDialog() {
  const id = document.querySelector("#editingId").value;
  const draft = readPersonDraft();
  if (!validatePersonDraft(draft)) return false;

  checkpoint();
  if (!applyPersonDraft(id, draft)) return false;

  persistState(getPersonSaveMessage(id));
  render();
  return true;
}

function openRelationshipDialog(mode) {
  const source = getPerson(selectedId);
  if (!source || source.archived) return;
  relationshipMode = mode;

  const labels = {
    parent: [
      "Thêm cha / mẹ",
      "Chọn người sẽ là cha hoặc mẹ của người đang chọn.",
    ],
    child: ["Thêm con", "Chọn người sẽ là con của người đang chọn."],
    partner: [
      "Thêm hôn phối",
      "Chọn người sẽ có quan hệ hôn phối với người đang chọn.",
    ],
  };

  document.querySelector("#relationshipTitle").textContent = labels[mode][0];
  document.querySelector("#relationshipSummary").textContent =
    `${labels[mode][1]} Đang chọn: ${source.name}`;

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
      return (
        (relation.source === source && relation.target === target) ||
        (relation.source === target && relation.target === source)
      );
    }
    return relation.source === source && relation.target === target;
  });
}

function descendantsOf(personId) {
  const visited = new Set([personId]);
  const descendants = new Set();
  const queue = [personId];

  while (queue.length) {
    const current = queue.shift();
    state.relationships
      .filter(
        (relation) =>
          relation.kind === "parent_child" && relation.source === current,
      )
      .forEach((relation) => {
        if (visited.has(relation.target)) return;
        visited.add(relation.target);
        descendants.add(relation.target);
        queue.push(relation.target);
      });
  }

  return descendants;
}

function hasRelationshipSelection(selected, target, mode) {
  return Boolean(selected && target && mode);
}

function buildRelationshipDraft(selected, target, mode) {
  if (mode === "parent") {
    return { kind: "parent_child", source: target, target: selected };
  }

  if (mode === "partner") {
    return { kind: "partnership", source: selected, target };
  }

  return { kind: "parent_child", source: selected, target };
}

function validateRelationshipDraft(draft) {
  if (draft.source === draft.target) {
    window.alert("Không thể tạo quan hệ với chính người đó.");
    return false;
  }

  if (wouldDuplicate(draft.kind, draft.source, draft.target)) {
    window.alert("Quan hệ này đã tồn tại.");
    return false;
  }

  const isParentChild = draft.kind === "parent_child";
  if (isParentChild && descendantsOf(draft.target).has(draft.source)) {
    window.alert("Quan hệ này sẽ tạo vòng lặp tổ tiên nên bị từ chối.");
    return false;
  }

  return true;
}

function saveRelationshipFromDialog() {
  const selected = selectedId;
  const target = document.querySelector("#relationshipTarget").value;
  const mode = relationshipMode;
  if (!hasRelationshipSelection(selected, target, mode)) return false;

  const draft = buildRelationshipDraft(selected, target, mode);
  if (!validateRelationshipDraft(draft)) return false;

  checkpoint();
  state.relationships.push({
    id: nextRelationshipId(),
    ...draft,
  });
  persistState("Đã tạo quan hệ demo");
  render();
  return true;
}

function removeRelationship(id) {
  const relation = state.relationships.find((item) => item.id === id);
  if (!relation) return;
  const source = getPerson(relation.source);
  const target = getPerson(relation.target);
  if (source?.archived || target?.archived) {
    window.alert("Hãy khôi phục hồ sơ đã lưu trữ trước khi sửa quan hệ này.");
    return;
  }
  if (!window.confirm("Xóa quan hệ này? Hai người sẽ không bị xóa.")) return;
  checkpoint();
  state.relationships = state.relationships.filter((item) => item.id !== id);
  persistState("Đã xóa quan hệ demo");
  render();
}

function archiveSelected() {
  const person = getPerson(selectedId);
  if (!person) return;
  const connected = state.relationships.filter(
    (relation) =>
      relation.source === person.id || relation.target === person.id,
  ).length;
  const action = person.archived ? "khôi phục" : "lưu trữ";
  if (
    !window.confirm(
      `${action[0].toUpperCase() + action.slice(1)} ${person.name}? Người này hiện có ${connected} quan hệ; các quan hệ sẽ được giữ nguyên trong demo.`,
    )
  )
    return;
  checkpoint();
  person.archived = !person.archived;
  persistState(
    person.archived
      ? "Đã lưu trữ người trong demo"
      : "Đã khôi phục người trong demo",
  );
  if (person.archived && archiveFilter === "active") {
    selectedId = null;
  }
  render();
}

function focusPerson(person) {
  if (!person) return;
  selectedId = person.id;
  focusedId = person.id;
  render();
}

function resetFilterControls() {
  document.querySelector("#searchInput").value = "";
  document.querySelector("#lifeFilter").value = "all";
  document.querySelector("#visibilityFilter").value = "all";
  document.querySelector("#archiveFilter").value = "active";
}

function showWholeTree() {
  searchTerm = "";
  lifeFilter = "all";
  visibilityFilter = "all";
  archiveFilter = "active";
  focusedId = null;
  collapsedBranchIds = new Set();
  resetFilterControls();
  render();
}

function jumpToPerson(personId) {
  const person = getPerson(personId);
  if (!person) return;

  searchTerm = "";
  lifeFilter = "all";
  visibilityFilter = "all";
  archiveFilter = person.archived ? "all" : "active";
  collapsedBranchIds = new Set();
  selectedId = person.id;
  focusedId = person.id;

  document.querySelector("#searchInput").value = "";
  document.querySelector("#lifeFilter").value = "all";
  document.querySelector("#visibilityFilter").value = "all";
  document.querySelector("#archiveFilter").value = archiveFilter;
  render();
}

function toggleSelectedBranch() {
  const person = getPerson(selectedId);
  if (!person) return;

  if (collapsedBranchIds.has(person.id)) {
    collapsedBranchIds.delete(person.id);
  } else {
    collapsedBranchIds.add(person.id);
  }
  render();
}

function toggleLayoutLock() {
  const person = getPerson(selectedId);
  if (!person || person.archived) return;

  if (lockedPersonIds.has(person.id)) {
    lockedPersonIds.delete(person.id);
  } else {
    lockedPersonIds.add(person.id);
  }
  render();
}

function resetSelectedPersonLayout() {
  const person = getPerson(selectedId);
  if (!person || person.archived || lockedPersonIds.has(person.id)) return;

  const index = state.people.findIndex((candidate) => candidate.id === person.id);
  applyLayoutPositions(
    new Map([[person.id, getFallbackPosition(index)]]),
    "Đã đặt lại vị trí demo",
  );
}

function resetSelectedBranchLayout() {
  const person = getPerson(selectedId);
  if (!person || person.archived) return;

  applyLayoutPositions(
    getFallbackLayoutPositions(getBranchPersonIds(person.id)),
    "Đã đặt lại bố cục nhánh demo",
  );
}

function autoLayoutSelectedBranch() {
  const person = getPerson(selectedId);
  if (!person || person.archived) return;

  applyLayoutPositions(
    getAutoLayoutPositions(person.id),
    "Đã tự sắp xếp nhánh demo",
  );
}

function undoLayout() {
  const entry = layoutHistory.at(-1);
  if (!entry) return;

  if (
    applyLayoutPositions(
      new Map(entry.before),
      "Đã hoàn tác vị trí demo",
      false,
    )
  ) {
    layoutHistory.pop();
    layoutFuture.push(entry);
    if (layoutFuture.length > 50) layoutFuture.shift();
    render();
  }
}

function redoLayout() {
  const entry = layoutFuture.at(-1);
  if (!entry) return;

  if (
    applyLayoutPositions(
      new Map(entry.after),
      "Đã làm lại vị trí demo",
      false,
    )
  ) {
    layoutFuture.pop();
    layoutHistory.push(entry);
    if (layoutHistory.length > 50) layoutHistory.shift();
    render();
  }
}

document
  .querySelector("#descriptionField")
  .addEventListener("input", updateDescriptionCount);

document
  .querySelector("#addPerson")
  .addEventListener("click", () => openPersonDialog());
document
  .querySelector("#editPerson")
  .addEventListener("click", () => openPersonDialog(getPerson(selectedId)));
document
  .querySelector("#addParent")
  .addEventListener("click", () => openRelationshipDialog("parent"));
document
  .querySelector("#addChild")
  .addEventListener("click", () => openRelationshipDialog("child"));
document
  .querySelector("#addPartner")
  .addEventListener("click", () => openRelationshipDialog("partner"));
document
  .querySelector("#archivePerson")
  .addEventListener("click", archiveSelected);
document
  .querySelector("#focusSelected")
  .addEventListener("click", () => focusPerson(getPerson(selectedId)));
document
  .querySelector("#toggleBranch")
  .addEventListener("click", toggleSelectedBranch);
document.querySelector("#layoutLock").addEventListener("click", toggleLayoutLock);
document
  .querySelector("#resetPersonLayout")
  .addEventListener("click", resetSelectedPersonLayout);
document
  .querySelector("#resetBranchLayout")
  .addEventListener("click", resetSelectedBranchLayout);
document
  .querySelector("#autoLayoutBranch")
  .addEventListener("click", autoLayoutSelectedBranch);
document.querySelector("#layoutUndo").addEventListener("click", undoLayout);
document.querySelector("#layoutRedo").addEventListener("click", redoLayout);
document.querySelector("#clearFocus").addEventListener("click", () => {
  focusedId = null;
  render();
});

document.querySelector("#personForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  if (!savePersonFromDialog()) event.preventDefault();
});

document
  .querySelector("#relationshipForm")
  .addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    if (!saveRelationshipFromDialog()) event.preventDefault();
  });

document.querySelector("#searchInput").addEventListener("input", (event) => {
  searchTerm = event.target.value.trim().toLocaleLowerCase("vi-VN");
  render();
});

document.querySelector("#lifeFilter").addEventListener("change", (event) => {
  lifeFilter = event.target.value;
  render();
});

document
  .querySelector("#visibilityFilter")
  .addEventListener("change", (event) => {
    visibilityFilter = event.target.value;
    render();
  });

document.querySelector("#archiveFilter").addEventListener("change", (event) => {
  archiveFilter = event.target.value;
  const selectedPerson = getPerson(selectedId);
  if (archiveFilter === "active" && selectedPerson?.archived) {
    selectedId = null;
    focusedId = null;
  }
  render();
});

document.querySelector("#resetDemo").addEventListener("click", () => {
  if (!window.confirm("Reset toàn bộ dữ liệu demo về trạng thái ban đầu?"))
    return;
  history = [];
  future = [];
  state = clone(initialState);
  selectedId = null;
  searchTerm = "";
  lifeFilter = "all";
  visibilityFilter = "all";
  archiveFilter = "active";
  focusedId = null;
  collapsedBranchIds = new Set();
  lockedPersonIds = new Set();
  layoutHistory = [];
  layoutFuture = [];
  resetFilterControls();
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

document.querySelector("#fitButton").addEventListener("click", showWholeTree);

window.addEventListener("resize", renderEdges);
render();
