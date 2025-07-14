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
    // 计算法向量
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

// 定义常量
#define PI 3.14159265359

// 获取水流方向
vec2 GetFlowDirection(sampler2D flowMap, vec2 uv, vec2 offset, float gridResolution) {
    // 将纹理坐标 uv 转换为网格坐标，乘以网格分辨率以适配网格大小
    uv *= gridResolution; // 将水流图层重新格网化分，跟新格子数
    // 这里的uv一定是归一化但对象不同，不一定是像素
    // 计算偏移量 offset1，用于将采样点偏移到网格单元的某个位置
    vec2 offset1 = offset * 0.5;

    // 计算偏移量 offset2，用于进一步调整采样点的位置
    vec2 offset2 = (1.0 - offset) * 0.5;

    // 将偏移量 offset1 应用于 uv，并取整以对齐到网格单元
    uv = floor(uv + offset1);
    /*
    假设 uv * gridResolution = (5.7, 3.2)，offset = (0.0, 0.0)
    则 offset1 = (0.0, 0.0)
    floor(5.7, 3.2) = (5.0, 3.0)，即找到了第(5,3)个网格单元的左下角
    */

    // 将偏移量 offset2 应用于 uv，进一步调整采样点的位置
    uv += offset2;
    /*
    继续上面的例子，offset = (0.0, 0.0)
    则 offset2 = (0.5, 0.5)
    (5.0, 3.0) + (0.5, 0.5) = (5.5, 3.5)，即移动到了第(5,3)个网格单元的中心
    */

    // 将网格坐标重新归一化到 [0.0, 1.0] 范围内，以便用于纹理采样
    uv /= gridResolution;

    // 从流向图 flowMap 中采样方向矢量，提取红色和绿色通道作为方向分量
    vec2 direction = texture2D(flowMap, uv).rg;

    // 返回采样得到的方向向量
    return direction;
}

// 获取流速方向
vec2 GetFlowDirection(sampler2D huvMap, float minVelocityU, float maxVelocityU, float minVelocityV, float maxVelocityV, 
                        vec2 uv, vec2 offset, float gridResolution)
{
    // 下面的采样同上
    uv *= gridResolution;
    vec2 offset1 = offset * 0.5;
    vec2 offset2 = (1.0 - offset) * 0.5;
    uv = floor(uv + offset1);
    uv += offset2;
    uv /= gridResolution;
    vec4 huv = texture2D(huvMap, uv);

    // huv.b = huv.b / huv.a

    // 得到真实速度向量
    float velocityU = mix(minVelocityU, maxVelocityU, huv.b);
    float velocityV = mix(minVelocityV, maxVelocityV, huv.a);
    vec2 direction = vec2(velocityU, velocityV);
    return direction;
}

