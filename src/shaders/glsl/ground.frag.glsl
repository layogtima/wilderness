uniform sampler2D cloudTexture;
uniform vec3 groundColor;
uniform float iTime;

varying vec2 vUv;
varying vec2 cloudUV;
varying vec3 vNormal;

void main() {
  // Base mud color
  vec3 color = groundColor;
  
  // Simple diffuse lighting
  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
  float diffuse = max(dot(vNormal, lightDir), 0.0);
  color *= 0.6 + diffuse * 0.5;
  
  // Mix in cloud shadows (same as grass shader)
  vec3 cloudShadow = texture2D(cloudTexture, cloudUV).rgb;
  color = mix(color, color * cloudShadow, 0.4);
  
  gl_FragColor.rgb = color;
  gl_FragColor.a = 1.0;
}
