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


precision highp float;
uniform highp sampler2D terrainMap;
uniform vec2 terrainMapSize;
uniform float terrainNormalY;
uniform float minTerrainHeight;
uniform float maxTerrainHeight;
uniform float normalScale;

uniform vec3 terrainColor;
uniform vec3 lightColor;
uniform vec3 lightDirection;

varying vec2 vUv;
varying vec3 vPosition;


void main() {
    vec3 normalHeight = getNormalHeight(vUv, terrainMap, terrainMapSize, minTerrainHeight, maxTerrainHeight);
    vec3 vNormal = normalize(vec3(normalHeight.x, terrainNormalY, normalHeight.z));
    float NdotL = dot(vNormal, lightDirection);
    float halfLambert = 0.5 * NdotL + 0.5;
    vec3 color = terrainColor * lightColor * halfLambert;

    color = LinearToSRGB(color);
    gl_FragColor = vec4(color, 1.0);
}