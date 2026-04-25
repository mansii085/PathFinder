'use strict';

// Grid dimensions — square 20x20 keeps the focus tight.
const ROWS = 20;
const COLS = 20;

// Default endpoints — get filled in by randomEndpoints() before the grid builds.
const start = { row: 0, col: 0 };
const end   = { row: 0, col: 0 };

// Pick start and end at random, but keep them at a meaningful distance so the
// search has something to do. Minimum manhattan distance of about half the grid.
function randomEndpoints() {
  const minDist = Math.floor((ROWS + COLS) / 2);
  let s, e;
  do {
    s = { row: Math.floor(Math.random() * ROWS), col: Math.floor(Math.random() * COLS) };
    e = { row: Math.floor(Math.random() * ROWS), col: Math.floor(Math.random() * COLS) };
  } while (Math.abs(s.row - e.row) + Math.abs(s.col - e.col) < minDist);
  start.row = s.row; start.col = s.col;
  end.row = e.row;   end.col = e.col;
}

// Movement deltas: up, down, left, right. No diagonals.
const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// --- state ---

let grid;                 // 2D array of cell objects
let isMouseDown = false;
let dragMode = null;      // 'wall' | 'erase' | 'start' | 'end' | null
let isAnimating = false;
let activeAlgo = 'bfs';

// pending timeouts so we can cancel an in-flight animation if reset is hit
const pending = [];

// --- DOM refs ---

const gridEl    = document.getElementById('grid');
const statusEl  = document.getElementById('status');
const metricsEl = document.getElementById('metrics');
const runBtn    = document.getElementById('runBtn');

// --- grid setup ---

function makeCell(row, col) {
  return {
    row, col,
    isWall: false,
    isStart: row === start.row && col === start.col,
    isEnd:   row === end.row   && col === end.col,
  };
}

function buildGrid() {
  grid = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => makeCell(r, c))
  );
  render();
}

function render() {
  gridEl.style.gridTemplateColumns = `repeat(${COLS}, 28px)`;
  gridEl.replaceChildren();

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      const el = document.createElement('div');
      el.className = 'cell';
      el.dataset.row = r;
      el.dataset.col = c;
      if (cell.isStart)      el.classList.add('start');
      else if (cell.isEnd)   el.classList.add('end');
      else if (cell.isWall)  el.classList.add('wall');

      el.addEventListener('mousedown', onCellDown);
      el.addEventListener('mouseenter', onCellEnter);
      gridEl.appendChild(el);
    }
  }
}

function elAt(row, col) {
  return gridEl.children[row * COLS + col];
}

// --- mouse handling ---

function onCellDown(e) {
  if (isAnimating) return;

  const r = +e.target.dataset.row;
  const c = +e.target.dataset.col;
  const cell = grid[r][c];

  isMouseDown = true;

  if (cell.isStart)     dragMode = 'start';
  else if (cell.isEnd)  dragMode = 'end';
  else if (cell.isWall) {
    // click on a wall to start erasing
    dragMode = 'erase';
    cell.isWall = false;
    e.target.classList.remove('wall');
  } else {
    dragMode = 'wall';
    cell.isWall = true;
    e.target.classList.add('wall');
  }
}

function onCellEnter(e) {
  if (!isMouseDown || isAnimating) return;

  const r = +e.target.dataset.row;
  const c = +e.target.dataset.col;
  const cell = grid[r][c];

  if (dragMode === 'wall' && !cell.isStart && !cell.isEnd) {
    cell.isWall = true;
    e.target.classList.add('wall');
  } else if (dragMode === 'erase' && !cell.isStart && !cell.isEnd) {
    cell.isWall = false;
    e.target.classList.remove('wall');
  } else if (dragMode === 'start' && !cell.isEnd && !cell.isWall) {
    moveEndpoint('start', r, c);
  } else if (dragMode === 'end' && !cell.isStart && !cell.isWall) {
    moveEndpoint('end', r, c);
  }
}

