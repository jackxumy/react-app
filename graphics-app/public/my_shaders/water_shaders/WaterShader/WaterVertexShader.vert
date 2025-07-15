float sampleHeight(sampler2D heightMap, vec2 uv, float minHeight, float maxHeight) {
    // 从高度图采样高度值
    vec4 color = texture2D(heightMap, uv);
    // color.rg = color.rg / color.a;
    vec2 heightSample = 255.0 * color.rg;
    float alpha = (256.0 * heightSample.x + heightSample.y) / 65535.0;
    return mix(minHeight, maxHeight, alpha);
}

float getHeight(vec2 uv, sampler2D heightMap, vec2 heightMapSize, float minHeight, float maxHeight) {
    // return sampleHeight(heightMap, uv, minHeight, maxHeight);

    vec2 uvTopLeft = floor(uv * heightMapSize) / heightMapSize;

    float offsetX = 1.0 / heightMapSize.x;
    float offsetY = 1.0 / heightMapSize.y;
    float zTopLeft = sampleHeight(heightMap, uvTopLeft + vec2(0.0, 0.0), minHeight, maxHeight);
    float zTopRight = sampleHeight(heightMap, uvTopLeft + vec2(offsetX, 0.0), minHeight, maxHeight);
    float zBottomLeft = sampleHeight(heightMap, uvTopLeft + vec2(0.0, offsetY), minHeight, maxHeight);
    float zBottomRight = sampleHeight(heightMap, uvTopLeft + vec2(offsetX, offsetY), minHeight, maxHeight);

    vec2 f = fract(uv * heightMapSize);
    float height = mix(mix(zTopLeft, zTopRight, f.x), mix(zBottomLeft, zBottomRight, f.x), f.y);
    return height;
}

vec3 getNormalHeight(vec2 uv, sampler2D heightMap, vec2 heightMapSize, float minHeight, float maxHeight) {

    float offsetX = 1.0 / heightMapSize.x;
    float offsetY = 1.0 / heightMapSize.y;
    float heightL = sampleHeight(heightMap, uv - vec2(offsetX, 0.0), minHeight, maxHeight);
    float heightR = sampleHeight(heightMap, uv + vec2(offsetX, 0.0), minHeight, maxHeight);
    float heightB = sampleHeight(heightMap, uv - vec2(0.0, offsetY), minHeight, maxHeight);
    float heightT = sampleHeight(heightMap, uv + vec2(0.0, offsetY), minHeight, maxHeight);

    vec3 normal = vec3( heightR - heightL, 2.0 * offsetX,  heightT - heightB );
    return normal;
}

// 顶点着色器代码

uniform float timeStep;
uniform float minWaterHeightBefore;
uniform float maxWaterHeightBefore;
uniform float minWaterHeightAfter;
uniform float maxWaterHeightAfter;
uniform float minTerrainHeight;
uniform float maxTerrainHeight;
uniform sampler2D huvMapBefore;
uniform sampler2D huvMapAfter;
uniform sampler2D terrainMap;
uniform vec2 huvMapSize;
uniform vec2 terrainMapSize;

varying float waterDepth;
varying float waterHeight;
varying vec2 vUv;

void main() {
    vUv = uv;
    float terrainHeight = getHeight(uv, terrainMap, terrainMapSize, minTerrainHeight, maxTerrainHeight);

    float waterHeight0 = getHeight(uv, huvMapBefore, huvMapSize, minWaterHeightBefore, maxWaterHeightBefore);
    if(waterHeight0 < 0.001)  waterHeight0 = 0.0;

    float waterHeight1 = getHeight(uv, huvMapAfter, huvMapSize, minWaterHeightAfter, maxWaterHeightAfter);
    if(waterHeight1 < 0.001)  waterHeight1 = 0.0;
    
    
    waterHeight = mix(waterHeight0, waterHeight1, timeStep);
    waterDepth = waterHeight - terrainHeight;

    vec3 position = position.xyz + vec3(0, 0, waterHeight);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

    gl_Position.z -= 0.002;
}