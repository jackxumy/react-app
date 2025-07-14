import * as fs from 'fs';

// Helper function to create vertices from a polygon
function createVertices(polygon: number[][][]): number[] {
    const vertices: number[] = [];
    for (const ring of polygon) {
        for (const [x, y] of ring) {
            vertices.push(x, y, 0);  // Z = 0 for bottom
        }
    }
    return vertices;
}

// Helper function to create faces (indices) for OBJ
function createFaces(polygon: number[][][]): number[] {
    const faces: number[] = [];
    const ringLength = polygon[0].length;  // Assuming all rings are the same length
    for (let i = 1; i < polygon.length - 1; i++) {
        const ring1Start = i * ringLength;
        const ring2Start = (i + 1) * ringLength;
        for (let j = 0; j < ringLength - 1; j++) {
            faces.push(ring1Start + j + 1, ring1Start + j, ring2Start + j);  // Triangle 1
            faces.push(ring2Start + j, ring1Start + j + 1, ring2Start + j + 1);  // Triangle 2
        }
    }
    return faces;
}

// Helper function to create OBJ format string
function createObjString(vertices: number[], faces: number[]): string {
    let objString = '# Generated OBJ\n';

    // Add vertices to OBJ file
    vertices.forEach((v, idx) => {
        if (idx % 3 === 0) {
            objString += `v ${v} `;
        } else {
            objString += `${v}\n`;
        }
    });

    // Add faces to OBJ file (1-based index)
    faces.forEach((f, idx) => {
        if (idx % 3 === 0) {
            objString += `f ${f + 1} `;
        } else if (idx % 3 === 2) {
            objString += `${f + 1}\n`;
        } else {
            objString += `${f + 1} `;
        }
    });

    return objString;
}

// Function to generate OBJ from GeoJSON
export async function generateObjFromGeoJSON(geojson: any, outputPath: string): Promise<void> {
    if (!geojson || geojson.type !== 'FeatureCollection') {
        throw new Error('Invalid GeoJSON format');
    }

    let allVertices: number[] = [];
    let allFaces: number[] = [];

    // Iterate through each feature (polygon)
    for (const feature of geojson.features) {
        if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
            const coordinates = feature.geometry.coordinates;
            if (feature.geometry.type === 'Polygon') {
                const vertices = createVertices(coordinates);
                const faces = createFaces(coordinates);
                allVertices = allVertices.concat(vertices);
                allFaces = allFaces.concat(faces);
            } else if (feature.geometry.type === 'MultiPolygon') {
                // Handle multi-polygons if needed
                coordinates.forEach((polygon: number[][][]) => {
                    const vertices = createVertices(polygon);
                    const faces = createFaces(polygon);
                    allVertices = allVertices.concat(vertices);
                    allFaces = allFaces.concat(faces);
                });
            }
        }
    }

    // Create OBJ string
    const objString = createObjString(allVertices, allFaces);

    // Write OBJ string to file
    fs.writeFileSync(outputPath, objString, 'utf-8');
    console.log(`OBJ file saved to ${outputPath}`);
}