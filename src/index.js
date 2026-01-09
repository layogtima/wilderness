import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import grassShader from './shaders/grass.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);

// Parameters
const PLANE_SIZE = 60;
const BLADE_COUNT = 200000;
const BLADE_WIDTH = 0.25;
const BLADE_HEIGHT = 0.2;
const BLADE_HEIGHT_VARIATION = 0.9;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new PointerLockControls(camera, document.body);

const instructions = document.createElement('div');
instructions.style.position = 'absolute';
instructions.style.top = '50%';
instructions.style.left = '50%';
instructions.style.transform = 'translate(-50%, -50%)';
instructions.style.color = 'white';
instructions.style.fontFamily = 'sans-serif';
instructions.style.fontSize = '24px';
instructions.style.textAlign = 'center';
instructions.style.pointerEvents = 'none';
instructions.innerHTML = 'Click to Play<br>(WASD to move, Mouse to look)';
document.body.appendChild(instructions);

document.addEventListener('click', () => {
  controls.lock();
});

controls.addEventListener('lock', () => {
  instructions.style.display = 'none';
});

controls.addEventListener('unlock', () => {
  instructions.style.display = 'block';
});

// Movement State
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

const onKeyDown = function (event) {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = true;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = true;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = true;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = true;
      break;
    case 'Space':
      if (canJump === true) velocity.y += 25; // was 350
      canJump = false;
      break;
  }
};

const onKeyUp = function (event) {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = false;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = false;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = false;
      break;
  }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// Camera Initial Position
camera.position.set(0, 5, 0); // Eye level
camera.lookAt(0, 5, -10);

// Grass Texture
const grassTexture = new THREE.TextureLoader().load('grass.jpg');
const cloudTexture = new THREE.TextureLoader().load('cloud.jpg');
cloudTexture.wrapS = cloudTexture.wrapT = THREE.RepeatWrapping;

// Time Uniform
const startTime = Date.now();
const timeUniform = { type: 'f', value: 0.0 };
let prevTime = performance.now();

// Grass Shader
const grassUniforms = {
  textures: { value: [grassTexture, cloudTexture] },
  iTime: timeUniform
};

const grassMaterial = new THREE.ShaderMaterial({
  uniforms: grassUniforms,
  vertexShader: grassShader.vert,
  fragmentShader: grassShader.frag,
  vertexColors: true,
  side: THREE.DoubleSide
});



// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(-50, 100, 50);
scene.add(dirLight);

// Fog & Background
// Matching the sky color to a soft, foggy green-blue
const skyColor = 0x62c1e5; 
scene.background = new THREE.Color(skyColor);
scene.fog = new THREE.FogExp2(skyColor, 0.0025);

generateEnvironment();
generateField();

const animate = function () {
  requestAnimationFrame(animate);

  const time = performance.now();
  const delta = (time - prevTime) / 1000;
  
  const elapsedTime = Date.now() - startTime;
  grassUniforms.iTime.value = elapsedTime;

    // Movement Logic
  if (controls.isLocked === true) {
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    velocity.y -= 9.8 * 1 * delta; // 100.0 = mass

    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize();

    // Slower Speed (was 400.0)
    if (moveForward || moveBackward) velocity.z -= direction.z * 100.0 * delta;
    if (moveLeft || moveRight) velocity.x -= direction.x * 100.0 * delta;

    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);

    camera.position.y += (velocity.y * delta);

    // Jump Physics (lower and slower)
    if (camera.position.y < 1.5) {
      velocity.y = 0;
      camera.position.y = 1.5;
      canJump = true;
    }

    // Map Boundaries (PLANE_SIZE is 60, so +/- 30)
    const limit = PLANE_SIZE / 2; 
    if (camera.position.x < -limit) camera.position.x = -limit;
    if (camera.position.x > limit) camera.position.x = limit;
    if (camera.position.z < -limit) camera.position.z = -limit;
    if (camera.position.z > limit) camera.position.z = limit;
  }

  prevTime = time;

  renderer.render(scene, camera);
};

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function convertRange (val, oldMin, oldMax, newMin, newMax) {
  return (((val - oldMin) * (newMax - newMin)) / (oldMax - oldMin)) + newMin;
}

