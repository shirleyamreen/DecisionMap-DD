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
url = url.substring(0, url.lastIndexOf("/") + 1);
return url;
}

// === GoJS Editor ===

let myDiagram;
let myPalette;
let currentFlowId;
let currentFlowName;
let selectedNode = null;

// Build font string from node data
function makeFont(data) {
const size = data.fontSize || 12;
const weight = data.isBold ? "bold" : "normal";
const style = data.isItalic ? "italic" : "normal";
return `${style} ${weight} ${size}px Segoe UI, sans-serif`;
}

// Default node size if not set
function getSizeFromData(data) {
if (data.size) {
try {
const parts = data.size.split(" ");
return {
w: parseFloat(parts[0]) || 100,
h: parseFloat(parts[1]) || 40,
};
} catch {
return { w: 100, h: 40 };
}
}
return { w: 120, h: 40 };
}

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

// Node template with bindings for color, border, size, shape, font
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
new go.Binding("fill", "color").makeTwoWay(),
new go.Binding("stroke", "borderColor").makeTwoWay(),
new go.Binding("strokeWidth", "borderWidth").makeTwoWay(),
new go.Binding("figure", "figure").makeTwoWay(),
new go.Binding(
"desiredSize",
"size",
function (s) {
if (!s) return new go.Size(120, 40);
const parts = s.split(" ");
const w = parseFloat(parts[0]) || 120;
const h = parseFloat(parts[1]) || 40;
return new go.Size(w, h);
}
).makeTwoWay(function (sz) {
return sz.width.toFixed(0) + " " + sz.height.toFixed(0);
})
),
$(
go.TextBlock,
{
margin: 6,
wrap: go.TextBlock.WrapFit,
editable: true,
font: "12px Segoe UI, sans-serif",
},
new go.Binding("text").makeTwoWay(),
new go.Binding("font", "", makeFont)
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
{ text: "Start", color: "#cbe2ff", figure: "RoundedRectangle" },
{ text: "Process", color: "#d9f2ff", figure: "RoundedRectangle" },
{ text: "Decision", color: "#ffe7c2", figure: "Diamond" },
{ text: "Note", color: "#fffbd1", figure: "Rectangle" },
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
borderColor: "#0f4fbf",
borderWidth: 1.5,
figure: "RoundedRectangle",
fontSize: 12,
isBold: false,
isItalic: false,
size: "120 40",
loc: "0 0",
},
],
[]
);
}

// Listen for selection changes to open/close properties panel
myDiagram.addDiagramListener("ChangedSelection", function () {
const node = myDiagram.selection.first();
if (node instanceof go.Node) {
selectedNode = node;
populatePropsPanel(node.data);
openPropsPanel();
} else {
selectedNode = null;
closePropsPanel();
}
});

// Wire up toolbar buttons
const saveBtn = document.getElementById("saveBtn");
if (saveBtn) saveBtn.addEventListener("click", saveCurrentDiagram);

const renameBtn = document.getElementById("renameBtn");
if (renameBtn) renameBtn.addEventListener("click", renameCurrentFlow);

const exportPngBtn = document.getElementById("exportPngBtn");
if (exportPngBtn) {
exportPngBtn.addEventListener("click", () =>
exportDiagramToPNG(myDiagram, currentFlowName || "Flowchart")
);
}

const exportPdfBtn = document.getElementById("exportPdfBtn");
if (exportPdfBtn) {
exportPdfBtn.addEventListener("click", () =>
exportDiagramToPDF(myDiagram, currentFlowName || "Flowchart")
);
}

// Properties panel events
setupPropsPanelEvents();
}

