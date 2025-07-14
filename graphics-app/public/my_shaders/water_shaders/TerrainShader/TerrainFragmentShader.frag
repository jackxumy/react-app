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
    // 从高度图采样高度值 uv:纹理的坐标
    vec4 color = texture2D(heightMap, uv);
    // color.rg = color.rg / color.a;
    // color里存的是像素在0-255间的归一化值
    vec2 heightSample = 255.0 * color.rg;
    // 高低位分开存储高程信息，这里返回归一化的高程(因为原本存储的就是归一化的数据（0，1）归一化)
    float alpha = (256.0 * heightSample.x + heightSample.y) / 65535.0;
    // 在这里使用插值处理: mix(x, y, a), result = x * (1.0 - a) + y * a 得到真实值
    return mix(minHeight, maxHeight, alpha);
}

float getHeight(vec2 uv, sampler2D heightMap, vec2 heightMapSize, float minHeight, float maxHeight) {
    // return sampleHeight(heightMap, uv, minHeight, maxHeight);
    // 这里先得左上角点的连续归一化纹理坐标，
    // 首先，利用二维归一化坐标乘以图片尺寸，
    // 取整后得到真实像素坐标，然后归一化，得到映射后的归一化像素坐标
    // 
    /*
        在高度图中，每个像素表示一个高度值。
        如果直接使用 uv 进行采样，可能会导致采样点落在像素之间的位置，从而引入误差。
        通过计算 uvTopLeft，可以将 uv 对齐到像素网格上，确保采样点位于像素上。
    */
    vec2 uvTopLeft = floor(uv * heightMapSize) / heightMapSize;
    
    // offsetX 和 offsetY：分别表示一个像素在纹理（归一化）坐标中的宽度和高度
    float offsetX = 1.0 / heightMapSize.x;
    float offsetY = 1.0 / heightMapSize.y;

    // 通过对四个角点进行采样，得到它们的高度值，这里采样不是一个九宫格，而是是四格
    float zTopLeft = sampleHeight(heightMap, uvTopLeft + vec2(0.0, 0.0), minHeight, maxHeight);
    float zTopRight = sampleHeight(heightMap, uvTopLeft + vec2(offsetX, 0.0), minHeight, maxHeight);
    float zBottomLeft = sampleHeight(heightMap, uvTopLeft + vec2(0.0, offsetY), minHeight, maxHeight);
    float zBottomRight = sampleHeight(heightMap, uvTopLeft + vec2(offsetX, offsetY), minHeight, maxHeight);
    
    // 提取坐标小数位: fract(x) = x - floor(x)
    // 这里的小数位，即uv落在像素之间产生的误差，小数位x就是在左边与右边像素之间的归一化插值
    vec2 f = fract(uv * heightMapSize);

    // 通过双线性插值计算最终高度值
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
    // 计算地形纹理法线
    /*
        offsetX 的含义：
        offsetX = 1.0 / heightMapSize.x，表示一个像素在纹理坐标中的宽度。
        它的值与高度图的分辨率成反比，分辨率越高，offsetX 越小。
        2.0 * offsetX 的作用：
        通过乘以一个常数（这里是 2.0），可以调整 y 分量的大小，使其与 x 和 z 分量的比例更加合理。
        这个比例的选择通常是经验性的，目的是让法向量的方向更接近真实的表面法线。
        为什么是 2.0 而不是其他值：
        具体的比例因应用场景而异，2.0 是一个常见的经验值，适用于大多数高度图的法向量计算。
        如果高度图的高度范围较大或较小，可以调整这个比例以适应具体的需求。
    */
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
    // 计算表面纹理法向量
    vec3 normalHeight = getNormalHeight(vUv, terrainMap, terrainMapSize, minTerrainHeight, maxTerrainHeight);
    // 按照规定的Y重制法向量
    vec3 vNormal = normalize(vec3(normalHeight.x, terrainNormalY, normalHeight.z));
    // 与光线向量点积得到光照强度
    float NdotL = dot(vNormal, lightDirection);
    /*
    Half-Lambert的改进：
    Half-Lambert通过对NdotL进行线性变换，将其值范围从[-1, 1]调整到[0, 1]，从而避免负值。
    具体公式为：0.5 * NdotL + 0.5。
    当NdotL为1时，结果为1（最大光照强度）。
    当NdotL为0时，结果为0.5（中等光照强度）。
    当NdotL为-1时，结果为0（无光照）。

    视觉效果的意义：
    Half-Lambert模型的主要优点是即使光源位于表面背面，
    也能保持一定的光照强度（通常是零），从而避免完全黑暗的区域。
    这种处理方式可以使场景看起来更加柔和，特别是在卡通渲染或非写实渲染中，
    Half-Lambert模型常被用来增强视觉效果。
    */
    float halfLambert = 0.5 * NdotL + 0.5;
    // 表面颜色乘以光照颜色，乘以光照强度
    vec3 color = terrainColor * lightColor * halfLambert;
    // 转换色彩空间
    color = LinearToSRGB(color);
    // 指定当前片段的最终颜色
    gl_FragColor = vec4(color, 1.0);
}