function generateEnvironment() {
  // 1. Rock Base (The Cliff we stand on)
  const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x556655 }); // More greenish-grey
  const rockGeo = new THREE.CylinderBufferGeometry(PLANE_SIZE / 1.5, PLANE_SIZE / 1.2, 30, 8); // rougher shape
  const rockMesh = new THREE.Mesh(rockGeo, rockMaterial);
  rockMesh.position.y = -15.1; 
  scene.add(rockMesh);

  // 2. Distant Terrain (Improved Noise)
  const worldWidth = 256;
  const worldDepth = 256;
  const terrainSize = 4000;
  
  const data = generateHeight(worldWidth, worldDepth);
  const geometry = new THREE.PlaneBufferGeometry(terrainSize, terrainSize, worldWidth - 1, worldDepth - 1);
  geometry.rotateX(-Math.PI / 2);

  const vertices = geometry.attributes.position.array;
  for (let i = 0, j = 0, l = vertices.length; i < l; i++, j += 3) {
    // Scaling height
    vertices[j + 1] = data[i] * 20; 
  }
  // Lower the terrain so its hills don't intersect our high platform
  // Our platform is at y=0. We want hills to be visible but "below".
  geometry.translate(0, -100, 0); 
  
  const texture = new THREE.CanvasTexture(generateTexture(data, worldWidth, worldDepth));
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ map: texture }));
  scene.add(mesh);
}

// ----------------------------------------------------------------------------
// Helpers for Terrain Generation (adapted from THREE.js "webgl_geometry_terrain")
// ----------------------------------------------------------------------------
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';

function generateHeight(width, height) {
  let seed = Math.PI / 4;
  const random = function () {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  const size = width * height;
  const data = new Uint8Array(size);
  const perlin = new ImprovedNoise();
  const z = random() * 100;

  let quality = 1;

  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < size; i++) {
      const x = i % width;
      const y = ~~(i / width);
      data[i] += Math.abs(perlin.noise(x / quality, y / quality, z) * quality * 1.75);
    }
    quality *= 5;
  }
  return data;
}

function generateTexture(data, width, height) {
  let context, image, imageData, shade;
  const vector3 = new THREE.Vector3(0, 0, 0);
  const sun = new THREE.Vector3(1, 1, 1);
  sun.normalize();

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  context = canvas.getContext('2d');
  context.fillStyle = '#000';
  context.fillRect(0, 0, width, height);

  image = context.getImageData(0, 0, canvas.width, canvas.height);
  imageData = image.data;

  for (let i = 0, j = 0, l = imageData.length; i < l; i += 4, j++) {
    vector3.x = data[j - 2] - data[j + 2];
    vector3.y = 2;
    vector3.z = data[j - width * 2] - data[j + width * 2];
    vector3.normalize();

    shade = vector3.dot(sun);

    // Color Palette: Greenish!
    // Base Green: 34, 139, 34 (ForestGreen-ish)
    // Variation based on height (data[j]) and Shade
    
    // High points (tips) lighter, low points darker
    const r = 50 + shade * 50; 
    const g = 120 + shade * 80 + data[j] * 0.5; // Green dominates
    const b = 50 + shade * 50;
    
    imageData[i] = r;
    imageData[i + 1] = g;
    imageData[i + 2] = b;
    imageData[i + 3] = 255;
  }

  context.putImageData(image, 0, 0);

  // Scale up 4x for smoother look
  const canvasScaled = document.createElement('canvas');
  canvasScaled.width = width * 4;
  canvasScaled.height = height * 4;

  context = canvasScaled.getContext('2d');
  context.scale(4, 4);
  context.drawImage(canvas, 0, 0);

  image = context.getImageData(0, 0, canvasScaled.width, canvasScaled.height);
  imageData = image.data;

  // Add noise
  for (let i = 0, l = imageData.length; i < l; i += 4) {
    const v = ~~(Math.random() * 5);
    imageData[i] += v;
    imageData[i + 1] += v;
    imageData[i + 2] += v;
  }

  context.putImageData(image, 0, 0);
  return canvasScaled;
}

