import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';
import grassShader from './shaders/grass.js';
import groundShader from './shaders/ground.js';
import cloudShader from './shaders/cloud.js';

// Shared Perlin noise instance for terrain
const terrainPerlin = new ImprovedNoise();
const TERRAIN_NOISE_SCALE = 0.05; // Slightly larger features
const TERRAIN_HEIGHT_SCALE = 8.0; // MUCH more dramatic hills!
const TERRAIN_PLATEAU_HEIGHT = 2.0; // Higher base dome
const GRASS_HEIGHT_THRESHOLD = 3.5; // No grass above this height (bare peaks!)

// Random terrain seed - changes every refresh!
const TERRAIN_SEED = Math.random() * 1000;

// Get terrain height at any x,z position
function getTerrainHeight(x, z, radius) {
  const distFromCenter = Math.sqrt(x * x + z * z) / radius;
  
  // Generate noise-based height - main rolling hills (with random seed offset)
  let height = terrainPerlin.noise(x * TERRAIN_NOISE_SCALE + TERRAIN_SEED, z * TERRAIN_NOISE_SCALE, 0.5) * TERRAIN_HEIGHT_SCALE;
  
  // Add a second layer of medium bumps
  height += terrainPerlin.noise(x * TERRAIN_NOISE_SCALE * 2.5 + TERRAIN_SEED, z * TERRAIN_NOISE_SCALE * 2.5, 1.0) * (TERRAIN_HEIGHT_SCALE * 0.5);
  
  // Add a third layer of small detail bumps
  height += terrainPerlin.noise(x * TERRAIN_NOISE_SCALE * 6 + TERRAIN_SEED, z * TERRAIN_NOISE_SCALE * 6, 2.0) * (TERRAIN_HEIGHT_SCALE * 0.15);
  
  // Smooth falloff at edges
  const edgeFalloff = 1 - Math.pow(Math.min(distFromCenter, 1), 2);
  height *= edgeFalloff;
  
  // Add dome/plateau base shape
  const plateauHeight = (1 - distFromCenter * distFromCenter) * TERRAIN_PLATEAU_HEIGHT;
  
  return Math.max(0, height + plateauHeight);
}

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

// Ground Shader (shares cloud texture with grass)
const groundUniforms = {
  cloudTexture: { value: cloudTexture },
  groundColor: { value: new THREE.Color(0x8B6914) }, // Mud brown
  iTime: timeUniform
};

