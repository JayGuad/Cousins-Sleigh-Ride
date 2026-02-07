"use strict";

const IMAGE_SRC = "1c8d212d-ca11-4df1-acbb-583c18e26964.jpeg";

const startScreen = document.getElementById("start-screen");
const gameScreen = document.getElementById("game-screen");
const startButton = document.getElementById("start-button");
const restartButton = document.getElementById("restart-button");
const jumpButton = document.getElementById("jump-button");
const loadStatus = document.getElementById("load-status");
const gameMessage = document.getElementById("game-message");
const distanceEl = document.getElementById("distance");
const jumpsEl = document.getElementById("jumps");
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const obstacleTypes = [
  { label: "Bear", emoji: "🐻", color: "#6b4b2a" },
  { label: "Fox", emoji: "🦊", color: "#d97b1d" },
  { label: "Moose", emoji: "🫎", color: "#8c5a2e" },
  { label: "Shirley Temple", emoji: "👧", color: "#f7b7c7" },
  { label: "Car", emoji: "🚗", color: "#3d7ff2" },
  { label: "Train", emoji: "🚆", color: "#2d5f7b" },
  { label: "Troll", emoji: "🧌", color: "#5a7a3b" },
  { label: "Sled", emoji: "🛷", color: "#b84d5a" },
];

const headCropSpecs = [
  { x: 0.1, y: 0.58125, w: 0.23333, h: 0.175 },
  { x: 0.35833, y: 0.5875, w: 0.14167, h: 0.13125 },
  { x: 0.51667, y: 0.575, w: 0.23333, h: 0.175 },
];

const state = {
  width: 800,
  height: 500,
  scale: 1,
  groundY: 420,
  sleigh: {
    x: 120,
    y: 320,
    width: 220,
    height: 80,
    vy: 0,
    isJumping: false,
  },
  obstacles: [],
  timeToNextObstacle: 1.8,
  distance: 0,
  jumps: 0,
  running: false,
  gameOver: false,
  headSprites: [],
  headsReady: false,
  mountains: [],
};

const sourceImage = new Image();
startButton.disabled = true;
sourceImage.onload = () => {
  state.headSprites = headCropSpecs.map((spec) => cropHead(sourceImage, spec));
  state.headsReady = true;
  loadStatus.textContent = "Ready to ride!";
  startButton.disabled = false;
};
sourceImage.onerror = () => {
  loadStatus.textContent = "Image failed to load.";
};
sourceImage.src = IMAGE_SRC;

