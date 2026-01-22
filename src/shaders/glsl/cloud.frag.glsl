uniform sampler2D cloudTexture;
uniform float opacity;

varying vec2 vUv;

void main() {
  vec4 texColor = texture2D(cloudTexture, vUv);
  
  // Convert to grayscale to determine cloud density
  float gray = (texColor.r + texColor.g + texColor.b) / 3.0;
  
  // Invert and use as alpha - darker areas = more cloud = more opaque
  // Light/white areas = sky = transparent
  float cloudAlpha = 1.0 - gray;
  
  // Boost the contrast so clouds are more defined
  cloudAlpha = smoothstep(0.1, 0.6, cloudAlpha);
  
  // Apply base opacity
  cloudAlpha *= opacity;
  
  // Cloud color - soft white with slight blue tint
  vec3 cloudColor = vec3(1.0, 1.0, 1.0);
  
  gl_FragColor = vec4(cloudColor, cloudAlpha);
}
