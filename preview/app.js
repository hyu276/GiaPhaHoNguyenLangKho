const STORAGE_KEY = "giapha-admin-demo-v5";

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
    {
      id: "P007",
      name: "Nguyễn Văn Cường",
      description:
        "Hồ sơ duplicate synthetic: cùng tên và năm sinh với P005 để review merge.",
      birth: 1958,
      death: null,
      sex: "male",
      visibility: "public",
      archived: false,
      mergedInto: null,
      x: 800,
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
    { id: "R008", kind: "partnership", source: "P007", target: "P006" },
  ],
  sources: [
    {
      id: "S001",
      title: "Gia phả chi họ Nguyễn",
      sourceType: "family_book",
      repositoryName: "Bản synthetic dùng cho preview",
      referenceCode: "GP-DEMO-01",
      sourceUrl: null,
    },
    {
      id: "S002",
      title: "Ghi chép khẩu thuật của gia đình",
      sourceType: "oral_history",
      repositoryName: "Phỏng vấn synthetic",
      referenceCode: "OH-DEMO-02",
      sourceUrl: null,
    },
  ],
  citations: [
    {
      id: "C001",
      sourceId: "S001",
      personId: "P001",
      relationshipId: null,
      claimKind: "birth",
      claimText: "Gia phả ghi ông sinh khoảng năm 1902.",
      citationLocator: "tr. 4",
      note: "Năm được ghi theo bản chép lại, chưa đối chiếu hộ tịch.",
      certainty: "probable",
      dateText: "khoảng 1902",
      dateQualifier: "about",
    },
    {
      id: "C002",
      sourceId: "S002",
      personId: "P001",
      relationshipId: null,
      claimKind: "birth",
      claimText: "Khẩu thuật gia đình nhớ năm sinh có thể là 1904.",
      citationLocator: "đoạn 12:30",
      note: "Cố ý mâu thuẫn với C001 để minh họa conflicting claims.",
      certainty: "possible",
      dateText: "1904",
      dateQualifier: "about",
    },
    {
      id: "C003",
      sourceId: "S001",
      personId: null,
      relationshipId: "R002",
      claimKind: "relationship",
      claimText: "Nguồn ghi Nguyễn Văn Tổ là cha của Nguyễn Văn Bình.",
      citationLocator: "tr. 8",
      note: null,
      certainty: "certain",
      dateText: null,
      dateQualifier: null,
    },
    {
      id: "C004",
      sourceId: "S002",
      personId: "P007",
      relationshipId: null,
      claimKind: "identity",
      claimText: "Hồ sơ duplicate synthetic cần review trước khi merge.",
      citationLocator: "demo duplicate",
      note: "Citation này sẽ migrate sang target khi merge.",
      certainty: "possible",
      dateText: null,
      dateQualifier: null,
    },
    {
      id: "C005",
      sourceId: "S001",
      personId: null,
      relationshipId: "R008",
      claimKind: "relationship",
      claimText: "Citation synthetic trên cạnh duplicate partnership.",
      citationLocator: "demo edge",
      note: "Citation sẽ chuyển sang R007 khi deduplicate.",
      certainty: "probable",
      dateText: null,
      dateQualifier: null,
    },
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
let selectedProvenanceTarget = null;
let editingSourceId = null;
let editingCitationId = null;
let duplicatePair = null;
let duplicatePreview = null;
let dragContext = null;

const canvas = document.querySelector("#canvas");
const nodesLayer = document.querySelector("#nodes");
const edgesSvg = document.querySelector("#edges");
const saveStatus = document.querySelector("#saveStatus");
const emptySearch = document.querySelector("#emptySearch");
const filterStatus = document.querySelector("#filterStatus");

const SOURCE_TYPE_LABELS = {
  family_book: "Gia phả / tộc phả",
  civil_record: "Hộ tịch",
  archive: "Lưu trữ",
  oral_history: "Khẩu thuật",
  photo: "Ảnh / hiện vật",
  publication: "Ấn phẩm",
  web: "Nguồn web",
  other: "Khác",
};

const CLAIM_KIND_LABELS = {
  identity: "Nhân thân",
  birth: "Sinh",
  death: "Mất",
  relationship: "Quan hệ",
  residence: "Cư trú",
  occupation: "Nghề nghiệp",
  note: "Ghi chú",
  other: "Khác",
};

const CERTAINTY_LABELS = {
  certain: "Chắc chắn",
  probable: "Có khả năng cao",
  possible: "Có thể",
  unknown: "Chưa rõ",
};

const DATE_QUALIFIER_LABELS = {
  exact: "Chính xác",
  about: "Khoảng",
  before: "Trước",
  after: "Sau",
  range: "Khoảng thời gian",
  unknown: "Không rõ",
};

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

function nextProvenanceId(items, prefix) {
  const max = items.reduce(
    (value, item) => Math.max(value, Number(item.id.slice(1)) || 0),
    0,
  );
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
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
    selectedProvenanceTarget = { kind: "person", id: person.id };
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

    const provenanceButton = item.querySelector(".relation-provenance");
    provenanceButton.addEventListener("click", () =>
      selectRelationshipProvenance(relation.id),
    );

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

function getProvenanceTarget() {
  if (selectedProvenanceTarget) return selectedProvenanceTarget;
  if (!selectedId) return null;
  return { kind: "person", id: selectedId };
}

function getTargetCitations(target) {
  if (!target) return [];
  return state.citations.filter((citation) =>
    target.kind === "person"
      ? citation.personId === target.id
      : citation.relationshipId === target.id,
  );
}

function getPersonTargetLabel(personId) {
  const person = getPerson(personId);
  return person ? person.name : "Người không khả dụng";
}

function getRelationshipTargetLabel(relationshipId) {
  const relation = state.relationships.find(
    (item) => item.id === relationshipId,
  );
  if (!relation) return "Quan hệ không khả dụng";

  const sourcePerson = getPerson(relation.source);
  const targetPerson = getPerson(relation.target);
  const sourceName = sourcePerson ? sourcePerson.name : "?";
  const targetName = targetPerson ? targetPerson.name : "?";
  return `${sourceName} ↔ ${targetName}`;
}

function getTargetLabel(target) {
  if (!target) return "Chưa chọn mục";
  return target.kind === "person"
    ? getPersonTargetLabel(target.id)
    : getRelationshipTargetLabel(target.id);
}

function createProvenanceBadge(text) {
  const badge = document.createElement("span");
  badge.className = "provenance-badge";
  badge.textContent = text;
  return badge;
}

function renderSourceCards(sourceIds) {
  const list = document.querySelector("#provenanceSources");
  list.replaceChildren();

  const sources = state.sources.filter((source) => sourceIds.has(source.id));
  if (!sources.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Chưa có nguồn được dùng cho mục này.";
    list.appendChild(empty);
    return;
  }

  sources.forEach((source) => {
    const card = document.createElement("div");
    card.className = "provenance-card";
    const title = document.createElement("strong");
    title.textContent = source.title;
    const meta = document.createElement("p");
    meta.className = "muted";
    meta.textContent = [
      SOURCE_TYPE_LABELS[source.sourceType],
      source.repositoryName,
      source.referenceCode,
    ]
      .filter(Boolean)
      .join(" · ");
    const edit = document.createElement("button");
    edit.className = "link-button";
    edit.type = "button";
    edit.textContent = "Sửa nguồn";
    edit.addEventListener("click", () => openSourceDialog(source.id));
    card.append(title, meta, edit);
    list.appendChild(card);
  });
}

function renderCitationCards(citations) {
  const list = document.querySelector("#provenanceCitations");
  list.replaceChildren();

  if (!citations.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Chưa có citation cho mục đang chọn.";
    list.appendChild(empty);
    return;
  }

  citations.forEach((citation) => {
    const source = state.sources.find((item) => item.id === citation.sourceId);
    const card = document.createElement("article");
    card.className = "provenance-card";

    const badges = document.createElement("div");
    badges.className = "provenance-badges";
    badges.append(
      createProvenanceBadge(CLAIM_KIND_LABELS[citation.claimKind]),
      createProvenanceBadge(CERTAINTY_LABELS[citation.certainty]),
    );

    const claim = document.createElement("p");
    claim.className = "provenance-claim";
    claim.textContent = citation.claimText;

    const meta = document.createElement("p");
    meta.className = "muted";
    const dateText =
      citation.dateText && citation.dateQualifier
        ? `${DATE_QUALIFIER_LABELS[citation.dateQualifier]}: ${citation.dateText}`
        : null;
    meta.textContent = [
      source?.title ?? "Nguồn không khả dụng",
      citation.citationLocator,
      dateText,
    ]
      .filter(Boolean)
      .join(" · ");

    card.append(badges, claim, meta);

    if (citation.note) {
      const note = document.createElement("p");
      note.className = "provenance-note";
      note.textContent = `Ghi chú: ${citation.note}`;
      card.appendChild(note);
    }

    const actions = document.createElement("div");
    actions.className = "provenance-actions";
    const edit = document.createElement("button");
    edit.className = "link-button";
    edit.type = "button";
    edit.textContent = "Sửa citation";
    edit.addEventListener("click", () => openCitationDialog(citation.id));
    const remove = document.createElement("button");
    remove.className = "link-danger";
    remove.type = "button";
    remove.textContent = "Xóa citation";
    remove.addEventListener("click", () => removeCitation(citation.id));
    actions.append(edit, remove);
    card.appendChild(actions);

    list.appendChild(card);
  });
}

function renderProvenance() {
  const section = document.querySelector("#provenanceSection");
  const target = getProvenanceTarget();
  section.hidden = !selectedId;

  if (!selectedId) return;

  document.querySelector("#provenanceTarget").textContent =
    getTargetLabel(target);
  const citations = getTargetCitations(target);
  renderCitationCards(citations);
  renderSourceCards(new Set(citations.map((citation) => citation.sourceId)));
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

function renderPrimarySelectionControls(
  selectedPerson,
  selectedArchived,
  mutableSelection,
) {
  const hasSelection = Boolean(selectedPerson);
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
}

function renderLayoutSelectionControls(selectedPerson, mutableSelection) {
  const selectedLocked = selectedPerson
    ? lockedPersonIds.has(selectedPerson.id)
    : false;

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
}

function renderSelectionControls(selectedPerson) {
  const selectedArchived = Boolean(selectedPerson?.archived);
  const mutableSelection = Boolean(selectedPerson) && !selectedArchived;

  renderPrimarySelectionControls(
    selectedPerson,
    selectedArchived,
    mutableSelection,
  );
  renderLayoutSelectionControls(selectedPerson, mutableSelection);

  return selectedArchived;
}

function render() {
  renderEdges();
  renderNodes();
  renderInspector();
  renderProvenance();

  const selectedPerson = getPerson(selectedId);
  const selectedArchived = renderSelectionControls(selectedPerson);
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
        [person.id, { x: dragContext.personX, y: dragContext.personY }],
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

function getRelationshipRemovalBlockReason(relation) {
  const hasCitations = state.citations.some(
    (citation) => citation.relationshipId === relation.id,
  );
  if (hasCitations) {
    return "Quan hệ này đang có citation. Hãy xóa/review citation trước để không làm mất provenance.";
  }

  const source = getPerson(relation.source);
  const target = getPerson(relation.target);
  const sourceArchived = source ? source.archived : false;
  const targetArchived = target ? target.archived : false;
  if (sourceArchived || targetArchived) {
    return "Hãy khôi phục hồ sơ đã lưu trữ trước khi sửa quan hệ này.";
  }

  return null;
}

function removeRelationship(id) {
  const relation = state.relationships.find((item) => item.id === id);
  if (!relation) return;

  const blockReason = getRelationshipRemovalBlockReason(relation);
  if (blockReason) {
    window.alert(blockReason);
    return;
  }

  const confirmed = window.confirm(
    "Xóa quan hệ này? Hai người sẽ không bị xóa.",
  );
  if (!confirmed) return;

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
  selectedProvenanceTarget = { kind: "person", id: person.id };
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
  selectedProvenanceTarget = { kind: "person", id: person.id };
  focusedId = person.id;

  document.querySelector("#searchInput").value = "";
  document.querySelector("#lifeFilter").value = "all";
  document.querySelector("#visibilityFilter").value = "all";
  document.querySelector("#archiveFilter").value = archiveFilter;
  render();
}

function selectRelationshipProvenance(relationshipId) {
  const relation = state.relationships.find(
    (item) => item.id === relationshipId,
  );
  if (!relation) return;
  selectedProvenanceTarget = { kind: "relationship", id: relationshipId };
  renderProvenance();
}

function nullableFieldValue(selector) {
  const value = document.querySelector(selector).value.trim();
  return value.length > 0 ? value : null;
}

function getSourceDialogValues(source) {
  if (source) {
    return {
      title: source.title,
      sourceType: source.sourceType,
      repositoryName: source.repositoryName || "",
      referenceCode: source.referenceCode || "",
      sourceUrl: source.sourceUrl || "",
      heading: "Sửa nguồn tư liệu",
    };
  }

  return {
    title: "",
    sourceType: "family_book",
    repositoryName: "",
    referenceCode: "",
    sourceUrl: "",
    heading: "Thêm nguồn tư liệu",
  };
}

function openSourceDialog(sourceId = null) {
  editingSourceId = sourceId;
  const source = state.sources.find((item) => item.id === sourceId) || null;
  const values = getSourceDialogValues(source);

  document.querySelector("#sourceDialogTitle").textContent = values.heading;
  document.querySelector("#sourceTitle").value = values.title;
  document.querySelector("#sourceType").value = values.sourceType;
  document.querySelector("#sourceRepository").value = values.repositoryName;
  document.querySelector("#sourceReference").value = values.referenceCode;
  document.querySelector("#sourceUrl").value = values.sourceUrl;
  document.querySelector("#sourceDialog").showModal();
}

function saveSourceFromDialog() {
  const title = document.querySelector("#sourceTitle").value.trim();
  const sourceUrl = nullableFieldValue("#sourceUrl");
  if (!title) return false;
  if (sourceUrl && !/^https?:\/\//iu.test(sourceUrl)) {
    window.alert("URL nguồn phải bắt đầu bằng http:// hoặc https://.");
    return false;
  }

  const draft = {
    title,
    sourceType: document.querySelector("#sourceType").value,
    repositoryName: nullableFieldValue("#sourceRepository"),
    referenceCode: nullableFieldValue("#sourceReference"),
    sourceUrl,
  };

  checkpoint();
  const source = state.sources.find((item) => item.id === editingSourceId);
  if (source) {
    Object.assign(source, draft);
  } else {
    state.sources.push({
      id: nextProvenanceId(state.sources, "S"),
      ...draft,
    });
  }

  editingSourceId = null;
  persistState("Đã lưu nguồn tư liệu demo");
  renderProvenance();
  return true;
}

function populateCitationSourceOptions(selectedSourceId = null) {
  const select = document.querySelector("#citationSource");
  select.replaceChildren();
  state.sources.forEach((source) => {
    const option = document.createElement("option");
    option.value = source.id;
    option.textContent = source.title;
    option.selected = source.id === selectedSourceId;
    select.appendChild(option);
  });
}

function getCitationDialogValues(citation) {
  if (citation) {
    return {
      sourceId: citation.sourceId,
      claimKind: citation.claimKind,
      claimText: citation.claimText,
      citationLocator: citation.citationLocator || "",
      certainty: citation.certainty,
      dateQualifier: citation.dateQualifier || "",
      dateText: citation.dateText || "",
      note: citation.note || "",
      heading: "Sửa citation",
    };
  }

  const firstSource = state.sources[0];
  return {
    sourceId: firstSource ? firstSource.id : "",
    claimKind: "note",
    claimText: "",
    citationLocator: "",
    certainty: "unknown",
    dateQualifier: "",
    dateText: "",
    note: "",
    heading: "Thêm citation",
  };
}

function openCitationDialog(citationId = null) {
  const target = getProvenanceTarget();
  if (!target) return;
  if (!state.sources.length) {
    window.alert("Hãy tạo ít nhất một nguồn tư liệu trước.");
    return;
  }

  editingCitationId = citationId;
  const citation =
    state.citations.find((item) => item.id === citationId) || null;
  const values = getCitationDialogValues(citation);

  document.querySelector("#citationDialogTitle").textContent = values.heading;
  document.querySelector("#citationTarget").textContent =
    getTargetLabel(target);
  populateCitationSourceOptions(values.sourceId);
  document.querySelector("#citationKind").value = values.claimKind;
  document.querySelector("#citationClaim").value = values.claimText;
  document.querySelector("#citationLocator").value = values.citationLocator;
  document.querySelector("#citationCertainty").value = values.certainty;
  document.querySelector("#citationDateQualifier").value = values.dateQualifier;
  document.querySelector("#citationDateText").value = values.dateText;
  document.querySelector("#citationNote").value = values.note;
  document.querySelector("#citationDialog").showModal();
}

function buildCitationDraft() {
  const target = getProvenanceTarget();
  if (!target) return null;

  const dateText = nullableFieldValue("#citationDateText");
  const dateQualifier =
    document.querySelector("#citationDateQualifier").value || null;
  if (Boolean(dateText) !== Boolean(dateQualifier)) {
    window.alert(
      "Biểu thức ngày và mức độ chính xác của ngày phải đi cùng nhau.",
    );
    return null;
  }

  const claimText = document.querySelector("#citationClaim").value.trim();
  if (!claimText) return null;

  return {
    sourceId: document.querySelector("#citationSource").value,
    personId: target.kind === "person" ? target.id : null,
    relationshipId: target.kind === "relationship" ? target.id : null,
    claimKind: document.querySelector("#citationKind").value,
    claimText,
    citationLocator: nullableFieldValue("#citationLocator"),
    note: nullableFieldValue("#citationNote"),
    certainty: document.querySelector("#citationCertainty").value,
    dateText,
    dateQualifier,
  };
}

function saveCitationFromDialog() {
  const draft = buildCitationDraft();
  if (!draft) return false;

  checkpoint();
  const citation = state.citations.find(
    (item) => item.id === editingCitationId,
  );
  if (citation) {
    Object.assign(citation, draft);
  } else {
    state.citations.push({
      id: nextProvenanceId(state.citations, "C"),
      ...draft,
    });
  }

  editingCitationId = null;
  persistState("Đã lưu citation demo");
  renderProvenance();
  return true;
}

function removeCitation(citationId) {
  if (!window.confirm("Xóa citation này? Nguồn tư liệu sẽ được giữ lại.")) {
    return;
  }

  checkpoint();
  state.citations = state.citations.filter((item) => item.id !== citationId);
  persistState("Đã xóa citation demo");
  renderProvenance();
}

function normalizeDuplicateName(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi-VN")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function isActiveDuplicatePerson(person) {
  return !person.archived && !person.mergedInto;
}

function hasStrongDuplicateDateSignal(first, second) {
  const birthMatches =
    first.birth !== null && second.birth !== null && first.birth === second.birth;
  const deathMatches =
    first.death !== null && second.death !== null && first.death === second.death;
  return birthMatches || deathMatches;
}

function isDuplicateCandidatePair(first, second) {
  if (!isActiveDuplicatePerson(first) || !isActiveDuplicatePerson(second)) {
    return false;
  }
  const firstName = normalizeDuplicateName(first.name);
  const secondName = normalizeDuplicateName(second.name);
  return (
    firstName.length > 0 &&
    firstName === secondName &&
    hasStrongDuplicateDateSignal(first, second)
  );
}

function duplicateReasons(first, second) {
  const reasons = ["tên chuẩn hóa trùng"];
  if (first.birth !== null && first.birth === second.birth) {
    reasons.push(`năm sinh trùng ${first.birth}`);
  }
  if (first.death !== null && first.death === second.death) {
    reasons.push(`năm mất trùng ${first.death}`);
  }
  return reasons;
}

function findDuplicateCandidates() {
  const candidates = [];

  state.people.forEach((first, firstIndex) => {
    state.people.slice(firstIndex + 1).forEach((second) => {
      if (!isDuplicateCandidatePair(first, second)) return;
      candidates.push({
        firstPersonId: first.id,
        secondPersonId: second.id,
        reasons: duplicateReasons(first, second),
      });
    });
  });

  return candidates;
}

function canonicalDuplicateEndpoints(kind, source, target) {
  if (kind === "partnership" && source.localeCompare(target) > 0) {
    return [target, source];
  }
  return [source, target];
}

function duplicateRelationshipKey(kind, source, target) {
  const endpoints = canonicalDuplicateEndpoints(kind, source, target);
  return `${kind}:${endpoints[0]}:${endpoints[1]}`;
}

function remapDuplicateRelationship(relation, targetPersonId, sourcePersonId) {
  const remappedSource =
    relation.source === sourcePersonId ? targetPersonId : relation.source;
  const remappedTarget =
    relation.target === sourcePersonId ? targetPersonId : relation.target;
  const endpoints = canonicalDuplicateEndpoints(
    relation.kind,
    remappedSource,
    remappedTarget,
  );
  return { source: endpoints[0], target: endpoints[1] };
}

function indexNonSourceRelationships(sourcePersonId) {
  const index = new Map();

  state.relationships.forEach((relation) => {
    if (relation.source === sourcePersonId || relation.target === sourcePersonId) {
      return;
    }
    index.set(
      duplicateRelationshipKey(relation.kind, relation.source, relation.target),
      relation.id,
    );
  });

  return index;
}

function buildDuplicateRelationshipChange(
  relation,
  targetPersonId,
  sourcePersonId,
  existingByKey,
) {
  const remapped = remapDuplicateRelationship(
    relation,
    targetPersonId,
    sourcePersonId,
  );
  if (remapped.source === remapped.target) {
    return {
      blocker: `Quan hệ ${relation.id} sẽ trở thành self-link sau merge.`,
      change: null,
    };
  }

  const key = duplicateRelationshipKey(
    relation.kind,
    remapped.source,
    remapped.target,
  );
  const existingRelationshipId = existingByKey.get(key) || null;
  const change = {
    relationshipId: relation.id,
    kind: relation.kind,
    fromSource: relation.source,
    fromTarget: relation.target,
    toSource: remapped.source,
    toTarget: remapped.target,
    action: existingRelationshipId ? "deduplicate" : "migrate",
    existingRelationshipId,
  };

  if (!existingRelationshipId) existingByKey.set(key, relation.id);
  return { blocker: null, change };
}

function buildDuplicateRelationshipChanges(targetPersonId, sourcePersonId) {
  const existingByKey = indexNonSourceRelationships(sourcePersonId);
  const sourceRelations = state.relationships.filter(
    (relation) =>
      relation.source === sourcePersonId || relation.target === sourcePersonId,
  );
  const changes = [];
  const blockers = [];

  sourceRelations.forEach((relation) => {
    const result = buildDuplicateRelationshipChange(
      relation,
      targetPersonId,
      sourcePersonId,
      existingByKey,
    );
    if (result.blocker) blockers.push(result.blocker);
    if (result.change) changes.push(result.change);
  });

  return { changes, blockers };
}

function effectiveRelationshipsAfterDuplicateMerge(sourcePersonId, changes) {
  const effective = state.relationships
    .filter(
      (relation) =>
        relation.source !== sourcePersonId && relation.target !== sourcePersonId,
    )
    .map((relation) => ({ ...relation }));

  changes.forEach((change) => {
    if (change.action !== "migrate") return;
    effective.push({
      id: change.relationshipId,
      kind: change.kind,
      source: change.toSource,
      target: change.toTarget,
    });
  });

  return effective;
}

function addParentChildGraphEdge(childrenByParent, indegree, relation) {
  const children = childrenByParent.get(relation.source) || [];
  children.push(relation.target);
  childrenByParent.set(relation.source, children);
  indegree.set(relation.target, (indegree.get(relation.target) || 0) + 1);
  if (!indegree.has(relation.source)) indegree.set(relation.source, 0);
}

function hasDuplicateParentChildCycle(relationships) {
  const childrenByParent = new Map();
  const indegree = new Map();

  relationships.forEach((relation) => {
    if (relation.kind !== "parent_child") return;
    addParentChildGraphEdge(childrenByParent, indegree, relation);
  });

  const queue = [...indegree.entries()]
    .filter((entry) => entry[1] === 0)
    .map((entry) => entry[0]);
  let visited = 0;

  while (queue.length) {
    const personId = queue.shift();
    if (!personId) continue;
    visited += 1;
    const children = childrenByParent.get(personId) || [];
    children.forEach((childId) => {
      const nextDegree = (indegree.get(childId) || 0) - 1;
      indegree.set(childId, nextDegree);
      if (nextDegree === 0) queue.push(childId);
    });
  }

  return visited !== indegree.size;
}

function buildDuplicateMergePreview(targetPersonId, sourcePersonId) {
  const relationshipResult = buildDuplicateRelationshipChanges(
    targetPersonId,
    sourcePersonId,
  );
  const effective = effectiveRelationshipsAfterDuplicateMerge(
    sourcePersonId,
    relationshipResult.changes,
  );
  const blockers = [...relationshipResult.blockers];

  if (hasDuplicateParentChildCycle(effective)) {
    blockers.push("Merge sẽ tạo vòng lặp tổ tiên trong quan hệ cha/mẹ – con.");
  }

  return {
    changes: relationshipResult.changes,
    blockers,
    personCitationCount: state.citations.filter(
      (citation) => citation.personId === sourcePersonId,
    ).length,
    relationshipCitationCount: state.citations.filter((citation) =>
      relationshipResult.changes.some(
        (change) => change.relationshipId === citation.relationshipId,
      ),
    ).length,
  };
}

function setDuplicateReviewVisibility(visible) {
  document.querySelector("#duplicateReview").hidden = !visible;
}

function renderDuplicateCandidateButton(candidate) {
  const first = getPerson(candidate.firstPersonId);
  const second = getPerson(candidate.secondPersonId);
  if (!first || !second) return null;

  const item = document.createElement("button");
  item.type = "button";
  item.className = "duplicate-candidate";
  item.innerHTML = `
    <strong>${first.name} ↔ ${second.name}</strong>
    <span>${formatYears(first)} · ${formatYears(second)}</span>
    <small>${candidate.reasons.join(" · ")}</small>
  `;
  item.addEventListener("click", () =>
    openDuplicatePair(candidate.firstPersonId, candidate.secondPersonId),
  );
  return item;
}

function renderDuplicateCandidates() {
  const list = document.querySelector("#duplicateCandidateList");
  list.replaceChildren();
  const candidates = findDuplicateCandidates();

  if (!candidates.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent =
      "Không có candidate nào vượt ngưỡng bảo thủ. Không có auto-merge.";
    list.appendChild(empty);
    return;
  }

  candidates.forEach((candidate) => {
    const button = renderDuplicateCandidateButton(candidate);
    if (button) list.appendChild(button);
  });
}

function renderDuplicateImpact(preview) {
  const list = document.querySelector("#duplicateImpactList");
  list.replaceChildren();

  preview.changes.forEach((change) => {
    const item = document.createElement("li");
    const action =
      change.action === "deduplicate" ? "Gộp cạnh trùng" : "Di chuyển cạnh";
    item.textContent =
      `${action}: ${change.relationshipId} · ${change.fromSource} → ` +
      `${change.fromTarget} thành ${change.toSource} → ${change.toTarget}`;
    list.appendChild(item);
  });

  if (!preview.changes.length) {
    const item = document.createElement("li");
    item.textContent = "Source không có relationship cần migrate.";
    list.appendChild(item);
  }
}

function renderDuplicateBlockers(preview) {
  const block = document.querySelector("#duplicateBlockers");
  if (!preview.blockers.length) {
    block.textContent =
      "Preview không phát hiện blocker. Vẫn cần xác nhận thủ công.";
    block.classList.remove("danger");
    return;
  }

  block.textContent = preview.blockers.join(" · ");
  block.classList.add("danger");
}

function updateDuplicateExecuteState() {
  const confirmation = document.querySelector("#duplicateConfirmation").value;
  const blocked = duplicatePreview && duplicatePreview.blockers.length > 0;
  document.querySelector("#executeDuplicateMerge").disabled =
    !duplicatePreview || blocked || confirmation !== "MERGE";
}

function renderDuplicatePair() {
  if (!duplicatePair) return;
  const target = getPerson(duplicatePair.targetPersonId);
  const source = getPerson(duplicatePair.sourcePersonId);
  if (!target || !source) return;

  duplicatePreview = buildDuplicateMergePreview(target.id, source.id);
  document.querySelector("#duplicateTarget").textContent =
    `${target.name} · ${formatYears(target)} · giữ canonical`;
  document.querySelector("#duplicateSource").textContent =
    `${source.name} · ${formatYears(source)} · sẽ lưu trữ`;
  document.querySelector("#duplicateCitationImpact").textContent =
    `${duplicatePreview.personCitationCount} citation người · ` +
    `${duplicatePreview.relationshipCitationCount} citation quan hệ`;
  document.querySelector("#duplicateConfirmation").value = "";
  renderDuplicateImpact(duplicatePreview);
  renderDuplicateBlockers(duplicatePreview);
  updateDuplicateExecuteState();
  setDuplicateReviewVisibility(true);
}

function openDuplicatePair(targetPersonId, sourcePersonId) {
  duplicatePair = { targetPersonId, sourcePersonId };
  renderDuplicatePair();
}

function swapDuplicatePair() {
  if (!duplicatePair) return;
  duplicatePair = {
    targetPersonId: duplicatePair.sourcePersonId,
    sourcePersonId: duplicatePair.targetPersonId,
  };
  renderDuplicatePair();
}

function openDuplicateDialog() {
  duplicatePair = null;
  duplicatePreview = null;
  renderDuplicateCandidates();
  setDuplicateReviewVisibility(false);
  document.querySelector("#duplicateDialog").showModal();
}

function migrateDuplicateRelationshipCitation(change) {
  if (change.action !== "deduplicate" || !change.existingRelationshipId) return;
  state.citations.forEach((citation) => {
    if (citation.relationshipId === change.relationshipId) {
      citation.relationshipId = change.existingRelationshipId;
    }
  });
}

function applyDuplicateRelationshipChange(change) {
  if (change.action === "deduplicate") {
    migrateDuplicateRelationshipCitation(change);
    state.relationships = state.relationships.filter(
      (relation) => relation.id !== change.relationshipId,
    );
    return;
  }

  const relation = state.relationships.find(
    (item) => item.id === change.relationshipId,
  );
  if (!relation) return;
  relation.source = change.toSource;
  relation.target = change.toTarget;
}

function executeDuplicateMerge() {
  if (!duplicatePair || !duplicatePreview) return;
  if (duplicatePreview.blockers.length) return;
  if (document.querySelector("#duplicateConfirmation").value !== "MERGE") return;
  if (!window.confirm("Thực thi merge synthetic này?")) return;

  checkpoint();
  duplicatePreview.changes.forEach(applyDuplicateRelationshipChange);
  state.citations.forEach((citation) => {
    if (citation.personId === duplicatePair.sourcePersonId) {
      citation.personId = duplicatePair.targetPersonId;
    }
  });

  const source = getPerson(duplicatePair.sourcePersonId);
  if (source) {
    source.archived = true;
    source.mergedInto = duplicatePair.targetPersonId;
  }

  persistState("Đã merge duplicate synthetic");
  selectedId = duplicatePair.targetPersonId;
  duplicatePair = null;
  duplicatePreview = null;
  render();
  renderDuplicateCandidates();
  setDuplicateReviewVisibility(false);
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

  const index = state.people.findIndex(
    (candidate) => candidate.id === person.id,
  );
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
    applyLayoutPositions(new Map(entry.after), "Đã làm lại vị trí demo", false)
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
document
  .querySelector("#layoutLock")
  .addEventListener("click", toggleLayoutLock);
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
document
  .querySelector("#addSource")
  .addEventListener("click", () => openSourceDialog());
document
  .querySelector("#addCitation")
  .addEventListener("click", () => openCitationDialog());
document
  .querySelector("#reviewDuplicates")
  .addEventListener("click", openDuplicateDialog);
document
  .querySelector("#swapDuplicatePair")
  .addEventListener("click", swapDuplicatePair);
document
  .querySelector("#executeDuplicateMerge")
  .addEventListener("click", executeDuplicateMerge);
document
  .querySelector("#duplicateConfirmation")
  .addEventListener("input", updateDuplicateExecuteState);
document.querySelector("#sourceForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  if (!saveSourceFromDialog()) event.preventDefault();
});
document.querySelector("#citationForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  if (!saveCitationFromDialog()) event.preventDefault();
});
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
  selectedProvenanceTarget = null;
  editingSourceId = null;
  editingCitationId = null;
  duplicatePair = null;
  duplicatePreview = null;
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
