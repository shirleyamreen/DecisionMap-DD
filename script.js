// === Local storage helpers ===

const STORAGE_KEY_META = "ddfd_flowcharts"; // list of {id, name, updatedAt}
const STORAGE_PREFIX_MODEL = "ddfd_flow_";

function loadFlowMeta() {
const raw = localStorage.getItem(STORAGE_KEY_META);
if (!raw) return [];
try {
return JSON.parse(raw);
} catch (e) {
console.error("Error parsing flow meta", e);
return [];
}
}

function saveFlowMeta(list) {
localStorage.setItem(STORAGE_KEY_META, JSON.stringify(list));
}

function getFlowModelKey(id) {
return STORAGE_PREFIX_MODEL + id;
}

function saveFlowModel(id, modelJson) {
localStorage.setItem(getFlowModelKey(id), modelJson);
}

function loadFlowModel(id) {
return localStorage.getItem(getFlowModelKey(id));
}

// === Helper: format date ===

function formatDate(dtString) {
const date = new Date(dtString);
if (isNaN(date)) return "";
return date.toLocaleString(undefined, {
dateStyle: "medium",
timeStyle: "short",
});
}

// === Dashboard ===

function initDashboard() {
const newBtn = document.getElementById("newFlowBtn");
const listDiv = document.getElementById("flowList");

function renderList() {
const flows = loadFlowMeta().sort(
(a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
);

listDiv.innerHTML = "";

if (flows.length === 0) {
const empty = document.createElement("div");
empty.className = "flow-empty";
empty.textContent =
"No flowcharts yet. Click “New Flowchart” to create your first one.";
listDiv.appendChild(empty);
return;
}

flows.forEach((f) => {
const row = document.createElement("div");
row.className = "flow-row";

const left = document.createElement("div");
left.className = "flow-row-left";

const nameSpan = document.createElement("span");
nameSpan.className = "flow-name";
nameSpan.textContent = f.name || "Untitled flowchart";

const metaSpan = document.createElement("span");
metaSpan.className = "flow-meta";
metaSpan.textContent =
"Last updated: " + (f.updatedAt ? formatDate(f.updatedAt) : "—");

left.appendChild(nameSpan);
left.appendChild(metaSpan);

const actions = document.createElement("div");
actions.className = "flow-actions";

const openBtn = document.createElement("button");
openBtn.className = "secondary-btn";
openBtn.textContent = "Open";
openBtn.onclick = () => {
window.location.href = "editor.html?id=" + encodeURIComponent(f.id);
};

const shareBtn = document.createElement("button");
shareBtn.className = "secondary-btn";
shareBtn.textContent = "Open Shared View";
shareBtn.onclick = () => {
const url = getBaseUrl() + "shared.html?id=" + encodeURIComponent(f.id);
navigator.clipboard
.writeText(url)
.then(() => {
alert(
"Shared view link copied to clipboard:\n\n" +
url +
"\n\n(Note: In this demo, it only works on the same device/browser.)"
);
})
.catch(() => {
alert(
"Shared view link:\n\n" +
url +
"\n\nCopy and share this link. (Demo works on same device/browser.)"
);
});
};

actions.appendChild(openBtn);
actions.appendChild(shareBtn);

row.appendChild(left);
row.appendChild(actions);
listDiv.appendChild(row);
});
}

newBtn.addEventListener("click", () => {
let name = prompt("Enter a name for your new flowchart:", "New Flowchart");
if (name === null) return;
name = name.trim();
if (!name) name = "Untitled flowchart";

const id = "flow_" + Date.now();
const now = new Date().toISOString();

const list = loadFlowMeta();
list.push({ id, name, updatedAt: now });
saveFlowMeta(list);

window.location.href = "editor.html?id=" + encodeURIComponent(id);
});

renderList();
}

// Get base URL for shared link (works on GitHub Pages too)
function getBaseUrl() {
let url = window.location.href;
// Remove after last slash
url = url.substring(0, url.lastIndexOf("/") + 1);
return url;
}

// === GoJS Editor ===

let myDiagram;
let myPalette;
let currentFlowId;
let currentFlowName;

function initEditor(flowId) {
currentFlowId = flowId;

// Load meta
const metaList = loadFlowMeta();
const meta = metaList.find((m) => m.id === flowId);
currentFlowName = meta ? meta.name : "Untitled flowchart";

const titleEl = document.getElementById("flowTitle");
if (titleEl) titleEl.textContent = currentFlowName;

const $ = go.GraphObject.make;

myDiagram = $(go.Diagram, "myDiagramDiv", {
initialContentAlignment: go.Spot.Center,
"undoManager.isEnabled": true,
});

// Node template
myDiagram.nodeTemplate = $(
go.Node,
"Auto",
{ locationSpot: go.Spot.Center },
new go.Binding("location", "loc", go.Point.parse).makeTwoWay(
go.Point.stringify
),
$(
go.Shape,
"RoundedRectangle",
{
strokeWidth: 1.5,
fill: "white",
stroke: "#0f4fbf",
portId: "",
fromLinkable: true,
toLinkable: true,
cursor: "pointer",
},
new go.Binding("fill", "color")
),
$(
go.TextBlock,
{
margin: 6,
wrap: go.TextBlock.WrapFit,
editable: true,
font: "12px Segoe UI, sans-serif",
},
new go.Binding("text").makeTwoWay()
)
);

// Link template
myDiagram.linkTemplate = $(
go.Link,
{ routing: go.Link.AvoidsNodes, curve: go.Link.JumpOver, corner: 5 },
$(go.Shape, { strokeWidth: 1.2, stroke: "#3c5ebf" }),
$(go.Shape, { toArrow: "Standard", stroke: null, fill: "#3c5ebf" }),
$(
go.TextBlock,
{
segmentOffset: new go.Point(0, -10),
editable: true,
font: "11px Segoe UI, sans-serif",
},
new go.Binding("text").makeTwoWay()
)
);

// Palette
myPalette = $(go.Palette, "myPaletteDiv", {
nodeTemplateMap: myDiagram.nodeTemplateMap,
model: new go.GraphLinksModel([
{ text: "Start / End", color: "#cbe2ff" },
{ text: "Process", color: "#d9f2ff" },
{ text: "Decision", color: "#ffe7c2" },
{ text: "Note", color: "#fffbd1" },
]),
});

// Load existing model or create default
const storedModel = loadFlowModel(flowId);
if (storedModel) {
myDiagram.model = go.Model.fromJson(storedModel);
} else {
myDiagram.model = new go.GraphLinksModel(
[
{
key: 1,
text: "Start",
color: "#cbe2ff",
loc: "0 0",
},
],
[]
);
}

// Save button
const saveBtn = document.getElementById("saveBtn");
if (saveBtn) {
saveBtn.addEventListener("click", saveCurrentDiagram);
}

// Rename button
const renameBtn = document.getElementById("renameBtn");
if (renameBtn) {
renameBtn.addEventListener("click", renameCurrentFlow);
}

// Export PNG
const exportPngBtn = document.getElementById("exportPngBtn");
if (exportPngBtn) {
exportPngBtn.addEventListener("click", () =>
exportDiagramToPNG(myDiagram, currentFlowName || "Flowchart")
);
}

// Export PDF
const exportPdfBtn = document.getElementById("exportPdfBtn");
if (exportPdfBtn) {
exportPdfBtn.addEventListener("click", () =>
exportDiagramToPDF(myDiagram, currentFlowName || "Flowchart")
);
}
}

function saveCurrentDiagram() {
if (!myDiagram || !currentFlowId) return;
const json = myDiagram.model.toJson();
saveFlowModel(currentFlowId, json);

// Update meta updatedAt
const list = loadFlowMeta();
const idx = list.findIndex((m) => m.id === currentFlowId);
if (idx !== -1) {
list[idx].updatedAt = new Date().toISOString();
if (currentFlowName) list[idx].name = currentFlowName;
saveFlowMeta(list);
}

alert("Flowchart saved successfully.");
}

function renameCurrentFlow() {
const newName = prompt("Enter new name for this flowchart:", currentFlowName);
if (newName === null) return;
const trimmed = newName.trim();
if (!trimmed) return;

currentFlowName = trimmed;
const titleEl = document.getElementById("flowTitle");
if (titleEl) titleEl.textContent = currentFlowName;

const list = loadFlowMeta();
const idx = list.findIndex((m) => m.id === currentFlowId);
if (idx !== -1) {
list[idx].name = currentFlowName;
list[idx].updatedAt = new Date().toISOString();
saveFlowMeta(list);
}
}

// === Shared (read-only) view ===

let sharedDiagram;

function initSharedView(flowId) {
const storedModel = loadFlowModel(flowId);
if (!storedModel) {
alert(
"No flowchart data found for this id on this device.\n\nIn this demo, shared view works only on the same device/browser where it was created."
);
return;
}

const metaList = loadFlowMeta();
const meta = metaList.find((m) => m.id === flowId);
const name = meta ? meta.name : "Shared Flowchart";

const titleEl = document.getElementById("sharedTitle");
if (titleEl) titleEl.textContent = name + " (Shared View)";

const $ = go.GraphObject.make;

sharedDiagram = $(go.Diagram, "sharedDiagramDiv", {
initialContentAlignment: go.Spot.Center,
isReadOnly: true,
allowCopy: false,
allowDelete: false,
allowInsert: false,
allowMove: false,
});

sharedDiagram.nodeTemplate = $(
go.Node,
"Auto",
{ locationSpot: go.Spot.Center },
new go.Binding("location", "loc", go.Point.parse),
$(
go.Shape,
"RoundedRectangle",
{
strokeWidth: 1.5,
fill: "white",
stroke: "#0f4fbf",
},
new go.Binding("fill", "color")
),
$(
go.TextBlock,
{
margin: 6,
wrap: go.TextBlock.WrapFit,
editable: false,
font: "12px Segoe UI, sans-serif",
},
new go.Binding("text")
)
);

sharedDiagram.linkTemplate = $(
go.Link,
{ routing: go.Link.AvoidsNodes, curve: go.Link.JumpOver, corner: 5 },
$(go.Shape, { strokeWidth: 1.2, stroke: "#3c5ebf" }),
$(go.Shape, { toArrow: "Standard", stroke: null, fill: "#3c5ebf" }),
$(
go.TextBlock,
{
segmentOffset: new go.Point(0, -10),
editable: false,
font: "11px Segoe UI, sans-serif",
},
new go.Binding("text")
)
);

sharedDiagram.model = go.Model.fromJson(storedModel);

const exportPngSharedBtn = document.getElementById("exportPngSharedBtn");
if (exportPngSharedBtn) {
exportPngSharedBtn.addEventListener("click", () =>
exportDiagramToPNG(sharedDiagram, name || "Shared_Flowchart")
);
}

const exportPdfSharedBtn = document.getElementById("exportPdfSharedBtn");
if (exportPdfSharedBtn) {
exportPdfSharedBtn.addEventListener("click", () =>
exportDiagramToPDF(sharedDiagram, name || "Shared_Flowchart")
);
}
}

// === Export helpers ===

function exportDiagramToPNG(diagram, baseName) {
if (!diagram) return;
const imgData = diagram.makeImageData({
scale: 1,
background: "white",
});

const a = document.createElement("a");
a.href = imgData;
a.download = (baseName || "flowchart") + ".png";
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
}

function exportDiagramToPDF(diagram, baseName) {
if (!diagram) return;
const { jsPDF } = window.jspdf || {};
if (!jsPDF) {
alert("PDF library not loaded.");
return;
}

const imgData = diagram.makeImageData({
scale: 1,
background: "white",
});

// Create landscape A4
const doc = new jsPDF({
orientation: "landscape",
unit: "pt",
format: "a4",
});

const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();

const title = "Due Diligence Flow Designer";
const chartName = baseName || "Flowchart";
const dateStr = new Date().toLocaleString();

doc.setFont("helvetica", "bold");
doc.setFontSize(16);
doc.text(title, pageWidth / 2, 40, { align: "center" });

doc.setFont("helvetica", "normal");
doc.setFontSize(11);
doc.text("Flowchart: " + chartName, 40, 65);
doc.text("Exported on: " + dateStr, 40, 80);

// Image area
const marginX = 40;
const marginYTop = 100;
const marginYBottom = 60;

const maxWidth = pageWidth - marginX * 2;
const maxHeight = pageHeight - marginYTop - marginYBottom;

// Approximate ratio
const imgWidth = maxWidth;
const imgHeight = maxHeight;

doc.addImage(
imgData,
"PNG",
marginX,
marginYTop,
imgWidth,
imgHeight,
undefined,
"FAST"
);

// Footer - Designed by Shirley Amreen
doc.setFont("helvetica", "italic");
doc.setFontSize(11);
doc.text(
"Designed by Shirley Amreen",
pageWidth / 2,
pageHeight - 30,
{ align: "center" }
);

doc.save((chartName || "flowchart") + ".pdf");
}