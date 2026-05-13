import {
  ROWS, COLS,
  initGridData, getGrid, getNode, getSourcePos, getDestPos,
  toggleWall, moveSource, moveDest,
  clearPath as clearPathData, clearBoard as clearBoardData,
  cloneGrid, applyWallMask,
} from './grid.js';

import { bfs, dfs, dijkstra, astar } from './algorithms.js';

import {
  animateResult, stopAnimation, isAnimating,
  setStepMode, advanceStep, getTotalSteps, getCurrentStep,
} from './animations.js';

import { generateRecursiveDivision, generateRandomWalls } from './maze.js';

const gridEl         = document.getElementById('grid');
const algoSelect     = document.getElementById('algorithm-select');
const btnVisualize   = document.getElementById('btn-visualize');
const btnStop        = document.getElementById('btn-stop');
const btnClearPath   = document.getElementById('btn-clear-path');
const btnClearBoard  = document.getElementById('btn-clear-board');
const btnMaze        = document.getElementById('btn-maze');
const mazeDropdown   = document.getElementById('maze-dropdown');
const speedSlider    = document.getElementById('speed-slider');
const statAlgo       = document.getElementById('stat-algo');
const statVisited    = document.getElementById('stat-visited');
const statPath       = document.getElementById('stat-path');
const statStatus     = document.getElementById('stat-status');
const statMode       = document.getElementById('stat-mode');
const btnStepToggle  = document.getElementById('btn-step-toggle');
const stepControls   = document.getElementById('step-controls');
const btnNextStep    = document.getElementById('btn-next-step');
const algoInfoContent= document.getElementById('algo-info-content');

// Tooltip
const tooltip = document.createElement('div');
tooltip.className = 'cell-tooltip';
document.body.appendChild(tooltip);

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────
let isMouseDown   = false;
let draggingWhat  = null; // 'source' | 'dest' | 'wall'
let wallDrawMode  = null; // true = drawing walls, false = erasing walls
let stepByStep    = false;

// Algorithm info database
const ALGO_INFO = {
  bfs: {
    name: 'Breadth First Search',
    desc: 'Explores neighbors level by level using a queue. Guarantees shortest path on unweighted graphs.',
    time: 'O(V + E)',
    space: 'O(V)',
    guarantee: true,
  },
  dfs: {
    name: 'Depth First Search',
    desc: 'Explores as deep as possible before backtracking. Fast but does NOT guarantee the shortest path.',
    time: 'O(V + E)',
    space: 'O(V)',
    guarantee: false,
  },
  dijkstra: {
    name: "Dijkstra's Algorithm",
    desc: 'Uses a priority queue to always expand the closest unvisited node. Works for weighted graphs and guarantees shortest path.',
    time: 'O((V+E) log V)',
    space: 'O(V)',
    guarantee: true,
  },
  astar: {
    name: 'A* (A-Star)',
    desc: 'Guided search: f(n) = g(n) + h(n) where h = Manhattan distance. Typically faster than Dijkstra while still guaranteeing shortest path.',
    time: 'O((V+E) log V)',
    space: 'O(V)',
    guarantee: true,
  },
};

function buildGrid() {
  initGridData();
  gridEl.innerHTML = '';
  gridEl.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
  gridEl.style.gridTemplateRows    = `repeat(${ROWS}, 1fr)`;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      applyNodeClass(cell, getNode(r, c));
      gridEl.appendChild(cell);
    }
  }
}

/** Sync a cell's CSS class to its node state */
function applyNodeClass(cell, node) {
  cell.className = 'cell';
  if (node.isSource)      cell.classList.add('source');
  else if (node.isDestination) cell.classList.add('destination');
  else if (node.isWall)   cell.classList.add('wall');
  else if (node.isPath)   cell.classList.add('path');
  else if (node.isVisited) cell.classList.add('visited');
}

function getCellEl(row, col) {
  return gridEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
}

function refreshCell(row, col) {
  const el = getCellEl(row, col);
  if (el) applyNodeClass(el, getNode(row, col));
}

