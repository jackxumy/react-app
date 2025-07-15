
float GammaToLinear(float c)
{
    return pow( c, 2.2 );
}

float LinearToGamma(float c)
{
    return pow( c, 1.0 / 2.2 );
}

float SRGBToLinear(float c)
{
    return ( c < 0.04045 ) ? c * 0.0773993808 : pow( c * 0.9478672986 + 0.0521327014, 2.4 );
}

float LinearToSRGB(float c) {
    return ( c < 0.0031308 ) ? c * 12.92 : 1.055 * ( pow( c, 0.41666 ) ) - 0.055;
}

vec3 SRGBToLinear(vec3 c)
{
    float r = SRGBToLinear(c.r);
    float g = SRGBToLinear(c.g);
    float b = SRGBToLinear(c.b);
    return vec3(r,g,b);
} 

vec4 SRGBToLinear(vec4 c)
{
    return vec4(SRGBToLinear(c.rgb),c.a);
} 

vec3 LinearToSRGB(vec3 c)
{
    float r = LinearToSRGB(c.r);
    float g = LinearToSRGB(c.g);
    float b = LinearToSRGB(c.b);
    return vec3(r,g,b);
} 

vec4 LinearToSRGB(vec4 c)
{
    return vec4(LinearToSRGB(c.rgb),c.a);
} 



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

// 定义常量
#define PI 3.14159265359

// 获取水流方向
vec2 GetFlowDirection(sampler2D flowMap, vec2 uv, vec2 offset, float gridResolution) {
    uv *= gridResolution;
    vec2 offset1 = offset * 0.5;
    vec2 offset2 = (1.0 - offset) * 0.5;
    uv = floor(uv + offset1);
    uv += offset2;
    uv /= gridResolution;
    vec2 direction = texture2D(flowMap, uv).rg;
    return direction;
}
            
vec2 GetFlowDirection(sampler2D huvMap, float minVelocityU, float maxVelocityU, float minVelocityV, float maxVelocityV, 
                        vec2 uv, vec2 offset, float gridResolution)
{
    uv *= gridResolution;
    vec2 offset1 = offset * 0.5;
    vec2 offset2 = (1.0 - offset) * 0.5;
    uv = floor(uv + offset1);
    uv += offset2;
    uv /= gridResolution;
    vec4 huv = texture2D(huvMap, uv);

    // huv.b = huv.b / huv.a

    float velocityU = mix(minVelocityU, maxVelocityU, huv.b);
    float velocityV = mix(minVelocityV, maxVelocityV, huv.a);
    vec2 direction = vec2(velocityU, velocityV);
    return direction;
}

// 旋转 UV 坐标
vec2 RotateUV(vec2 direction, vec2 uv, float gridResolution, float flowVelocityStrength, float wavePeriod, float time) {
    vec2 unitDir = normalize(direction);
    mat2 rotationMatrix = mat2(unitDir.y, unitDir.x, -unitDir.x, unitDir.y);
    // mat2 rotationMatrix = mat2(unitDir.y, -unitDir.x, unitDir.x, unitDir.y);
    vec2 newUV = rotationMatrix * uv;

    float timeY = time * 0.001 * 2.0;
    float dirLength = length(direction);
    dirLength *= flowVelocityStrength;
    float strength = timeY * dirLength;

    newUV = newUV * (gridResolution * wavePeriod) - vec2(0, strength);
    return newUV;
}

// 解包法线
vec3 UnpackNormal(vec4 packedNormal)
{
    return normalize(packedNormal.xyz * 2.0 - 1.0);
}

