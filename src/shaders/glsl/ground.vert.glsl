varying vec2 vUv;
varying vec2 cloudUV;
varying vec3 vNormal;
varying vec3 vWorldPosition;

uniform float iTime;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  
  // Get world position for cloud shadow calculation
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  
  // Cloud shadow UV based on world position (syncs with grass)
  // Scale matches the grass UV range (PLANE_SIZE = 60, so -30 to 30)
  cloudUV = worldPos.xz / 60.0 + 0.5;
  cloudUV.x += iTime / 20000.0;
  cloudUV.y += iTime / 10000.0;

  vec4 mvPosition = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = mvPosition;
}
