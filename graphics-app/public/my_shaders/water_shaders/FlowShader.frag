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

    // 这里就是涨水退水的根源
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