// 计算水流单元
void FlowCellByDir(vec2 dir1, vec2 dir2, vec2 dir3, vec2 dir4, 
                sampler2D normalMap, sampler2D displacementMap, sampler2D heightNoiseMap, sampler2D heightNoiseNormalMap,
                float lerpValue, vec2 uv, float gridResolution, float flowVelocityStrength, float wavePeriod, float time,
                out vec3 finalNormal, out float finalDisplacement, out vec2 finalVelocity) 
{

    vec2 newUV1 = RotateUV(dir1, uv, gridResolution, flowVelocityStrength, wavePeriod, time);
    vec2 newUV2 = RotateUV(dir2, uv, gridResolution, flowVelocityStrength, wavePeriod, time);
    vec2 newUV3 = RotateUV(dir3, uv, gridResolution, flowVelocityStrength, wavePeriod, time);
    vec2 newUV4 = RotateUV(dir4, uv, gridResolution, flowVelocityStrength, wavePeriod, time);

    float displacement1 = texture2D(displacementMap, newUV1).r;
    float displacement2 = texture2D(displacementMap, newUV2).r;
    float displacement3 = texture2D(displacementMap, newUV3).r;
    float displacement4 = texture2D(displacementMap, newUV4).r;

    vec3 normal1 = UnpackNormal(texture2D(normalMap, newUV1));
    vec3 normal2 = UnpackNormal(texture2D(normalMap, newUV2));
    vec3 normal3 = UnpackNormal(texture2D(normalMap, newUV3));
    vec3 normal4 = UnpackNormal(texture2D(normalMap, newUV4));

    float noise1 = texture2D(heightNoiseMap, newUV1).r;
    float noise2 = texture2D(heightNoiseMap, newUV2).r;
    float noise3 = texture2D(heightNoiseMap, newUV3).r;
    float noise4 = texture2D(heightNoiseMap, newUV4).r;

    vec3 noiseNormal1 = UnpackNormal(texture2D(heightNoiseNormalMap, newUV1));
    vec3 noiseNormal2 = UnpackNormal(texture2D(heightNoiseNormalMap, newUV2));
    vec3 noiseNormal3 = UnpackNormal(texture2D(heightNoiseNormalMap, newUV3));
    vec3 noiseNormal4 = UnpackNormal(texture2D(heightNoiseNormalMap, newUV4));

    displacement1 = (displacement1 + noise1) * 0.5;
    displacement2 = (displacement2 + noise2) * 0.5;
    displacement3 = (displacement3 + noise3) * 0.5;
    displacement4 = (displacement4 + noise4) * 0.5;

    normal1 = normalize(normal1 + noiseNormal1);
    normal2 = normalize(normal2 + noiseNormal2);
    normal3 = normalize(normal3 + noiseNormal3);
    normal4 = normalize(normal4 + noiseNormal4);

    vec2 uvFrac = fract(uv * gridResolution);
    uvFrac *= 2.0 * PI;
    uvFrac = cos(uvFrac) * 0.5 + 0.5;

    float w1 = (1.0 - uvFrac.r) * (1.0 - uvFrac.g);
    float w2 = uvFrac.r * (1.0 - uvFrac.g);
    float w3 = (1.0 - uvFrac.r) * uvFrac.g;
    float w4 = uvFrac.r * uvFrac.g;

    finalNormal = normalize(w1 * normal1 + w2 * normal2 + w3 * normal3 + w4 * normal4);
    finalDisplacement = w1 * displacement1 + w2 * displacement2 + w3 * displacement3 + w4 * displacement4;
    finalVelocity = w1 * dir1 + w2 * dir2 + w3 * dir3 + w4 * dir4;
}

// 计算水流单元
void FlowCell(sampler2D flowMap, sampler2D normalMap, sampler2D displacementMap, sampler2D heightNoiseMap, sampler2D heightNoiseNormalMap,
                float lerpValue, vec2 uv, float gridResolution, float flowVelocityStrength, float wavePeriod, float time,
                out vec3 finalNormal, out float finalDisplacement, out vec2 finalVelocity) 
{
    vec2 dir1 = GetFlowDirection(flowMap, uv, vec2(0.0, 0.0), gridResolution);
    vec2 dir2 = GetFlowDirection(flowMap, uv, vec2(1.0, 0.0), gridResolution);
    vec2 dir3 = GetFlowDirection(flowMap, uv, vec2(0.0, 1.0), gridResolution);
    vec2 dir4 = GetFlowDirection(flowMap, uv, vec2(1.0, 1.0), gridResolution);

    FlowCellByDir(dir1, dir2, dir3, dir4, normalMap, displacementMap, heightNoiseMap, heightNoiseNormalMap,
                    lerpValue, uv, gridResolution, flowVelocityStrength, wavePeriod, time,
                    finalNormal, finalDisplacement, finalVelocity);
}