// 旋转 UV 坐标
vec2 RotateUV(vec2 direction, vec2 uv, float gridResolution, float flowVelocityStrength, float wavePeriod, float time) {
    vec2 unitDir = normalize(direction); // unitDir归一为长为1的向量，其x,y为 cos(θ) 和 sin(θ)
    mat2 rotationMatrix = mat2(unitDir.y, unitDir.x, -unitDir.x, unitDir.y);
    // mat2 rotationMatrix = mat2(unitDir.y, -unitDir.x, unitDir.x, unitDir.y);
    vec2 newUV = rotationMatrix * uv; // 旋转对齐后的新UV（归一化）

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
    /*
        vec2 dir1, dir2, dir3, dir4：四个方向的流向矢量，分别表示水流在网格单元四个角的方向。
        sampler2D normalMap, displacementMap, heightNoiseMap, heightNoiseNormalMap：
        分别表示法线图、位移图、高度噪声图和高度噪声法线图，用于模拟水流的细节。
        float lerpValue：插值因子，用于控制动态效果的平滑程度。
        vec2 uv：纹理坐标，用于采样纹理。
        float gridResolution：网格分辨率，表示水流被划分为多少个网格单元。
        float flowVelocityStrength：水流速度的强度。
        float wavePeriod：波动周期，用于模拟水流的周期性变化。
        float time：当前时间，用于动态效果。
        out vec3 finalNormal, out float finalDisplacement, out vec2 finalVelocity：
        输出参数，分别表示水流的最终法线、位移和速度。
    */

    // 旋转纹理坐标以对齐水流方向
    vec2 newUV1 = RotateUV(dir1, uv, gridResolution, flowVelocityStrength, wavePeriod, time);
    vec2 newUV2 = RotateUV(dir2, uv, gridResolution, flowVelocityStrength, wavePeriod, time);
    vec2 newUV3 = RotateUV(dir3, uv, gridResolution, flowVelocityStrength, wavePeriod, time);
    vec2 newUV4 = RotateUV(dir4, uv, gridResolution, flowVelocityStrength, wavePeriod, time);

    // 从位移图中采样高度值（面在该位置的高度偏移量）
    float displacement1 = texture2D(displacementMap, newUV1).r;
    float displacement2 = texture2D(displacementMap, newUV2).r;
    float displacement3 = texture2D(displacementMap, newUV3).r;
    float displacement4 = texture2D(displacementMap, newUV4).r;

    // 从法线图中解包法线向量
    vec3 normal1 = UnpackNormal(texture2D(normalMap, newUV1));
    vec3 normal2 = UnpackNormal(texture2D(normalMap, newUV2));
    vec3 normal3 = UnpackNormal(texture2D(normalMap, newUV3));
    vec3 normal4 = UnpackNormal(texture2D(normalMap, newUV4));

    // 从高度噪声图中采样噪声值
    float noise1 = texture2D(heightNoiseMap, newUV1).r;
    float noise2 = texture2D(heightNoiseMap, newUV2).r;
    float noise3 = texture2D(heightNoiseMap, newUV3).r;
    float noise4 = texture2D(heightNoiseMap, newUV4).r;

    // 从高度噪声法线图中解包噪声法线向量
    vec3 noiseNormal1 = UnpackNormal(texture2D(heightNoiseNormalMap, newUV1));
    vec3 noiseNormal2 = UnpackNormal(texture2D(heightNoiseNormalMap, newUV2));
    vec3 noiseNormal3 = UnpackNormal(texture2D(heightNoiseNormalMap, newUV3));
    vec3 noiseNormal4 = UnpackNormal(texture2D(heightNoiseNormalMap, newUV4));

    // 融合位移值和噪声值
    displacement1 = (displacement1 + noise1) * 0.5;
    displacement2 = (displacement2 + noise2) * 0.5;
    displacement3 = (displacement3 + noise3) * 0.5;
    displacement4 = (displacement4 + noise4) * 0.5;

    // 融合法线向量和噪声法线向量，并归一化
    normal1 = normalize(normal1 + noiseNormal1);
    normal2 = normalize(normal2 + noiseNormal2);
    normal3 = normalize(normal3 + noiseNormal3);
    normal4 = normalize(normal4 + noiseNormal4);

    // 计算当前纹理坐标在网格单元中的小数部分
    vec2 uvFrac = fract(uv * gridResolution);
    // 将小数部分 uvFrac 转换为弧度制角度，范围为 [0.0, 2π]。
    uvFrac *= 2.0 * PI;
    // 将余弦值从 [-1.0, 1.0] 映射到 [0.0, 1.0]，使其适合用于插值或纹理采样。
    uvFrac = cos(uvFrac) * 0.5 + 0.5;

    // 计算插值权重
    float w1 = (1.0 - uvFrac.r) * (1.0 - uvFrac.g);
    float w2 = uvFrac.r * (1.0 - uvFrac.g);
    float w3 = (1.0 - uvFrac.r) * uvFrac.g;
    float w4 = uvFrac.r * uvFrac.g;

    // 使用插值权重计算最终的法线、位移和速度
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
    
    /*
        vec2 uv：纹理坐标，用于采样纹理。
        sampler2D huvMap：流向图纹理，存储水流的方向信息。
        float minVelocityU, maxVelocityU, minVelocityV, maxVelocityV：
        水流速度的最小值和最大值，用于动态调整流向。
        sampler2D normalMap, displacementMap, heightNoiseMap, heightNoiseNormalMap：
        分别表示法线图、位移图、高度噪声图和高度噪声法线图，用于模拟水流的细节。
        float gridResolutionA, B, C, D：四个不同的网格分辨率，用于多层次的水流计算。
        float flowVelocityStrengthA, B, C, D：四个不同的水流速度强度。
        float wavePeriodA, B, C, D：四个不同的波动周期。
        float time：当前时间，用于动态效果。
        float normalStrength：法线强度，用于调整最终法线的效果。
        out vec3 finalNormal, out float finalDisplacement, out vec2 finalVelocity：
        输出参数，分别表示水流的最终法线、位移和速度。
    */

    vec3 curNormal; // 定义临时变量，用于存储当前计算的法线
    float curDisplacement; // 定义临时变量，用于存储当前计算的位移
    vec2 curVelocity; // 定义临时变量，用于存储当前计算的速度

    // 调用 FlowCell 函数，使用第一个分辨率、速度强度和波动周期计算水流效果
    FlowCell(huvMap, minVelocityU, maxVelocityU, minVelocityV, maxVelocityV, normalMap, displacementMap, heightNoiseMap, heightNoiseNormalMap, 0.0, uv, gridResolutionA, flowVelocityStrengthA, wavePeriodA, time, curNormal, curDisplacement, curVelocity);
    finalNormal = curNormal; // 将第一次计算的法线赋值给最终法线
    finalDisplacement = curDisplacement; // 将第一次计算的位移赋值给最终位移
    finalVelocity = curVelocity; // 将第一次计算的速度赋值给最终速度

    // 调用 FlowCell 函数，使用第二个分辨率、速度强度和波动周期计算水流效果
    FlowCell(huvMap, minVelocityU, maxVelocityU, minVelocityV, maxVelocityV, normalMap, displacementMap, heightNoiseMap, heightNoiseNormalMap, 0.0, uv, gridResolutionB, flowVelocityStrengthB, wavePeriodB, time, curNormal, curDisplacement, curVelocity);
    finalNormal += curNormal; // 将第二次计算的法线累加到最终法线
    finalDisplacement += curDisplacement; // 将第二次计算的位移累加到最终位移
    finalVelocity += curVelocity; // 将第二次计算的速度累加到最终速度

    // 调用 FlowCell 函数，使用第三个分辨率、速度强度和波动周期计算水流效果
    FlowCell(huvMap, minVelocityU, maxVelocityU, minVelocityV, maxVelocityV, normalMap, displacementMap, heightNoiseMap, heightNoiseNormalMap, 0.0, uv, gridResolutionC, flowVelocityStrengthC, wavePeriodC, time, curNormal, curDisplacement, curVelocity);
    finalNormal += curNormal; // 将第三次计算的法线累加到最终法线
    finalDisplacement += curDisplacement; // 将第三次计算的位移累加到最终位移
    finalVelocity += curVelocity; // 将第三次计算的速度累加到最终速度

    // 调用 FlowCell 函数，使用第四个分辨率、速度强度和波动周期计算水流效果
    FlowCell(huvMap, minVelocityU, maxVelocityU, minVelocityV, maxVelocityV, normalMap, displacementMap, heightNoiseMap, heightNoiseNormalMap, 0.0, uv, gridResolutionD, flowVelocityStrengthD, wavePeriodD, time, curNormal, curDisplacement, curVelocity);
    finalNormal += curNormal; // 将第四次计算的法线累加到最终法线
    finalDisplacement += curDisplacement; // 将第四次计算的位移累加到最终位移
    finalVelocity += curVelocity; // 将第四次计算的速度累加到最终速度

    finalNormal = normalize(finalNormal); // 对累积的法线进行归一化，确保其长度为 1
    finalDisplacement *= 0.25; // 将累积的位移取平均值
    finalVelocity *= 0.25; // 将累积的速度取平均值
    }

    // 片段着色器代码