/** Visually mark a cell as visited (called by animation) */
function markVisited(row, col) {
  const el = getCellEl(row, col);
  if (el) {
    el.classList.remove('empty', 'wall');
    el.classList.add('visited');
    // Re-trigger animation
    el.style.animation = 'none';
    el.offsetHeight; // reflow
    el.style.animation = '';
  }
}

/** Visually mark a cell as path (called by animation) */
function markPath(row, col) {
  const el = getCellEl(row, col);
  if (el) {
    el.classList.remove('visited');
    el.classList.add('path');
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = '';
  }
}

gridEl.addEventListener('mousedown', (e) => {
  if (isAnimating() && !stepByStep) return;
  const cell = e.target.closest('.cell');
  if (!cell) return;
  e.preventDefault();
  isMouseDown = true;

  const r = +cell.dataset.row;
  const c = +cell.dataset.col;
  const node = getNode(r, c);

  if (node.isSource) {
    draggingWhat = 'source';
  } else if (node.isDestination) {
    draggingWhat = 'dest';
  } else {
    draggingWhat = 'wall';
    wallDrawMode = !node.isWall; // if empty → draw; if wall → erase
    if (toggleWall(r, c, wallDrawMode)) {
      refreshCell(r, c);
    }
    clearPathVisuals();
  }
});

gridEl.addEventListener('mousemove', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const r = +cell.dataset.row;
  const c = +cell.dataset.col;

  // Tooltip
  showTooltip(e.clientX, e.clientY, r, c);

  if (!isMouseDown) return;
  if (isAnimating() && !stepByStep) return;

  if (draggingWhat === 'source') {
    const prev = getSourcePos();
    if (prev.row !== r || prev.col !== c) {
      if (moveSource(r, c)) {
        refreshCell(prev.row, prev.col);
        refreshCell(r, c);
      }
    }
  } else if (draggingWhat === 'dest') {
    const prev = getDestPos();
    if (prev.row !== r || prev.col !== c) {
      if (moveDest(r, c)) {
        refreshCell(prev.row, prev.col);
        refreshCell(r, c);
      }
    }
  } else if (draggingWhat === 'wall') {
    if (toggleWall(r, c, wallDrawMode)) {
      refreshCell(r, c);
      clearPathVisuals();
    }
  }
});

document.addEventListener('mouseup', () => {
  isMouseDown  = false;
  draggingWhat = null;
  wallDrawMode = null;
});

gridEl.addEventListener('mouseleave', () => {
  hideTooltip();
});

// Touch support for mobile
gridEl.addEventListener('touchstart', (e) => {
  const touch = e.touches[0];
  const el    = document.elementFromPoint(touch.clientX, touch.clientY);
  if (el) el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
}, { passive: true });

gridEl.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const el    = document.elementFromPoint(touch.clientX, touch.clientY);
  if (el && el.closest('.cell')) {
    el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
  }
}, { passive: false });

gridEl.addEventListener('touchend', () => {
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
}, { passive: true });

// ─────────────────────────────────────────────
// Tooltip
// ─────────────────────────────────────────────
function showTooltip(x, y, row, col) {
  tooltip.textContent = `(${row}, ${col})`;
  tooltip.style.left  = `${x + 14}px`;
  tooltip.style.top   = `${y - 24}px`;
  tooltip.classList.add('visible');
}

function hideTooltip() {
  tooltip.classList.remove('visible');
}