void FlowCell(sampler2D huvMap, float minVelocityU, float maxVelocityU, float minVelocityV, float maxVelocityV, 
                sampler2D normalMap, sampler2D displacementMap, sampler2D heightNoiseMap, sampler2D heightNoiseNormalMap,
                float lerpValue, vec2 uv, float gridResolution, float flowVelocityStrength, float wavePeriod, float time,
                out vec3 finalNormal, out float finalDisplacement, out vec2 finalVelocity)
{
    vec2 dir1 = GetFlowDirection(huvMap, minVelocityU, maxVelocityU, minVelocityV, maxVelocityV, uv, vec2(0.0, 0.0), gridResolution);
    vec2 dir2 = GetFlowDirection(huvMap, minVelocityU, maxVelocityU, minVelocityV, maxVelocityV, uv, vec2(1.0, 0.0), gridResolution);
    vec2 dir3 = GetFlowDirection(huvMap, minVelocityU, maxVelocityU, minVelocityV, maxVelocityV, uv, vec2(0.0, 1.0), gridResolution);
    vec2 dir4 = GetFlowDirection(huvMap, minVelocityU, maxVelocityU, minVelocityV, maxVelocityV, uv, vec2(1.0, 1.0), gridResolution);

    FlowCellByDir(dir1, dir2, dir3, dir4, normalMap, displacementMap, heightNoiseMap, heightNoiseNormalMap,
                    lerpValue, uv, gridResolution, flowVelocityStrength, wavePeriod, time,
                    finalNormal, finalDisplacement, finalVelocity);
}
        
vec3 NormalStrength(vec3 normal, float strength) {
    return normalize(vec3(normal.x, normal.y, normal.z * strength));
}

// 获取方向性水流
void GetDirectionalFlow(vec2 uv, sampler2D huvMap, float minVelocityU, float maxVelocityU, float minVelocityV, float maxVelocityV, 
                        sampler2D normalMap, sampler2D displacementMap, sampler2D heightNoiseMap, sampler2D heightNoiseNormalMap,
                        float gridResolutionA, float flowVelocityStrengthA, float wavePeriodA,
                        float gridResolutionB, float flowVelocityStrengthB, float wavePeriodB,
                        float gridResolutionC, float flowVelocityStrengthC, float wavePeriodC,
                        float gridResolutionD, float flowVelocityStrengthD, float wavePeriodD,
                        float time, float normalStrength,
                        out vec3 finalNormal, out float finalDisplacement, out vec2 finalVelocity) {
    vec3 curNormal;
    float curDisplacement;
    vec2 curVelocity;

    FlowCell(huvMap, minVelocityU, maxVelocityU, minVelocityV, maxVelocityV, normalMap, displacementMap, heightNoiseMap, heightNoiseNormalMap, 0.0, uv, gridResolutionA, flowVelocityStrengthA, wavePeriodA, time, curNormal, curDisplacement, curVelocity);
    finalNormal = curNormal;
    finalDisplacement = curDisplacement;
    finalVelocity = curVelocity;

    FlowCell(huvMap, minVelocityU, maxVelocityU, minVelocityV, maxVelocityV, normalMap, displacementMap, heightNoiseMap, heightNoiseNormalMap, 0.0, uv, gridResolutionB, flowVelocityStrengthB, wavePeriodB, time, curNormal, curDisplacement, curVelocity);
    finalNormal += curNormal;
    finalDisplacement += curDisplacement;
    finalVelocity += curVelocity;

    FlowCell(huvMap, minVelocityU, maxVelocityU, minVelocityV, maxVelocityV, normalMap, displacementMap, heightNoiseMap, heightNoiseNormalMap, 0.0, uv, gridResolutionC, flowVelocityStrengthC, wavePeriodC, time, curNormal, curDisplacement, curVelocity);
    finalNormal += curNormal;
    finalDisplacement += curDisplacement;
    finalVelocity += curVelocity;

    FlowCell(huvMap, minVelocityU, maxVelocityU, minVelocityV, maxVelocityV, normalMap, displacementMap, heightNoiseMap, heightNoiseNormalMap, 0.0, uv, gridResolutionD, flowVelocityStrengthD, wavePeriodD, time, curNormal, curDisplacement, curVelocity);
    finalNormal += curNormal;
    finalDisplacement += curDisplacement;
    finalVelocity += curVelocity;

    finalNormal = normalize(finalNormal);
    finalDisplacement *= 0.25;
    finalVelocity *= 0.25;
}