const groundMaterial = new THREE.ShaderMaterial({
  uniforms: groundUniforms,
  vertexShader: groundShader.vert,
  fragmentShader: groundShader.frag,
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

// Cloud tracking for animation
const cloudMeshes = [];
const CLOUD_SPEED = { x: 0.5, z: 0.25 }; // Units per second
const CLOUD_HEIGHT = 25;
const CLOUD_AREA = 400; // How far clouds extend

generateEnvironment();
generateField();
generateClouds();

const animate = function () {
  requestAnimationFrame(animate);

  const time = performance.now();
  const delta = (time - prevTime) / 1000;
  
  const elapsedTime = Date.now() - startTime;
  grassUniforms.iTime.value = elapsedTime;
  
  // Animate clouds overhead
  cloudMeshes.forEach(cloud => {
    cloud.position.x += CLOUD_SPEED.x * delta;
    cloud.position.z += CLOUD_SPEED.z * delta;
    
    // Wrap clouds around when they go too far
    if (cloud.position.x > CLOUD_AREA / 2) cloud.position.x = -CLOUD_AREA / 2;
    if (cloud.position.z > CLOUD_AREA / 2) cloud.position.z = -CLOUD_AREA / 2;
  });

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

    // Terrain following - get ground height at current position
    const groundHeight = getTerrainHeight(camera.position.x, camera.position.z, PLANE_SIZE / 2);
    const playerHeight = 1.5; // Eye level above ground
    const targetY = groundHeight + playerHeight;
    
    // Jump Physics - land on terrain
    if (camera.position.y < targetY) {
      velocity.y = 0;
      camera.position.y = targetY;
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
  // Create a high-subdivision plane for smooth terrain
  const radius = PLANE_SIZE / 2;
  const subdivisions = 128; // High subdivision for smooth rolling hills
  
  // Use PlaneBufferGeometry with proper subdivisions
  const geometry = new THREE.PlaneBufferGeometry(
    PLANE_SIZE, PLANE_SIZE, 
    subdivisions, subdivisions
  );
  geometry.rotateX(-Math.PI / 2);
  
  // Apply terrain height and clip to circle
  const vertices = geometry.attributes.position.array;
  
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i];
    const z = vertices[i + 2];
    const distFromCenter = Math.sqrt(x * x + z * z);
    
    // Only apply height within the circular area
    if (distFromCenter <= radius) {
      vertices[i + 1] = getTerrainHeight(x, z, radius);
    } else {
      // Push vertices outside circle down below view
      vertices[i + 1] = -100;
    }
  }
  
  geometry.computeVertexNormals();
  
  // Use shader material with cloud shadows
  const mesh = new THREE.Mesh(geometry, groundMaterial);
  mesh.position.y = -0.05; // Slightly below grass roots
  scene.add(mesh);
}

// ----------------------------------------------------------------------------
// Grass Field Generation
// ----------------------------------------------------------------------------

function generateField () {
  const positions = [];
  const uvs = [];
  const indices = [];
  const colors = [];

  let bladesGenerated = 0;
  const targetBlades = BLADE_COUNT;
  let attempts = 0;
  const maxAttempts = BLADE_COUNT * 3; // Prevent infinite loop
  
  while (bladesGenerated < targetBlades && attempts < maxAttempts) {
    attempts++;
    
    const VERTEX_COUNT = 5;
    const surfaceMin = PLANE_SIZE / 2 * -1;
    const surfaceMax = PLANE_SIZE / 2;
    const radius = PLANE_SIZE / 2;

    const r = radius * Math.sqrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;
    const x = r * Math.cos(theta);
    const z = r * Math.sin(theta);
    
    // Use shared terrain height function
    const finalHeight = getTerrainHeight(x, z, radius);
    
    // Skip grass on high peaks (bare mud!) with fuzzy transition
    const heightThreshold = GRASS_HEIGHT_THRESHOLD + (Math.random() - 0.5) * 1.5;
    if (finalHeight > heightThreshold) {
      continue; // No grass here - bare peak!
    }
    
    // Additional random thinning for less uniformity
    // Grass is denser in valleys, sparser on slopes
    const slopeNoise = terrainPerlin.noise(x * 0.15, z * 0.15, 5.0);
    if (Math.random() > 0.7 + slopeNoise * 0.3) {
      continue; // Random thin out for natural look
    }

    const pos = new THREE.Vector3(x, finalHeight, z);

    const uv = [convertRange(pos.x, surfaceMin, surfaceMax, 0, 1), convertRange(pos.z, surfaceMin, surfaceMax, 0, 1)];

    const blade = generateBlade(pos, bladesGenerated * VERTEX_COUNT, uv);
    blade.verts.forEach(vert => {
      positions.push(...vert.pos);
      uvs.push(...vert.uv);
      colors.push(...vert.color);
    });
    blade.indices.forEach(indice => indices.push(indice));
    bladesGenerated++;
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

// ----------------------------------------------------------------------------
// 3D Cloud Generation - Visible clouds that match the shadow texture!
// ----------------------------------------------------------------------------

function generateClouds() {
  const cloudGeometry = new THREE.PlaneBufferGeometry(150, 150);
  
  // Create multiple cloud layers at different heights and positions
  const cloudConfigs = [
    { x: 0, y: CLOUD_HEIGHT, z: 0, scale: 1.0, opacity: 0.7 },
    { x: -80, y: CLOUD_HEIGHT + 15, z: -40, scale: 1.2, opacity: 0.6 },
    { x: 60, y: CLOUD_HEIGHT + 8, z: 50, scale: 0.9, opacity: 0.65 },
    { x: -30, y: CLOUD_HEIGHT + 20, z: 80, scale: 1.1, opacity: 0.55 },
    { x: 100, y: CLOUD_HEIGHT + 5, z: -60, scale: 1.3, opacity: 0.6 },
    { x: -100, y: CLOUD_HEIGHT + 12, z: 30, scale: 1.0, opacity: 0.7 },
  ];
  
  cloudConfigs.forEach(config => {
    // Custom shader material - makes light areas transparent!
    const cloudMat = new THREE.ShaderMaterial({
      uniforms: {
        cloudTexture: { value: cloudTexture },
        opacity: { value: config.opacity }
      },
      vertexShader: cloudShader.vert,
      fragmentShader: cloudShader.frag,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    
    const cloud = new THREE.Mesh(cloudGeometry, cloudMat);
    cloud.rotation.x = -Math.PI / 2; // Face down
    cloud.position.set(config.x, config.y, config.z);
    cloud.scale.setScalar(config.scale);
    
    scene.add(cloud);
    cloudMeshes.push(cloud);
  });
}