// ─────────────────────────────────────────────
// Run the selected algorithm
// ─────────────────────────────────────────────
function runAlgorithm() {
  if (isAnimating() && !stepByStep) return;

  stopAnimation();
  clearPathVisuals();

  const algoKey = algoSelect.value;
  const src     = getSourcePos();
  const dst     = getDestPos();
  const cloned  = cloneGrid();
  const srcNode = cloned[src.row][src.col];
  const dstNode = cloned[dst.row][dst.col];

  let result;
  switch (algoKey) {
    case 'bfs':      result = bfs(cloned, srcNode, dstNode);      break;
    case 'dfs':      result = dfs(cloned, srcNode, dstNode);      break;
    case 'dijkstra': result = dijkstra(cloned, srcNode, dstNode); break;
    case 'astar':    result = astar(cloned, srcNode, dstNode);    break;
    default: return;
  }

  const { visitedNodesInOrder, nodesInShortestPath } = result;
  const speedLevel = +speedSlider.value;

  setUIRunning(true);
  updateStats({ algo: algoKey, visited: '...', path: '...', status: 'running' });

  animateResult(visitedNodesInOrder, nodesInShortestPath, speedLevel, {
    onVisit: (row, col) => markVisited(row, col),
    onPath:  (row, col) => markPath(row, col),
    onDone: (found) => {
      setUIRunning(false);
      updateStats({
        algo:    algoKey,
        visited: visitedNodesInOrder.length,
        path:    found ? nodesInShortestPath.length - 2 : '—',
        status:  found ? 'done' : 'nopath',
      });
    },
    onStepUpdate: (cur, total) => {
      const isPathPhase = cur > visitedNodesInOrder.length;
      updateStats({
        algo:    algoKey,
        visited: Math.min(cur, visitedNodesInOrder.length),
        path:    isPathPhase ? cur - visitedNodesInOrder.length : '—',
        status:  'running',
      });
      if (cur >= total) {
        setUIRunning(false);
        const found = nodesInShortestPath.length > 0;
        updateStats({
          algo:    algoKey,
          visited: visitedNodesInOrder.length,
          path:    found ? nodesInShortestPath.length - 2 : '—',
          status:  found ? 'done' : 'nopath',
        });
      }
    },
  });

  // In step mode, the "Next Step" button drives advancement
  if (stepByStep) {
    btnNextStep.disabled = false;
    setUIRunning(false); // don't lock UI in step mode
  }
}

function clearPathVisuals() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const el = getCellEl(r, c);
      if (!el) continue;
      if (el.classList.contains('visited') || el.classList.contains('path')) {
        el.classList.remove('visited', 'path');
      }
    }
  }
  clearPathData();
}

function clearBoardFull() {
  stopAnimation();
  clearBoardData();
  rebuildGridDOM();
  updateStats({ algo: algoSelect.value, visited: '—', path: '—', status: 'idle' });
}

function rebuildGridDOM() {
  gridEl.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      applyNodeClass(cell, getNode(r, c));
      gridEl.appendChild(cell);
    }
  }
}

function setUIRunning(running) {
  if (running) {
    btnVisualize.disabled = true;
    btnClearPath.disabled = true;
    btnClearBoard.disabled = true;
    btnMaze.disabled = true;
    algoSelect.disabled = true;
    btnStop.classList.remove('hidden');
  } else {
    btnVisualize.disabled = false;
    btnClearPath.disabled = false;
    btnClearBoard.disabled = false;
    btnMaze.disabled = false;
    algoSelect.disabled = false;
    btnStop.classList.add('hidden');
  }
}

function updateStats({ algo, visited, path, status }) {
  if (algo !== undefined) {
    const info = ALGO_INFO[algo];
    statAlgo.textContent = info ? info.name : algo;
  }
  if (visited !== undefined) statVisited.textContent = visited;
  if (path !== undefined) statPath.textContent = path;
  if (status !== undefined) {
    statStatus.className = 'stat-value';
    switch (status) {
      case 'running': statStatus.textContent = 'Running'; statStatus.classList.add('stat-running'); break;
      case 'done':    statStatus.textContent = 'Completed'; statStatus.classList.add('stat-done'); break;
      case 'nopath':  statStatus.textContent = 'No path found'; statStatus.classList.add('stat-no-path'); break;
      default:        statStatus.textContent = 'Ready'; statStatus.classList.add('stat-idle'); break;
    }
  }
}

// ─────────────────────────────────────────────
// Algorithm info card
// ─────────────────────────────────────────────
function updateAlgoInfo(key) {
  const info = ALGO_INFO[key];
  if (!info) return;

  const badge = info.guarantee
    ? `<span class="info-badge badge-guaranteed">✓ Shortest Path Guaranteed</span>`
    : `<span class="info-badge badge-not-guaranteed">⚠ Does Not Guarantee Shortest Path</span>`;

  algoInfoContent.innerHTML = `
    <span class="info-name">${info.name}</span>
    <span class="info-desc">${info.desc}</span>
    <div class="info-meta">
      <span class="info-complexity">Time: ${info.time}</span>
      <span class="info-complexity">Space: ${info.space}</span>
      ${badge}
    </div>
  `;

  statAlgo.textContent = info.name;
}

