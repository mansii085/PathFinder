import { ROWS, COLS, getSourcePos, getDestPos } from './grid.js';

export function generateRecursiveDivision() {

  const mask = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));

  for (let c = 0; c < COLS; c++) { mask[0][c] = true; mask[ROWS - 1][c] = true; }
  for (let r = 0; r < ROWS; r++) { mask[r][0] = true; mask[r][COLS - 1] = true; }

  divide(mask, 1, ROWS - 2, 1, COLS - 2, chooseOrientation(ROWS - 2, COLS - 2));

  const src = getSourcePos();
  const dst = getDestPos();
  mask[src.row][src.col] = false;
  mask[dst.row][dst.col] = false;

  clearAdjacent(mask, src.row, src.col);
  clearAdjacent(mask, dst.row, dst.col);

  return mask;
}

function chooseOrientation(height, width) {
  if (width < height) return 'HORIZONTAL';
  if (height < width) return 'VERTICAL';
  return Math.random() < 0.5 ? 'HORIZONTAL' : 'VERTICAL';
}

function divide(mask, rMin, rMax, cMin, cMax, orientation) {
  if (rMax - rMin < 2 || cMax - cMin < 2) return;

  if (orientation === 'HORIZONTAL') {
    // Pick an even row for the wall (between rMin+1 and rMax-1)
    const wallRow = randEven(rMin, rMax);
    // Pick an odd column for the passage
    const passCol = randOdd(cMin, cMax);

    for (let c = cMin; c <= cMax; c++) {
      if (c !== passCol) mask[wallRow][c] = true;
    }

    divide(mask, rMin, wallRow - 1, cMin, cMax, chooseOrientation(wallRow - 1 - rMin, cMax - cMin));
    divide(mask, wallRow + 1, rMax, cMin, cMax, chooseOrientation(rMax - wallRow - 1, cMax - cMin));
  } else {
    // Pick an even column for the wall
    const wallCol = randEven(cMin, cMax);
    // Pick an odd row for the passage
    const passRow = randOdd(rMin, rMax);

    for (let r = rMin; r <= rMax; r++) {
      if (r !== passRow) mask[r][wallCol] = true;
    }

    divide(mask, rMin, rMax, cMin, wallCol - 1, chooseOrientation(rMax - rMin, wallCol - 1 - cMin));
    divide(mask, rMin, rMax, wallCol + 1, cMax, chooseOrientation(rMax - rMin, cMax - wallCol - 1));
  }
}


function randEven(min, max) {
  const evens = [];
  for (let i = min; i <= max; i++) {
    if (i % 2 === 0) evens.push(i);
  }
  if (evens.length === 0) return Math.floor((min + max) / 2);
  return evens[Math.floor(Math.random() * evens.length)];
}

function randOdd(min, max) {
  const odds = [];
  for (let i = min; i <= max; i++) {
    if (i % 2 !== 0) odds.push(i);
  }
  if (odds.length === 0) return Math.floor((min + max) / 2);
  return odds[Math.floor(Math.random() * odds.length)];
}

function clearAdjacent(mask, row, col) {
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
  for (const [dr, dc] of dirs) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
      mask[nr][nc] = false;
    }
  }
}

export function generateRandomWalls(density = 0.30) {
  const src = getSourcePos();
  const dst = getDestPos();

  const mask = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => {
      if (r === src.row && c === src.col) return false;
      if (r === dst.row && c === dst.col) return false;
      return Math.random() < density;
    })
  );

  return mask;
}