uniform vec3 lightDirection; // 光源方向，用于光照计算
uniform vec2 huvMapSize; // 水流高度图的尺寸
uniform vec2 terrainMapSize; // 地形高度图的尺寸

uniform float minWaterHeightBefore; // 前一时间点的最小水高度
uniform float maxWaterHeightBefore; // 前一时间点的最大水高度
uniform float minWaterHeightAfter; // 后一时间点的最小水高度
uniform float maxWaterHeightAfter; // 后一时间点的最大水高度
uniform vec3 lightColor; // 光源颜色
uniform float waterAlpha; // 水的透明度

uniform vec3 waterShallowColor; // 浅水颜色
uniform vec3 waterDeepColor; // 深水颜色
uniform float waterShallowAlpha; // 浅水透明度
uniform float waterDeepAlpha; // 深水透明度
uniform float depthDensity; // 水深密度，用于控制深浅水颜色的过渡
uniform float minWaterDepth; // 最小水深
uniform float maxWaterDepth; // 最大水深
uniform float minWaterDepthAlpha; // 最小水深透明度
uniform float maxWaterDepthAlpha; // 最大水深透明度
uniform float time; // 当前时间，用于动态效果
uniform float timeStep; // 时间步长，用于插值计算
uniform float swapTimeMinRange; // 时间切换的最小范围
uniform float swapTimeMaxRange; // 时间切换的最大范围
uniform float normalStrength; // 法线强度，用于调整法线效果
uniform float waterNormalY; // 水面法线的Y分量，用于法线计算
uniform sampler2D normalMap; // 法线图，用于模拟水面细节
uniform sampler2D displacementMap; // 位移图，用于模拟水面高度变化
uniform sampler2D heightNoiseMap; // 高度噪声图，用于增加水面细节
uniform sampler2D heightNoiseNormalMap; // 高度噪声法线图，用于增加法线细节
uniform sampler2D huvMapBefore; // 前一时间点的水流高度图
uniform sampler2D huvMapAfter; // 后一时间点的水流高度图
uniform sampler2D rampMap; // 用于水深颜色映射的渐变图
uniform float minVelocityUBefore; // 前一时间点的最小U方向速度
uniform float maxVelocityUBefore; // 前一时间点的最大U方向速度
uniform float minVelocityVBefore; // 前一时间点的最小V方向速度
uniform float maxVelocityVBefore; // 前一时间点的最大V方向速度
uniform float minVelocityUAfter; // 后一时间点的最小U方向速度
uniform float maxVelocityUAfter; // 后一时间点的最大U方向速度
uniform float minVelocityVAfter; // 后一时间点的最小V方向速度
uniform float maxVelocityVAfter; // 后一时间点的最大V方向速度
uniform float gridResolutionA; // 第一层网格的分辨率
uniform float wavePeriodA; // 第一层波动的周期
uniform float flowVelocityStrengthA; // 第一层水流速度强度
uniform float gridResolutionB; // 第二层网格的分辨率
uniform float wavePeriodB; // 第二层波动的周期
uniform float flowVelocityStrengthB; // 第二层水流速度强度
uniform float gridResolutionC; // 第三层网格的分辨率
uniform float wavePeriodC; // 第三层波动的周期
uniform float flowVelocityStrengthC; // 第三层水流速度强度
uniform float gridResolutionD; // 第四层网格的分辨率
uniform float wavePeriodD; // 第四层波动的周期
uniform float flowVelocityStrengthD; // 第四层水流速度强度
uniform float foamMinEdge; // 泡沫生成的最小边界
uniform float foamMaxEdge; // 泡沫生成的最大边界
uniform float foamVelocityMaskMinEdge; // 泡沫速度遮罩的最小边界
uniform float foamVelocityMaskMaxEdge; // 泡沫速度遮罩的最大边界
uniform sampler2D foamTexture; // 泡沫纹理，用于模拟浪尖泡沫

