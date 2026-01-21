varying vec2 vUv;
varying vec2 cloudUV;
varying vec3 vNormal;

uniform float iTime;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  
  // Cloud shadow UV - scrolls over time like the grass
  cloudUV = uv * 2.0; // Scale for ground coverage
  cloudUV.x += iTime / 20000.0;
  cloudUV.y += iTime / 10000.0;

  vec4 mvPosition = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = mvPosition;
}
