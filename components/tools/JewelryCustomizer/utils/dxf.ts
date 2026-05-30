export const generateDxf = (polygons: number[][][], unitsPerMm: number): string => {
  // Standard DXF file header
  let dxf = `  0
SECTION
  2
HEADER
  9
$ACADVER
  1
AC1018
  9
$MEASUREMENT
 70
      1
  0
ENDSEC
  0
SECTION
  2
TABLES
  0
ENDSEC
  0
SECTION
  2
BLOCKS
  0
ENDSEC
  0
SECTION
  2
ENTITIES
`;

  polygons.forEach((poly, polyIndex) => {
    if (poly.length < 2) return;
    
    // LWPOLYLINE stands for LightWeight POLYLINE, standard CAD entity for 2D boundaries.
    dxf += `  0
LWPOLYLINE
  5
${(100 + polyIndex).toString(16)}
100
AcDbEntity
  8
0
100
AcDbPolyline
 90
${poly.length}
 70
1
`;

    poly.forEach(([x, y]) => {
      // Scale coordinates to actual millimeters
      const xMm = x / unitsPerMm;
      // Invert Y axis because CAD software uses Cartesian coordinates where Y goes up.
      // SVG coordinates use screen space where Y goes down.
      const yMm = -y / unitsPerMm;
      
      dxf += ` 10
${xMm.toFixed(4)}
 20
${yMm.toFixed(4)}
`;
    });
  });

  // End of entities and end of file markers
  dxf += `  0
ENDSEC
  0
EOF
`;

  return dxf;
};
