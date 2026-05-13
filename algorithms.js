import { getNeighbors, ROWS, COLS } from './grid.js';

function tracePath(destNode) {
  const path = [];
  let cur = destNode;
  while (cur !== null) {
    path.unshift(cur);
    cur = cur.parent;
  }
  return path;
}

export function bfs(grid, sourceNode, destNode) {
  const visited = [];
  const queue   = [sourceNode];
  sourceNode.isVisited = true;
  sourceNode.distance  = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    visited.push(current);

    if (current.row === destNode.row && current.col === destNode.col) {
      return { visitedNodesInOrder: visited, nodesInShortestPath: tracePath(current) };
    }

    for (const neighbor of getNeighbors(current, grid)) {
      if (!neighbor.isVisited && !neighbor.isWall) {
        neighbor.isVisited = true;
        neighbor.distance  = current.distance + 1;
        neighbor.parent    = current;
        queue.push(neighbor);
      }
    }
  }

  // No path found
  return { visitedNodesInOrder: visited, nodesInShortestPath: [] };
}

// ═══════════════════════════════════════════════════════════════
// 2. DFS — Depth First Search
//    Time:  O(V + E)
//    Space: O(V)  (recursive stack — iterative here to avoid stack overflow)
//    Guarantees shortest path? NO — explores deep before wide,
//    so the found path may be much longer than optimal.
// ═══════════════════════════════════════════════════════════════
export function dfs(grid, sourceNode, destNode) {
  const visited = [];
  const stack   = [sourceNode];
  sourceNode.isVisited = true;

  while (stack.length > 0) {
    const current = stack.pop();
    visited.push(current);

    if (current.row === destNode.row && current.col === destNode.col) {
      return { visitedNodesInOrder: visited, nodesInShortestPath: tracePath(current) };
    }

    // Push neighbors in reverse order so that we explore in a natural order
    const neighbors = getNeighbors(current, grid).reverse();
    for (const neighbor of neighbors) {
      if (!neighbor.isVisited && !neighbor.isWall) {
        neighbor.isVisited = true;
        neighbor.parent    = current;
        stack.push(neighbor);
      }
    }
  }

  return { visitedNodesInOrder: visited, nodesInShortestPath: [] };
}

export function dijkstra(grid, sourceNode, destNode) {
  const visited = [];
  sourceNode.distance = 0;

  const pq = new MinHeap();
  pq.insert(sourceNode, 0);

  while (!pq.isEmpty()) {
    const { node: current } = pq.extractMin();
    if (current.isVisited) continue;
    if (current.isWall)    continue;

    current.isVisited = true;
    visited.push(current);

    if (current.row === destNode.row && current.col === destNode.col) {
      return { visitedNodesInOrder: visited, nodesInShortestPath: tracePath(current) };
    }

    for (const neighbor of getNeighbors(current, grid)) {
      if (!neighbor.isVisited && !neighbor.isWall) {
        const alt = current.distance + 1; // all weights = 1
        if (alt < neighbor.distance) {
          neighbor.distance = alt;
          neighbor.parent   = current;
          pq.insert(neighbor, alt);
        }
      }
    }
  }

  return { visitedNodesInOrder: visited, nodesInShortestPath: [] };
}

export function astar(grid, sourceNode, destNode) {
  const visited = [];

  function manhattan(node) {
    return Math.abs(node.row - destNode.row) + Math.abs(node.col - destNode.col);
  }

  sourceNode.g = 0;
  sourceNode.h = manhattan(sourceNode);
  sourceNode.f = sourceNode.g + sourceNode.h;

  const openSet = new MinHeap();
  openSet.insert(sourceNode, sourceNode.f);
  sourceNode.inOpen = true;

  while (!openSet.isEmpty()) {
    const { node: current } = openSet.extractMin();

    if (current.isVisited) continue;
    if (current.isWall)    continue;

    current.isVisited = true;
    visited.push(current);

    if (current.row === destNode.row && current.col === destNode.col) {
      return { visitedNodesInOrder: visited, nodesInShortestPath: tracePath(current) };
    }

    for (const neighbor of getNeighbors(current, grid)) {
      if (neighbor.isVisited || neighbor.isWall) continue;

      // g(neighbor) via current = g(current) + 1
      const tentativeG = current.g + 1;

      if (tentativeG < neighbor.g) {
        neighbor.g      = tentativeG;
        neighbor.h      = manhattan(neighbor);
        neighbor.f      = neighbor.g + neighbor.h;
        neighbor.parent = current;
        openSet.insert(neighbor, neighbor.f);
      }
    }
  }

  return { visitedNodesInOrder: visited, nodesInShortestPath: [] };
}

class MinHeap {
  constructor() {
    this.heap = []; // [{ node, priority }]
  }

  isEmpty() { return this.heap.length === 0; }

  insert(node, priority) {
    this.heap.push({ node, priority });
    this._bubbleUp(this.heap.length - 1);
  }

  extractMin() {
    const min = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return min;
  }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent].priority <= this.heap[i].priority) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  _sinkDown(i) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this.heap[l].priority < this.heap[smallest].priority) smallest = l;
      if (r < n && this.heap[r].priority < this.heap[smallest].priority) smallest = r;
      if (smallest === i) break;
      [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
      i = smallest;
    }
  }
}