function saveCurrentDiagram() {
if (!myDiagram || !currentFlowId) return;
const json = myDiagram.model.toJson();
saveFlowModel(currentFlowId, json);

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

// === Properties panel logic ===

function openPropsPanel() {
const panel = document.getElementById("propsPanel");
if (panel) panel.classList.add("open");
}

function closePropsPanel() {
const panel = document.getElementById("propsPanel");
if (panel) panel.classList.remove("open");
}

function populatePropsPanel(data) {
const size = getSizeFromData(data);
const textInput = document.getElementById("nodeText");
const colorInput = document.getElementById("nodeColor");
const borderColorInput = document.getElementById("nodeBorderColor");
const borderWidthInput = document.getElementById("nodeBorderWidth");
const borderWidthValue = document.getElementById("nodeBorderWidthValue");
const widthInput = document.getElementById("nodeWidth");
const widthValue = document.getElementById("nodeWidthValue");
const heightInput = document.getElementById("nodeHeight");
const heightValue = document.getElementById("nodeHeightValue");
const figureSelect = document.getElementById("nodeFigure");
const boldCheck = document.getElementById("nodeBold");
const italicCheck = document.getElementById("nodeItalic");
const fontSizeInput = document.getElementById("nodeFontSize");
const fontSizeValue = document.getElementById("nodeFontSizeValue");

if (textInput) textInput.value = data.text || "";
if (colorInput) colorInput.value = data.color || "#ffffff";
if (borderColorInput) borderColorInput.value = data.borderColor || "#0f4fbf";

const bw = data.borderWidth != null ? data.borderWidth : 1.5;
if (borderWidthInput) {
borderWidthInput.value = bw;
if (borderWidthValue) borderWidthValue.textContent = bw.toString();
}

if (widthInput) {
widthInput.value = size.w;
if (widthValue) widthValue.textContent = size.w.toString();
}
if (heightInput) {
heightInput.value = size.h;
if (heightValue) heightValue.textContent = size.h.toString();
}

if (figureSelect) {
figureSelect.value = data.figure || "RoundedRectangle";
}

const fs = data.fontSize || 12;
if (fontSizeInput) {
fontSizeInput.value = fs;
if (fontSizeValue) fontSizeValue.textContent = fs.toString() + " px";
}
if (boldCheck) boldCheck.checked = !!data.isBold;
if (italicCheck) italicCheck.checked = !!data.isItalic;
}

function setupPropsPanelEvents() {
const closeBtn = document.getElementById("closePropsBtn");
if (closeBtn) {
closeBtn.addEventListener("click", () => {
closePropsPanel();
if (myDiagram) myDiagram.clearSelection();
});
}

const textInput = document.getElementById("nodeText");
if (textInput) {
textInput.addEventListener("input", (e) => {
if (!selectedNode || !myDiagram) return;
myDiagram.startTransaction("text change");
myDiagram.model.setDataProperty(
selectedNode.data,
"text",
e.target.value
);
myDiagram.commitTransaction("text change");
});
}

const colorInput = document.getElementById("nodeColor");
if (colorInput) {
colorInput.addEventListener("input", (e) => {
if (!selectedNode || !myDiagram) return;
myDiagram.startTransaction("color change");
myDiagram.model.setDataProperty(
selectedNode.data,
"color",
e.target.value
);
myDiagram.commitTransaction("color change");
});
}

const borderColorInput = document.getElementById("nodeBorderColor");
if (borderColorInput) {
borderColorInput.addEventListener("input", (e) => {
if (!selectedNode || !myDiagram) return;
myDiagram.startTransaction("border color change");
myDiagram.model.setDataProperty(
selectedNode.data,
"borderColor",
e.target.value
);
myDiagram.commitTransaction("border color change");
});
}

const borderWidthInput = document.getElementById("nodeBorderWidth");
const borderWidthValue = document.getElementById("nodeBorderWidthValue");
if (borderWidthInput) {
borderWidthInput.addEventListener("input", (e) => {
if (!selectedNode || !myDiagram) return;
const val = parseFloat(e.target.value) || 1;
if (borderWidthValue) borderWidthValue.textContent = val.toString();
myDiagram.startTransaction("border width change");
myDiagram.model.setDataProperty(selectedNode.data, "borderWidth", val);
myDiagram.commitTransaction("border width change");
});
}

const widthInput = document.getElementById("nodeWidth");
const widthValue = document.getElementById("nodeWidthValue");
const heightInput = document.getElementById("nodeHeight");
const heightValue = document.getElementById("nodeHeightValue");

function updateSize() {
if (!selectedNode || !myDiagram || !widthInput || !heightInput) return;
const w = parseFloat(widthInput.value) || 120;
const h = parseFloat(heightInput.value) || 40;
if (widthValue) widthValue.textContent = w.toString();
if (heightValue) heightValue.textContent = h.toString();
myDiagram.startTransaction("size change");
myDiagram.model.setDataProperty(
selectedNode.data,
"size",
w.toFixed(0) + " " + h.toFixed(0)
);
myDiagram.commitTransaction("size change");
}

if (widthInput) widthInput.addEventListener("input", updateSize);
if (heightInput) heightInput.addEventListener("input", updateSize);

const figureSelect = document.getElementById("nodeFigure");
if (figureSelect) {
figureSelect.addEventListener("change", (e) => {
if (!selectedNode || !myDiagram) return;
myDiagram.startTransaction("figure change");
myDiagram.model.setDataProperty(
selectedNode.data,
"figure",
e.target.value
);
myDiagram.commitTransaction("figure change");
});
}

const boldCheck = document.getElementById("nodeBold");
const italicCheck = document.getElementById("nodeItalic");
const fontSizeInput = document.getElementById("nodeFontSize");
const fontSizeValue = document.getElementById("nodeFontSizeValue");

function updateFont() {
if (!selectedNode || !myDiagram) return;
const isBold = boldCheck && boldCheck.checked;
const isItalic = italicCheck && italicCheck.checked;
const fs = fontSizeInput ? parseInt(fontSizeInput.value, 10) || 12 : 12;

if (fontSizeValue) fontSizeValue.textContent = fs.toString() + " px";

myDiagram.startTransaction("font change");
myDiagram.model.setDataProperty(selectedNode.data, "isBold", !!isBold);
myDiagram.model.setDataProperty(selectedNode.data, "isItalic", !!isItalic);
myDiagram.model.setDataProperty(selectedNode.data, "fontSize", fs);
myDiagram.commitTransaction("font change");
}

if (boldCheck) boldCheck.addEventListener("change", updateFont);
if (italicCheck) italicCheck.addEventListener("change", updateFont);
if (fontSizeInput) fontSizeInput.addEventListener("input", updateFont);
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
new go.Binding("fill", "color"),
new go.Binding("stroke", "borderColor"),
new go.Binding("strokeWidth", "borderWidth"),
new go.Binding("figure", "figure"),
new go.Binding(
"desiredSize",
"size",
function (s) {
if (!s) return new go.Size(120, 40);
const parts = s.split(" ");
const w = parseFloat(parts[0]) || 120;
const h = parseFloat(parts[1]) || 40;
return new go.Size(w, h);
}
)
),
$(
go.TextBlock,
{
margin: 6,
wrap: go.TextBlock.WrapFit,
editable: false,
font: "12px Segoe UI, sans-serif",
},
new go.Binding("text"),
new go.Binding("font", "", makeFont)
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

const marginX = 40;
const marginYTop = 100;
const marginYBottom = 60;

const maxWidth = pageWidth - marginX * 2;
const maxHeight = pageHeight - marginYTop - marginYBottom;

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