// 片段着色器代码
uniform vec3 lightDirection;
uniform vec2 huvMapSize;
uniform vec2 terrainMapSize;

uniform float minWaterHeightBefore;
uniform float maxWaterHeightBefore;
uniform float minWaterHeightAfter;
uniform float maxWaterHeightAfter;
uniform vec3 lightColor;
uniform float waterAlpha;

uniform vec3 waterShallowColor;
uniform vec3 waterDeepColor;
uniform float waterShallowAlpha;
uniform float waterDeepAlpha;
uniform float depthDensity;
uniform float minWaterDepth;
uniform float maxWaterDepth;
uniform float minWaterDepthAlpha;
uniform float maxWaterDepthAlpha;
uniform float time;
uniform float timeStep;
uniform float swapTimeMinRange;
uniform float swapTimeMaxRange;
uniform float normalStrength;
uniform float waterNormalY;
uniform sampler2D normalMap;
uniform sampler2D displacementMap;
uniform sampler2D heightNoiseMap;
uniform sampler2D heightNoiseNormalMap;
uniform sampler2D huvMapBefore;
uniform sampler2D huvMapAfter;
uniform sampler2D rampMap;              
uniform float minVelocityUBefore;
uniform float maxVelocityUBefore;
uniform float minVelocityVBefore;
uniform float maxVelocityVBefore;
uniform float minVelocityUAfter;
uniform float maxVelocityUAfter;
uniform float minVelocityVAfter;
uniform float maxVelocityVAfter;
uniform float gridResolutionA;
uniform float wavePeriodA;
uniform float flowVelocityStrengthA;
uniform float gridResolutionB;
uniform float wavePeriodB;
uniform float flowVelocityStrengthB;
uniform float gridResolutionC;
uniform float wavePeriodC;
uniform float flowVelocityStrengthC;
uniform float gridResolutionD;
uniform float wavePeriodD;
uniform float flowVelocityStrengthD;
uniform float foamMinEdge;
uniform float foamMaxEdge;
uniform float foamVelocityMaskMinEdge;
uniform float foamVelocityMaskMaxEdge;
uniform sampler2D foamTexture;

varying float waterDepth;
varying float waterHeight;
varying vec2 vUv;

float remap(float value, vec2 fromRange, vec2 toRange) 
{
    return ((value - fromRange.x) / (fromRange.y - fromRange.x)) * (toRange.y - toRange.x) + toRange.x;
}

void FlowStrength()
{
    float waterRemap = remap(waterDepth, vec2(minWaterDepth, maxWaterDepth), vec2(0.0, 1.0));
    vec2 rampUV = vec2(clamp(waterRemap, 0.0, 1.0), 0.5);
    vec3 waterDepthStrength = texture2D(rampMap, rampUV).rgb;

    float alpha = waterAlpha;

    gl_FragColor = vec4(waterDepthStrength, alpha);
}