// ─────────────────────────────────────────────
// Maze generation
// ─────────────────────────────────────────────
function generateMaze(type) {
  if (isAnimating()) return;
  stopAnimation();
  clearPathVisuals();

  let mask;
  if (type === 'recursive') {
    mask = generateRecursiveDivision();
  } else {
    mask = generateRandomWalls();
  }

  applyWallMask(mask);
  rebuildGridDOM();
  updateStats({ status: 'idle' });
}

// ─────────────────────────────────────────────
// Event listeners — buttons
// ─────────────────────────────────────────────
btnVisualize.addEventListener('click', runAlgorithm);

btnStop.addEventListener('click', () => {
  stopAnimation();
  setUIRunning(false);
  updateStats({ status: 'idle' });
});

btnClearPath.addEventListener('click', () => {
  if (isAnimating()) return;
  clearPathVisuals();
  updateStats({ visited: '—', path: '—', status: 'idle' });
});

btnClearBoard.addEventListener('click', clearBoardFull);

algoSelect.addEventListener('change', () => {
  updateAlgoInfo(algoSelect.value);
});

// Maze dropdown toggle
btnMaze.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = !mazeDropdown.classList.contains('hidden');
  mazeDropdown.classList.toggle('hidden');
  btnMaze.classList.toggle('open', !isOpen);
});

document.addEventListener('click', () => {
  mazeDropdown.classList.add('hidden');
  btnMaze.classList.remove('open');
});

mazeDropdown.querySelectorAll('.dropdown-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    generateMaze(item.dataset.maze);
    mazeDropdown.classList.add('hidden');
    btnMaze.classList.remove('open');
  });
});

// Speed slider
speedSlider.addEventListener('input', () => {
  const labels = ['Slow', 'Medium', 'Fast'];
  speedSlider.title = labels[+speedSlider.value] || 'Medium';
});

// Step-by-step toggle
btnStepToggle.addEventListener('click', () => {
  stepByStep = !stepByStep;
  setStepMode(stepByStep);
  statMode.textContent = stepByStep ? 'Step-by-Step' : 'Normal';
  stepControls.classList.toggle('hidden', !stepByStep);
  if (!stepByStep) {
    btnNextStep.disabled = true;
  }
});

btnNextStep.addEventListener('click', () => {
  advanceStep();

  const cur   = getCurrentStep();
  const total = getTotalSteps();
  if (cur >= total) {
    btnNextStep.disabled = true;
  }
});

// Keyboard shortcut: Space to run, Escape to stop
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (!isAnimating()) runAlgorithm();
  }
  if (e.code === 'Escape') {
    stopAnimation();
    setUIRunning(false);
    updateStats({ status: 'idle' });
  }
  if (e.code === 'ArrowRight' && stepByStep) {
    e.preventDefault();
    advanceStep();
  }
});

function updateCellSize() {
  // Measure fixed chrome heights
  const navbar   = document.querySelector('.navbar');
  const algoCard = document.querySelector('.algo-info-card');
  const legend   = document.querySelector('.legend-bar');
  const statsBar = document.querySelector('.stats-bar');

  const fixedH =
    (navbar   ? navbar.offsetHeight   : 60) +
    (algoCard ? algoCard.offsetHeight : 38) +
    (legend   ? legend.offsetHeight   : 40) +
    (statsBar ? statsBar.offsetHeight : 46) +
    24; // grid-wrapper padding (top + bottom)

  const availH = window.innerHeight - fixedH;
  const availW = window.innerWidth  - 44; // horizontal padding

  const fromH = Math.floor(availH / ROWS);
  const fromW = Math.floor(availW / COLS);
  const size  = Math.max(Math.min(fromH, fromW, 28), 10);

  document.documentElement.style.setProperty('--cell-size', `${size}px`);
}

buildGrid();
updateAlgoInfo('bfs');
updateStats({ algo: 'bfs', visited: '—', path: '—', status: 'idle' });
btnNextStep.disabled = true;
updateCellSize();
window.addEventListener('resize', updateCellSize);