function generateField () {
  const positions = [];
  const uvs = [];
  const indices = [];
  const colors = [];

  for (let i = 0; i < BLADE_COUNT; i++) {
    const VERTEX_COUNT = 5;
    const surfaceMin = PLANE_SIZE / 2 * -1;
    const surfaceMax = PLANE_SIZE / 2;
    const radius = PLANE_SIZE / 2;

    const r = radius * Math.sqrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);

    const pos = new THREE.Vector3(x, 0, y);

    const uv = [convertRange(pos.x, surfaceMin, surfaceMax, 0, 1), convertRange(pos.z, surfaceMin, surfaceMax, 0, 1)];

    const blade = generateBlade(pos, i * VERTEX_COUNT, uv);
    blade.verts.forEach(vert => {
      positions.push(...vert.pos);
      uvs.push(...vert.uv);
      colors.push(...vert.color);
    });
    blade.indices.forEach(indice => indices.push(indice));
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  geom.computeFaceNormals();

  const mesh = new THREE.Mesh(geom, grassMaterial);
  scene.add(mesh);
}

function generateBlade (center, vArrOffset, uv) {
  const MID_WIDTH = BLADE_WIDTH * 0.5;
  const TIP_OFFSET = 0.1;
  const height = BLADE_HEIGHT + (Math.random() * BLADE_HEIGHT_VARIATION);

  const yaw = Math.random() * Math.PI * 2;
  const yawUnitVec = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
  const tipBend = Math.random() * Math.PI * 2;
  const tipBendUnitVec = new THREE.Vector3(Math.sin(tipBend), 0, -Math.cos(tipBend));

  // Find the Bottom Left, Bottom Right, Top Left, Top right, Top Center vertex positions
  const bl = new THREE.Vector3().addVectors(center, new THREE.Vector3().copy(yawUnitVec).multiplyScalar((BLADE_WIDTH / 2) * 1));
  const br = new THREE.Vector3().addVectors(center, new THREE.Vector3().copy(yawUnitVec).multiplyScalar((BLADE_WIDTH / 2) * -1));
  const tl = new THREE.Vector3().addVectors(center, new THREE.Vector3().copy(yawUnitVec).multiplyScalar((MID_WIDTH / 2) * 1));
  const tr = new THREE.Vector3().addVectors(center, new THREE.Vector3().copy(yawUnitVec).multiplyScalar((MID_WIDTH / 2) * -1));
  const tc = new THREE.Vector3().addVectors(center, new THREE.Vector3().copy(tipBendUnitVec).multiplyScalar(TIP_OFFSET));

  tl.y += height / 2;
  tr.y += height / 2;
  tc.y += height;

  // Vertex Colors
  const black = [0, 0, 0];
  const gray = [0.5, 0.5, 0.5];
  const white = [1.0, 1.0, 1.0];

  const verts = [
    { pos: bl.toArray(), uv: uv, color: black },
    { pos: br.toArray(), uv: uv, color: black },
    { pos: tr.toArray(), uv: uv, color: gray },
    { pos: tl.toArray(), uv: uv, color: gray },
    { pos: tc.toArray(), uv: uv, color: white }
  ];

  const indices = [
    vArrOffset,
    vArrOffset + 1,
    vArrOffset + 2,
    vArrOffset + 2,
    vArrOffset + 4,
    vArrOffset + 3,
    vArrOffset + 3,
    vArrOffset + 1,
    vArrOffset + 2
  ];

  return { verts, indices };
}