void DirectionalFlow() 
{
    // SwapTime用于两个时间段的水面的平滑切换
    float lerpValue = smoothstep(swapTimeMinRange, swapTimeMaxRange, timeStep);

    vec3 currNormal, nextNormal;
    float currDisplacement, nextDisplacement;
    vec2 currVelocity, nextVelocity;
    GetDirectionalFlow(vUv, huvMapBefore, minVelocityUBefore, maxVelocityUBefore, minVelocityVBefore, maxVelocityVBefore, 
                        normalMap, displacementMap, heightNoiseMap, heightNoiseNormalMap,
                        gridResolutionA, flowVelocityStrengthA, wavePeriodA,
                        gridResolutionB, flowVelocityStrengthB, wavePeriodB,
                        gridResolutionC, flowVelocityStrengthC, wavePeriodC,
                        gridResolutionD, flowVelocityStrengthD, wavePeriodD,
                        time, normalStrength,
                        currNormal, currDisplacement, currVelocity);

    GetDirectionalFlow(vUv, huvMapAfter, minVelocityUAfter, maxVelocityUAfter, minVelocityVAfter, maxVelocityVAfter, 
                        normalMap, displacementMap, heightNoiseMap, heightNoiseNormalMap,
                        gridResolutionA, flowVelocityStrengthA, wavePeriodA,
                        gridResolutionB, flowVelocityStrengthB, wavePeriodB,
                        gridResolutionC, flowVelocityStrengthC, wavePeriodC,
                        gridResolutionD, flowVelocityStrengthD, wavePeriodD,
                        time, normalStrength,
                        nextNormal, nextDisplacement, nextVelocity);


    vec3 finalNormal = mix(currNormal, nextNormal, lerpValue);
    finalNormal = NormalStrength(finalNormal , normalStrength);
    
    // 获取速度场显示的遮罩
    float currVelocityMask = smoothstep(foamVelocityMaskMinEdge, foamVelocityMaskMaxEdge, length(currVelocity));
    float nextVelocityMask = smoothstep(foamVelocityMaskMinEdge, foamVelocityMaskMaxEdge, length(nextVelocity));


    // 计算法线
    vec3 normalBefore = getNormalHeight(vUv, huvMapBefore, huvMapSize, minWaterHeightBefore, maxWaterHeightBefore);
    vec3 normalAfter = getNormalHeight(vUv, huvMapAfter, huvMapSize, minWaterHeightAfter, maxWaterHeightAfter);
    vec3 normalHeight = mix(normalBefore, normalAfter, lerpValue);
    vec3 normal = normalize(vec3(normalHeight.x, waterNormalY, normalHeight.z));
    vec3 tangent = vec3(1.0, 0.0, 0.0);
    vec3 bitangent = cross(normal, tangent);
    tangent = cross(bitangent, normal);
    // vec3 tangent = normalize(vec3(1.0, normalHeight.x, 0.0));
    // vec3 bitangent = normalize(vec3(0.0, normalHeight.z, 1.0));
    mat3 tbnMatrix = mat3(tangent, bitangent, normal);
    vec3 normalWS = normalize(tbnMatrix * finalNormal);


    // 深浅水颜色
    float waterHeight = waterDepth;
    waterHeight /= depthDensity;
    waterHeight = clamp(waterHeight, 0.0, 1.0);
    vec3 waterColor = mix(waterShallowColor, waterDeepColor, waterHeight);
    float waterColorAlpha = mix(waterShallowAlpha, waterDeepAlpha, waterHeight);
    // float alpha = waterColorAlpha * smoothstep(minWaterDepthAlpha, maxWaterDepthAlpha, waterDepth);
    float alpha = waterAlpha * mix(waterShallowAlpha, waterDeepAlpha, waterHeight);

    // 法线光照
    float NdotL = dot(normalWS, lightDirection);
    float halfLambert = 0.5 * NdotL + 0.5;
    vec3 diffuseColor = waterColor * lightColor * halfLambert;

    vec3 finalColor = diffuseColor.rgb;

    // 浪尖泡沫
    float foamValue = texture2D(foamTexture, vUv * 500.).r;
    foamValue = remap(foamValue, vec2(0.0,1.0), vec2(0.2, 1.0));
    float currFoamValue = foamValue * smoothstep(foamMinEdge, foamMaxEdge, currDisplacement);
    float nextFoamValue = foamValue * smoothstep(foamMinEdge, foamMaxEdge, nextDisplacement);
    vec3 currFoamColor = vec3(currFoamValue) * currVelocityMask;
    vec3 nextFoamColor = vec3(nextFoamValue) * nextVelocityMask;
    
    vec3 foamColor = mix(currFoamColor, nextFoamColor, lerpValue);

    finalColor = finalColor + foamColor;
    finalColor = LinearToSRGB(finalColor);
    gl_FragColor = vec4(finalColor, alpha);
}
    
void main() 
{
    if(waterDepth < -0.001)
        discard;
    DirectionalFlow();
    // FlowStrength();
}
