export const ROWS = 20;
export const COLS = 40;

export const DEFAULT_SOURCE = { row: 10, col: 5 };
export const DEFAULT_DEST   = { row: 10, col: 34 };

export const NODE_STATE = {
  EMPTY:       'empty',
  WALL:        'wall',
  SOURCE:      'source',
  DESTINATION: 'destination',
  VISITED:     'visited',
  PATH:        'path',
};

let grid = [];
let sourcePos = { ...DEFAULT_SOURCE };
let destPos   = { ...DEFAULT_DEST };

/** Create a fresh node object */
function createNode(row, col) {
  return {
    row,
    col,
    isWall:        false,
    isSource:      row === DEFAULT_SOURCE.row && col === DEFAULT_SOURCE.col,
    isDestination: row === DEFAULT_DEST.row   && col === DEFAULT_DEST.col,
    isVisited:     false,
    isPath:        false,
    distance:      Infinity,
    parent:        null,
    f: Infinity,
    g: Infinity,
    h: Infinity,
  };
}

export function initGridData() {
  grid = [];
  sourcePos = { ...DEFAULT_SOURCE };
  destPos   = { ...DEFAULT_DEST };

  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      row.push(createNode(r, c));
    }
    grid.push(row);
  }
  return grid;
}

export function getGrid() { return grid; }

/** Return a node by position */
export function getNode(row, col) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
  return grid[row][col];
}

/** Current source/dest positions */
export function getSourcePos() { return { ...sourcePos }; }
export function getDestPos()   { return { ...destPos };   }

/** Toggle a cell's wall state (only if not source or destination) */
export function toggleWall(row, col, forceSet) {
  const node = grid[row][col];
  if (node.isSource || node.isDestination) return false;
  const newVal = forceSet !== undefined ? forceSet : !node.isWall;
  node.isWall = newVal;
  return true;
}

export function moveSource(newRow, newCol) {
  const dest = grid[newRow][newCol];
  if (dest.isWall || dest.isDestination) return false;

  grid[sourcePos.row][sourcePos.col].isSource = false;
  dest.isSource = true;
  sourcePos = { row: newRow, col: newCol };
  return true;
}

/** Move the destination node to a new position */
export function moveDest(newRow, newCol) {
  const node = grid[newRow][newCol];
  if (node.isWall || node.isSource) return false;

  grid[destPos.row][destPos.col].isDestination = false;
  node.isDestination = true;
  destPos = { row: newRow, col: newCol };
  return true;
}

export function cloneGrid() {
  return grid.map(row =>
    row.map(node => ({ ...node, parent: null }))
  );
}

export function clearPath() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const node = grid[r][c];
      node.isVisited = false;
      node.isPath    = false;
      node.distance  = Infinity;
      node.parent    = null;
      node.f = Infinity;
      node.g = Infinity;
      node.h = Infinity;
    }
  }
}

/**
 * Clear the entire board back to defaults
 */
export function clearBoard() {
  grid = [];
  sourcePos = { ...DEFAULT_SOURCE };
  destPos   = { ...DEFAULT_DEST };

  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      row.push(createNode(r, c));
    }
    grid.push(row);
  }
  return grid;
}

/** Set all walls from a 2D boolean mask */
export function applyWallMask(mask) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const node = grid[r][c];
      if (node.isSource || node.isDestination) {
        node.isWall = false;
      } else {
        node.isWall = mask[r][c] === true;
      }
      node.isVisited = false;
      node.isPath    = false;
    }
  }
}

/** Get neighbors (4-directional) of a node */
export function getNeighbors(node, g) {
  const { row, col } = node;
  const neighbors = [];
  if (row > 0)        neighbors.push(g[row - 1][col]);
  if (row < ROWS - 1) neighbors.push(g[row + 1][col]);
  if (col > 0)        neighbors.push(g[row][col - 1]);
  if (col < COLS - 1) neighbors.push(g[row][col + 1]);
  return neighbors;
}