function moveEndpoint(which, r, c) {
  const flag = which === 'start' ? 'isStart' : 'isEnd';
  const obj  = which === 'start' ? start : end;
  const cls  = which;

  // unset previous
  grid[obj.row][obj.col][flag] = false;
  elAt(obj.row, obj.col).classList.remove(cls);

  // set new
  obj.row = r; obj.col = c;
  grid[r][c][flag] = true;
  elAt(r, c).classList.add(cls);
}

document.addEventListener('mouseup', () => {
  isMouseDown = false;
  dragMode = null;
});

// release if the cursor leaves the window mid-drag
document.addEventListener('mouseleave', () => {
  isMouseDown = false;
  dragMode = null;
});

// --- algorithms ---
// Each returns { visited: [...], path: [...] }.
// `visited` is the cells the algorithm popped/dequeued, in order. We use it for animation.
// `path` is the reconstructed path from start to end, excluding both endpoints.

function neighborsOf(cell) {
  const out = [];
  for (const [dr, dc] of DIRS) {
    const nr = cell.row + dr;
    const nc = cell.col + dc;
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
    if (grid[nr][nc].isWall) continue;
    out.push(grid[nr][nc]);
  }
  return out;
}

const keyOf = c => `${c.row},${c.col}`;

function reconstructPath(parent, target) {
  const path = [];
  let curr = parent.get(keyOf(target));
  while (curr && !curr.isStart) {
    path.push(curr);
    curr = parent.get(keyOf(curr));
  }
  return path.reverse();
}

// BFS — explores in waves, guarantees the shortest path on an unweighted grid.
// Queue: shift() is O(n) but for grids of this size it's a non-issue.
function bfs() {
  const startCell = grid[start.row][start.col];
  const endCell   = grid[end.row][end.col];

  const visited = [];
  const seen    = new Set([keyOf(startCell)]);
  const parent  = new Map();
  const queue   = [startCell];

  while (queue.length) {
    const cell = queue.shift();
    if (cell !== startCell && cell !== endCell) visited.push(cell);
    if (cell === endCell) return { visited, path: reconstructPath(parent, endCell) };

    for (const nb of neighborsOf(cell)) {
      const k = keyOf(nb);
      if (seen.has(k)) continue;
      seen.add(k);
      parent.set(k, cell);
      queue.push(nb);
    }
  }
  return { visited, path: [] };
}

// DFS — recursive. The call stack is the data structure here. We descend into
// the first unvisited neighbour, and only when that branch dead-ends do we
// backtrack and try the next direction. That's what makes DFS go deep.
function dfs() {
  const startCell = grid[start.row][start.col];
  const endCell   = grid[end.row][end.col];

  const visited = [];
  const seen    = new Set();
  const parent  = new Map();

  function explore(cell) {
    seen.add(keyOf(cell));
    if (cell !== startCell && cell !== endCell) visited.push(cell);
    if (cell === endCell) return true;

    for (const nb of neighborsOf(cell)) {
      if (seen.has(keyOf(nb))) continue;
      parent.set(keyOf(nb), cell);
      if (explore(nb)) return true;   // found end down this branch — bubble up
    }
    return false; // dead end, backtrack
  }

  explore(startCell);
  const path = parent.has(keyOf(endCell)) ? reconstructPath(parent, endCell) : [];
  return { visited, path };
}

// Dijkstra — every edge has weight 1 here, so on this grid it behaves like BFS.
// I'm using a sort-based "priority queue" because the grid is small. For larger
// graphs you'd want a real binary heap.
function dijkstra() {
  const startCell = grid[start.row][start.col];
  const endCell   = grid[end.row][end.col];

  const visited = [];
  const dist    = new Map([[keyOf(startCell), 0]]);
  const parent  = new Map();
  const pq      = [{ cell: startCell, d: 0 }];

  while (pq.length) {
    // smallest distance first
    pq.sort((a, b) => a.d - b.d);
    const { cell, d } = pq.shift();
    const k = keyOf(cell);

    // stale entry — we already found a shorter path to this cell
    if (d > (dist.get(k) ?? Infinity)) continue;

    if (cell !== startCell && cell !== endCell) visited.push(cell);
    if (cell === endCell) return { visited, path: reconstructPath(parent, endCell) };

    for (const nb of neighborsOf(cell)) {
      const nk = keyOf(nb);
      const nd = d + 1;
      if (nd < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nd);
        parent.set(nk, cell);
        pq.push({ cell: nb, d: nd });
      }
    }
  }
  return { visited, path: [] };
}