varying float waterDepth; // 当前片段的水深
varying float waterHeight; // 当前片段的水高度
varying vec2 vUv; // 当前片段的纹理坐标

float remap(float value, vec2 fromRange, vec2 toRange) 
{
    // 将值从一个范围映射到另一个范围
    return ((value - fromRange.x) / (fromRange.y - fromRange.x)) * (toRange.y - toRange.x) + toRange.x;
}

void FlowStrength()
{
    // 计算水深的映射值
    float waterRemap = remap(waterDepth, vec2(minWaterDepth, maxWaterDepth), vec2(0.0, 1.0));
    // 使用映射值从渐变图中采样颜色
    /*
    clamp(waterRemap, 0.0, 1.0) 的作用是将 waterRemap 限制在 [0.0, 1.0] 的范围内：
        如果 waterRemap 小于 0.0，结果为 0.0。
        如果 waterRemap 大于 1.0，结果为 1.0。
        如果 waterRemap 在 0.0 和 1.0 之间，结果为其本身。
    */
    vec2 rampUV = vec2(clamp(waterRemap, 0.0, 1.0), 0.5);
    vec3 waterDepthStrength = texture2D(rampMap, rampUV).rgb;

    // 设置水的透明度
    float alpha = waterAlpha;

    // 输出最终颜色和透明度
    gl_FragColor = vec4(waterDepthStrength, alpha);
}