function cropHead(image, spec) {
  const cropWidth = Math.round(spec.w * image.naturalWidth);
  const cropHeight = Math.round(spec.h * image.naturalHeight);
  const canvasEl = document.createElement("canvas");
  canvasEl.width = cropWidth;
  canvasEl.height = cropHeight;
  const cropCtx = canvasEl.getContext("2d");
  const sx = Math.round(spec.x * image.naturalWidth);
  const sy = Math.round(spec.y * image.naturalHeight);
  cropCtx.drawImage(
    image,
    sx,
    sy,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight
  );
  const headImage = new Image();
  headImage.src = canvasEl.toDataURL("image/png");
  return headImage;
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const maxWidth = Math.min(window.innerWidth, 980);
  const maxHeight = Math.min(window.innerHeight * 0.6, 560);
  canvas.style.width = `${maxWidth}px`;
  canvas.style.height = `${maxHeight}px`;
  canvas.width = Math.floor(maxWidth * ratio);
  canvas.height = Math.floor(maxHeight * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  state.width = maxWidth;
  state.height = maxHeight;
  state.scale = Math.min(maxWidth / 900, maxHeight / 520);
  state.groundY = state.height - 90 * state.scale;
  state.sleigh.width = 230 * state.scale;
  state.sleigh.height = 80 * state.scale;
  state.sleigh.x = state.width * 0.18;
  if (!state.sleigh.isJumping) {
    state.sleigh.y = state.groundY - state.sleigh.height;
  }
  buildMountains();
}

function resetGame() {
  state.obstacles = [];
  state.timeToNextObstacle = 1.2;
  state.distance = 0;
  state.jumps = 0;
  state.gameOver = false;
  state.sleigh.vy = 0;
  state.sleigh.isJumping = false;
  state.sleigh.y = state.groundY - state.sleigh.height;
  updateHud();
  gameMessage.classList.add("hidden");
}

function updateHud() {
  distanceEl.textContent = Math.floor(state.distance).toString();
  jumpsEl.textContent = state.jumps.toString();
}

function startGame() {
  if (state.running) {
    return;
  }
  resetGame();
  state.running = true;
  let lastTime = performance.now();

  function loop(now) {
    if (!state.running) {
      return;
    }
    const delta = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    update(delta);
    draw();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

function endGame() {
  state.running = false;
  state.gameOver = true;
  gameMessage.classList.remove("hidden");
}

function update(delta) {
  state.distance += delta * 35;
  updateHud();
  updateSleigh(delta);
  updateObstacles(delta);
  checkCollisions();
}

function updateSleigh(delta) {
  const gravity = 1800 * state.scale;
  state.sleigh.vy += gravity * delta;
  state.sleigh.y += state.sleigh.vy * delta;
  if (state.sleigh.y >= state.groundY - state.sleigh.height) {
    state.sleigh.y = state.groundY - state.sleigh.height;
    state.sleigh.vy = 0;
    state.sleigh.isJumping = false;
  }
}

function updateObstacles(delta) {
  const speed = 220 * state.scale;
  state.timeToNextObstacle -= delta;
  if (state.timeToNextObstacle <= 0) {
    spawnObstacle();
    state.timeToNextObstacle = 1 + Math.random() * 1.2;
  }

  state.obstacles = state.obstacles.filter((obstacle) => {
    obstacle.x -= speed * delta;
    return obstacle.x + obstacle.width > -60;
  });
}

function spawnObstacle() {
  const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
  const base = 70 + Math.random() * 30;
  const width = base * 1.2 * state.scale;
  const height = base * state.scale;
  state.obstacles.push({
    type,
    width,
    height,
    x: state.width + width,
    y: state.groundY - height,
  });
}

function checkCollisions() {
  const padding = 18 * state.scale;
  const sleighBox = {
    x: state.sleigh.x + padding,
    y: state.sleigh.y + padding,
    width: state.sleigh.width - padding * 2,
    height: state.sleigh.height - padding * 2,
  };

  for (const obstacle of state.obstacles) {
    if (rectOverlap(sleighBox, obstacle)) {
      endGame();
      break;
    }
  }
}

function rectOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function triggerJump() {
  if (!state.running || state.gameOver) {
    return;
  }
  if (!state.sleigh.isJumping) {
    state.sleigh.vy = -780 * state.scale;
    state.sleigh.isJumping = true;
    state.jumps += 1;
    updateHud();
  }
}

function draw() {
  ctx.clearRect(0, 0, state.width, state.height);
  drawBackground();
  drawObstacles();
  drawSleigh();
  drawSnow();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
  gradient.addColorStop(0, "#8dd4ff");
  gradient.addColorStop(0.55, "#d7f3ff");
  gradient.addColorStop(1, "#ffffff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.width, state.height);

  state.mountains.forEach((layer) => drawMountainLayer(layer));
}

function buildMountains() {
  state.mountains = [
    createMountainLayer("#b5d8f2", state.height * 0.35, 1.4, 5, 0.85),
    createMountainLayer("#9bc1e6", state.height * 0.45, 1.1, 6, 0.65),
  ];
}

function createMountainLayer(color, baseY, heightScale, peaks, wobble) {
  const step = state.width / peaks;
  const points = [];
  for (let i = 0; i <= peaks; i += 1) {
    const peakX = i * step;
    const height =
      heightScale *
      state.height *
      0.25 *
      (0.4 + wobble * Math.abs(Math.sin(i * 1.35 + 0.9)));
    points.push({ x: peakX, y: baseY - height });
  }
  return { color, baseY, points, step };
}

function drawMountainLayer(layer) {
  ctx.fillStyle = layer.color;
  ctx.beginPath();
  ctx.moveTo(0, layer.baseY);
  for (let i = 0; i < layer.points.length; i += 1) {
    const point = layer.points[i];
    ctx.lineTo(point.x, point.y);
    if (i < layer.points.length - 1) {
      ctx.lineTo(point.x + layer.step / 2, layer.baseY);
    }
  }
  ctx.lineTo(state.width, layer.baseY);
  ctx.lineTo(state.width, state.height);
  ctx.lineTo(0, state.height);
  ctx.closePath();
  ctx.fill();
}

function drawSnow() {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, state.groundY, state.width, state.height - state.groundY);
  ctx.strokeStyle = "rgba(120, 180, 220, 0.45)";
  ctx.lineWidth = 4 * state.scale;
  ctx.beginPath();
  ctx.moveTo(0, state.groundY);
  ctx.lineTo(state.width, state.groundY);
  ctx.stroke();
}

function drawSleigh() {
  const { x, y, width, height } = state.sleigh;

  ctx.fillStyle = "#b12d2d";
  roundRect(x, y + height * 0.25, width, height * 0.6, 16 * state.scale);
  ctx.fill();

  ctx.fillStyle = "#7c1e1e";
  roundRect(x + width * 0.05, y, width * 0.9, height * 0.4, 14 * state.scale);
  ctx.fill();

  ctx.strokeStyle = "#6b3c1d";
  ctx.lineWidth = 6 * state.scale;
  ctx.beginPath();
  ctx.moveTo(x + width * 0.05, y + height * 0.85);
  ctx.quadraticCurveTo(
    x + width * 0.4,
    y + height * 1.2,
    x + width * 0.9,
    y + height * 0.85
  );
  ctx.stroke();

  drawHeads();
}

function drawHeads() {
  if (!state.headsReady || state.headSprites.length === 0) {
    return;
  }

  const headSize = state.sleigh.height * 1.2;
  const headY = state.sleigh.y - headSize * 0.75;
  const positions = [
    state.sleigh.x + state.sleigh.width * 0.08,
    state.sleigh.x + state.sleigh.width * 0.38,
    state.sleigh.x + state.sleigh.width * 0.68,
  ];

  positions.forEach((x, index) => {
    const img = state.headSprites[index % state.headSprites.length];
    drawCircularImage(img, x, headY, headSize);
  });
}

function drawCircularImage(img, x, y, size) {
  if (!img.complete || img.width === 0) {
    return;
  }
  const scale = size / Math.min(img.width, img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const offsetX = x + (size - drawW) / 2;
  const offsetY = y + (size - drawH) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  ctx.restore();
}

function drawObstacles() {
  for (const obstacle of state.obstacles) {
    drawObstacle(obstacle);
  }
}

function drawObstacle(obstacle) {
  ctx.fillStyle = obstacle.type.color;
  roundRect(
    obstacle.x,
    obstacle.y,
    obstacle.width,
    obstacle.height,
    14 * state.scale
  );
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = `${28 * state.scale}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    obstacle.type.emoji,
    obstacle.x + obstacle.width / 2,
    obstacle.y + obstacle.height * 0.45
  );

  ctx.fillStyle = "#ffffff";
  ctx.font = `${14 * state.scale}px "Trebuchet MS", sans-serif`;
  ctx.fillText(
    obstacle.type.label,
    obstacle.x + obstacle.width / 2,
    obstacle.y + obstacle.height * 0.82
  );
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(
    x + width,
    y + height,
    x + width - radius,
    y + height
  );
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

startButton.addEventListener("click", () => {
  startScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  resizeCanvas();
  startGame();
});

restartButton.addEventListener("click", () => {
  startGame();
});

gameMessage.addEventListener("pointerdown", () => {
  if (!state.gameOver) {
    return;
  }
  startGame();
});

jumpButton.addEventListener("click", () => {
  triggerJump();
});

canvas.addEventListener("pointerdown", () => {
  triggerJump();
});

canvas.addEventListener(
  "touchstart",
  (event) => {
    event.preventDefault();
    triggerJump();
  },
  { passive: false }
);

document.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();
    triggerJump();
  }
});

window.addEventListener("resize", () => {
  resizeCanvas();
});

resizeCanvas();