const ALGOS = {
  bfs:      { fn: bfs,      label: 'BFS' },
  dfs:      { fn: dfs,      label: 'DFS' },
  dijkstra: { fn: dijkstra, label: "Dijkstra's algorithm" },
};

// --- animation ---

function clearVisualResults() {
  // remove visited/path/no-path classes but keep walls intact
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const el = elAt(r, c);
      el.classList.remove('visited', 'path', 'no-path');
    }
  }
}

function cancelPending() {
  while (pending.length) clearTimeout(pending.pop());
}

function animateSearch(visited, path) {
  return new Promise(resolve => {
    const stepMs = 25;  // visited cell delay — slow enough to actually watch
    const pathMs = 60;  // final path delay (more dramatic reveal)

    visited.forEach((cell, i) => {
      pending.push(setTimeout(() => {
        if (cell.isStart || cell.isEnd) return;
        elAt(cell.row, cell.col).classList.add('visited');
      }, i * stepMs));
    });

    const afterVisited = visited.length * stepMs;

    if (path.length === 0) {
      // no path — small shake on the end cell
      pending.push(setTimeout(() => {
        elAt(end.row, end.col).classList.add('no-path');
        resolve();
      }, afterVisited));
      return;
    }

    path.forEach((cell, i) => {
      pending.push(setTimeout(() => {
        if (cell.isStart || cell.isEnd) return;
        const el = elAt(cell.row, cell.col);
        el.classList.remove('visited');
        el.classList.add('path');
        if (i === path.length - 1) resolve();
      }, afterVisited + i * pathMs));
    });
  });
}

// --- run flow ---

async function run() {
  if (isAnimating) return;
  cancelPending();
  clearVisualResults();

  isAnimating = true;
  runBtn.disabled = true;

  const { fn, label } = ALGOS[activeAlgo];
  statusEl.textContent = `Running ${label}…`;

  const t0 = performance.now();
  const { visited, path } = fn();
  const elapsed = (performance.now() - t0).toFixed(1);

  await animateSearch(visited, path);

  if (path.length > 0) {
    // path has length = (steps - 1), so total steps = path.length + 1
    metricsEl.textContent = `${visited.length} visited · ${path.length + 1} steps · ${elapsed}ms`;
    statusEl.textContent = `${label} · path found`;
  } else {
    metricsEl.textContent = `${visited.length} visited · no path`;
    statusEl.textContent = `${label} · no path`;
  }

  isAnimating = false;
  runBtn.disabled = false;
}

// --- buttons ---

document.querySelectorAll('.algo-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (isAnimating) return;
    document.querySelectorAll('.algo-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeAlgo = btn.dataset.algo;
  });
});

runBtn.addEventListener('click', run);

document.getElementById('clearPathBtn').addEventListener('click', () => {
  if (isAnimating) return;
  clearVisualResults();
  metricsEl.textContent = '—';
  statusEl.textContent = 'Draw walls · run search';
});

document.getElementById('clearWallsBtn').addEventListener('click', () => {
  if (isAnimating) return;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].isWall) {
        grid[r][c].isWall = false;
        elAt(r, c).classList.remove('wall');
      }
    }
  }
});

document.getElementById('resetBtn').addEventListener('click', () => {
  if (isAnimating) return;
  cancelPending();
  randomEndpoints();
  buildGrid();
  metricsEl.textContent = '—';
  statusEl.textContent = 'Draw walls · run search';
});

// --- go ---
randomEndpoints();
buildGrid();