void DirectionalFlow() 
{
    // 计算时间步长的插值值，用于平滑切换
    float lerpValue = smoothstep(swapTimeMinRange, swapTimeMaxRange, timeStep);

    vec3 currNormal, nextNormal; // 当前和下一时间点的法线
    float currDisplacement, nextDisplacement; // 当前和下一时间点的位移
    vec2 currVelocity, nextVelocity; // 当前和下一时间点的速度

    // 获取当前时间点的水流方向、法线、位移和速度
    GetDirectionalFlow(vUv, huvMapBefore, minVelocityUBefore, maxVelocityUBefore, minVelocityVBefore, maxVelocityVBefore, 
                        normalMap, displacementMap, heightNoiseMap, heightNoiseNormalMap,
                        gridResolutionA, flowVelocityStrengthA, wavePeriodA,
                        gridResolutionB, flowVelocityStrengthB, wavePeriodB,
                        gridResolutionC, flowVelocityStrengthC, wavePeriodC,
                        gridResolutionD, flowVelocityStrengthD, wavePeriodD,
                        time, normalStrength,
                        currNormal, currDisplacement, currVelocity);

    // 获取下一时间点的水流方向、法线、位移和速度
    GetDirectionalFlow(vUv, huvMapAfter, minVelocityUAfter, maxVelocityUAfter, minVelocityVAfter, maxVelocityVAfter, 
                        normalMap, displacementMap, heightNoiseMap, heightNoiseNormalMap,
                        gridResolutionA, flowVelocityStrengthA, wavePeriodA,
                        gridResolutionB, flowVelocityStrengthB, wavePeriodB,
                        gridResolutionC, flowVelocityStrengthC, wavePeriodC,
                        gridResolutionD, flowVelocityStrengthD, wavePeriodD,
                        time, normalStrength,
                        nextNormal, nextDisplacement, nextVelocity);

    // 在当前和下一时间点的法线之间插值
    vec3 finalNormal = mix(currNormal, nextNormal, lerpValue);
    finalNormal = NormalStrength(finalNormal , normalStrength); // 调整法线强度
    
    // 计算当前和下一时间点的速度遮罩
    float currVelocityMask = smoothstep(foamVelocityMaskMinEdge, foamVelocityMaskMaxEdge, length(currVelocity));
    float nextVelocityMask = smoothstep(foamVelocityMaskMinEdge, foamVelocityMaskMaxEdge, length(nextVelocity));

    // 计算法线
    // 法线插值计算
    vec3 normalBefore = getNormalHeight(vUv, huvMapBefore, huvMapSize, minWaterHeightBefore, maxWaterHeightBefore);
    vec3 normalAfter = getNormalHeight(vUv, huvMapAfter, huvMapSize, minWaterHeightAfter, maxWaterHeightAfter);
    vec3 normalHeight = mix(normalBefore, normalAfter, lerpValue);
    // 法线归一化
    vec3 normal = normalize(vec3(normalHeight.x, waterNormalY, normalHeight.z));
    // 切线与副切线计算
    /*
    tangent 是初始的切线向量，通常设置为 (1.0, 0.0, 0.0)。
    bitangent 是通过法线和切线的叉积计算得到的副切线向量。  
    为了确保切线和副切线与法线正交，重新计算切线为副切线和法线的叉积。
    */
    vec3 tangent = vec3(1.0, 0.0, 0.0);
    vec3 bitangent = cross(normal, tangent);
    tangent = cross(bitangent, normal);
    // TBN 矩阵由切线、副切线和法线组成，用于将法线从切线空间转换到世界空间。
    // 切线空间是纹理映射和法线贴图的默认空间，而世界空间是光照计算的常用空间。
    mat3 tbnMatrix = mat3(tangent, bitangent, normal);
    // 法线转换到世界空间
    vec3 normalWS = normalize(tbnMatrix * finalNormal);

    // 计算深浅水颜色
    float waterHeight = waterDepth;
    waterHeight /= depthDensity;
    waterHeight = clamp(waterHeight, 0.0, 1.0);
    vec3 waterColor = mix(waterShallowColor, waterDeepColor, waterHeight);
    float waterColorAlpha = mix(waterShallowAlpha, waterDeepAlpha, waterHeight);
    float alpha = waterAlpha * mix(waterShallowAlpha, waterDeepAlpha, waterHeight);

    // 计算法线光照
    float NdotL = dot(normalWS, lightDirection);
    float halfLambert = 0.5 * NdotL + 0.5;
    vec3 diffuseColor = waterColor * lightColor * halfLambert;

    vec3 finalColor = diffuseColor.rgb;

    // 计算浪尖泡沫
    float foamValue = texture2D(foamTexture, vUv * 500.).r;
    foamValue = remap(foamValue, vec2(0.0,1.0), vec2(0.2, 1.0));
    float currFoamValue = foamValue * smoothstep(foamMinEdge, foamMaxEdge, currDisplacement);
    float nextFoamValue = foamValue * smoothstep(foamMinEdge, foamMaxEdge, nextDisplacement);
    vec3 currFoamColor = vec3(currFoamValue) * currVelocityMask;
    vec3 nextFoamColor = vec3(nextFoamValue) * nextVelocityMask;
    vec3 foamColor = mix(currFoamColor, nextFoamColor, lerpValue);

    // 将泡沫颜色添加到最终颜色
    finalColor = finalColor + foamColor;
    finalColor = LinearToSRGB(finalColor); // 转换到sRGB颜色空间
    gl_FragColor = vec4(finalColor, alpha); // 输出最终颜色和透明
}

    void main() 
{
    if(waterDepth < -0.001)
        discard;
    DirectionalFlow();
    // FlowStrength();
}