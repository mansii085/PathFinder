const SPEED_MAP = {
  0: { visit: 60,  path: 120 }, // Slow
  1: { visit: 20,  path: 50  }, // Medium (default)
  2: { visit: 4,   path: 15  }, // Fast
};

let timeouts = [];
let isRunning = false;
let stepMode  = false;
let stepQueue = [];
let stepIndex = 0;
let onStepComplete = null;

export function isAnimating() { return isRunning; }


export function stopAnimation() {
  timeouts.forEach(t => clearTimeout(t));
  timeouts  = [];
  isRunning = false;
  stepQueue = [];
  stepIndex = 0;
}

export function setStepMode(enabled) {
  stepMode = enabled;
}

export function advanceStep() {
  if (!stepMode || stepIndex >= stepQueue.length) return;
  stepQueue[stepIndex]();
  stepIndex++;
  if (onStepComplete) onStepComplete(stepIndex, stepQueue.length);
}

export function getTotalSteps() { return stepQueue.length; }
export function getCurrentStep() { return stepIndex; }

/**
 * Animate the full algorithm result.
 *
 * @param {object[]} visitedNodes  — nodes in order they were discovered
 * @param {object[]} pathNodes     — nodes on the shortest path (source→dest), empty = no path
 * @param {number}   speedLevel    — 0 (slow), 1 (medium), 2 (fast)
 * @param {object}   callbacks
 *   - onVisit(row, col)         — called for each visited node animation
 *   - onPath(row, col, index)   — called for each path node animation
 *   - onDone(found)             — called when animation completes
 *   - onStatusUpdate(msg)       — called during animation for status bar
 */
export function animateResult(visitedNodes, pathNodes, speedLevel, callbacks) {
  const { onVisit, onPath, onDone, onStatusUpdate } = callbacks;
  const speed = SPEED_MAP[speedLevel] ?? SPEED_MAP[1];

  stopAnimation();
  isRunning = true;

  if (stepMode) {
    // Build the step queue and wait for manual advancement
    stepQueue = [];
    stepIndex = 0;

    for (let i = 0; i < visitedNodes.length; i++) {
      const node = visitedNodes[i];
      stepQueue.push(() => {
        // Skip source/dest
        if (!node.isSource && !node.isDestination) {
          onVisit(node.row, node.col);
        }
        if (onStatusUpdate) onStatusUpdate(`Visiting (${node.row}, ${node.col}) — step ${stepIndex + 1}/${stepQueue.length}`);
      });
    }

    for (let i = 0; i < pathNodes.length; i++) {
      const node = pathNodes[i];
      stepQueue.push(() => {
        if (!node.isSource && !node.isDestination) {
          onPath(node.row, node.col, i);
        }
      });
    }

    if (onStepComplete) onStepComplete(0, stepQueue.length);

    // Register the done callback for when all steps complete
    onStepComplete = (cur, total) => {
      callbacks.onStepUpdate && callbacks.onStepUpdate(cur, total);
      if (cur >= total) {
        isRunning = false;
        if (onDone) onDone(pathNodes.length > 0);
      }
    };

    // Trigger initial status
    if (onStatusUpdate) onStatusUpdate(`Step 0/${stepQueue.length} — click "Next Step"`);
    return;
  }

  // Normal (timed) animation
  let t = 0;

  // Phase 1: animate visited nodes
  for (let i = 0; i < visitedNodes.length; i++) {
    const node = visitedNodes[i];
    const tid = setTimeout(() => {
      if (!node.isSource && !node.isDestination) {
        onVisit(node.row, node.col);
      }
    }, t);
    timeouts.push(tid);
    t += speed.visit;
  }

  // Phase 2: animate shortest path after visited nodes finish
  for (let i = 0; i < pathNodes.length; i++) {
    const node = pathNodes[i];
    const tid = setTimeout(() => {
      if (!node.isSource && !node.isDestination) {
        onPath(node.row, node.col, i);
      }
    }, t);
    timeouts.push(tid);
    t += speed.path;
  }

  // Done callback
  const doneTid = setTimeout(() => {
    isRunning = false;
    if (onDone) onDone(pathNodes.length > 0);
  }, t);
  timeouts.push(doneTid);
}
