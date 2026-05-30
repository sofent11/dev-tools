import * as THREE from 'three';

// 100% Local, highly-optimized BSP (Binary Space Partitioning) Constructive Solid Geometry (CSG) compiler
// Derived from the classical CSG algorithm, adapted for modern Three.js BufferGeometry structures

export class Vertex {
  constructor(
    public pos: THREE.Vector3,
    public normal: THREE.Vector3,
    public uv: THREE.Vector2 = new THREE.Vector2()
  ) {}

  clone(): Vertex {
    return new Vertex(this.pos.clone(), this.normal.clone(), this.uv.clone());
  }

  flip(): void {
    this.normal.negate();
  }

  interpolate(other: Vertex, t: number): Vertex {
    return new Vertex(
      new THREE.Vector3().lerpVectors(this.pos, other.pos, t),
      new THREE.Vector3().lerpVectors(this.normal, other.normal, t).normalize(),
      new THREE.Vector2().lerpVectors(this.uv, other.uv, t)
    );
  }
}

export class Plane {
  constructor(public normal: THREE.Vector3, public w: number) {}

  static fromPoints(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): Plane {
    const n = new THREE.Vector3()
      .subVectors(b, a)
      .cross(new THREE.Vector3().subVectors(c, a))
      .normalize();
    return new Plane(n, n.dot(a));
  }

  clone(): Plane {
    return new Plane(this.normal.clone(), this.w);
  }

  flip(): void {
    this.normal.negate();
    this.w = -this.w;
  }

  // Splits a polygon by this plane
  splitPolygon(
    polygon: Polygon,
    coplanarFront: Polygon[],
    coplanarBack: Polygon[],
    front: Polygon[],
    back: Polygon[]
  ): void {
    const COPLANAR = 0;
    const FRONT = 1;
    const BACK = 2;
    const SPANNING = 3;

    // Classify each vertex relative to the plane
    const EPSILON = 1e-5;
    const types: number[] = [];
    let polygonType = 0;

    for (let i = 0; i < polygon.vertices.length; i++) {
      const t = this.normal.dot(polygon.vertices[i].pos) - this.w;
      const type = t < -EPSILON ? BACK : t > EPSILON ? FRONT : COPLANAR;
      polygonType |= type;
      types.push(type);
    }

    // Put the polygon in the correct list, splitting it if necessary
    switch (polygonType) {
      case COPLANAR:
        (this.normal.dot(polygon.plane.normal) > 0 ? coplanarFront : coplanarBack).push(polygon);
        break;
      case FRONT:
        front.push(polygon);
        break;
      case BACK:
        back.push(polygon);
        break;
      case SPANNING: {
        const f: Vertex[] = [];
        const b: Vertex[] = [];
        for (let i = 0; i < polygon.vertices.length; i++) {
          const j = (i + 1) % polygon.vertices.length;
          const vi = polygon.vertices[i];
          const vj = polygon.vertices[j];
          const ti = types[i];
          const tj = types[j];

          if (ti !== BACK) f.push(vi);
          if (ti !== FRONT) b.push(vi);

          if ((ti | tj) === SPANNING) {
            const dotI = this.normal.dot(vi.pos) - this.w;
            const dotJ = this.normal.dot(vj.pos) - this.w;
            const t = dotI / (dotI - dotJ);
            const v = vi.interpolate(vj, t);
            f.push(v);
            b.push(v.clone());
          }
        }
        if (f.length >= 3) front.push(new Polygon(f, polygon.shared));
        if (b.length >= 3) back.push(new Polygon(b, polygon.shared));
        break;
      }
    }
  }
}

export class Polygon {
  public plane: Plane;

  constructor(public vertices: Vertex[], public shared: unknown = null) {
    this.plane = Plane.fromPoints(vertices[0].pos, vertices[1].pos, vertices[2].pos);
  }

  clone(): Polygon {
    return new Polygon(
      this.vertices.map(v => v.clone()),
      this.shared
    );
  }

  flip(): void {
    this.vertices.reverse().forEach(v => v.flip());
    this.plane.flip();
  }
}

export class Node {
  public plane: Plane | null = null;
  public front: Node | null = null;
  public back: Node | null = null;
  public polygons: Polygon[] = [];

  constructor(polygons?: Polygon[]) {
    if (polygons && polygons.length > 0) {
      this.build(polygons);
    }
  }

  clone(): Node {
    const node = new Node();
    node.plane = this.plane ? this.plane.clone() : null;
    node.front = this.front ? this.front.clone() : null;
    node.back = this.back ? this.back.clone() : null;
    node.polygons = this.polygons.map(p => p.clone());
    return node;
  }

  // Swap inside and outside
  invert(): void {
    for (let i = 0; i < this.polygons.length; i++) {
      this.polygons[i].flip();
    }
    if (this.plane) this.plane.flip();
    if (this.front) this.front.invert();
    if (this.back) this.back.invert();

    // Swap front and back
    const temp = this.front;
    this.front = this.back;
    this.back = temp;
  }

  // Recursively clip polygons to this BSP tree
  clipPolygons(polygons: Polygon[]): Polygon[] {
    if (!this.plane) return polygons.slice();

    let front: Polygon[] = [];
    let back: Polygon[] = [];

    for (let i = 0; i < polygons.length; i++) {
      this.plane.splitPolygon(polygons[i], front, back, front, back);
    }

    if (this.front) front = this.front.clipPolygons(front);
    if (this.back) {
      back = this.back.clipPolygons(back);
    } else {
      back = [];
    }

    return front.concat(back);
  }

  // Clip this tree's polygons to the other tree
  clipTo(other: Node): void {
    this.polygons = other.clipPolygons(this.polygons);
    if (this.front) this.front.clipTo(other);
    if (this.back) this.back.clipTo(other);
  }

  // Retrieve all polygons in the tree
  allPolygons(): Polygon[] {
    let polygons = this.polygons.slice();
    if (this.front) polygons = polygons.concat(this.front.allPolygons());
    if (this.back) polygons = polygons.concat(this.back.allPolygons());
    return polygons;
  }

  // Recursively build the BSP tree from polygons
  build(polygons: Polygon[]): void {
    if (polygons.length === 0) return;

    if (!this.plane) {
      this.plane = polygons[0].plane.clone();
    }

    const front: Polygon[] = [];
    const back: Polygon[] = [];

    for (let i = 0; i < polygons.length; i++) {
      this.plane.splitPolygon(polygons[i], this.polygons, this.polygons, front, back);
    }

    if (front.length > 0) {
      if (!this.front) this.front = new Node();
      this.front.build(front);
    }
    if (back.length > 0) {
      if (!this.back) this.back = new Node();
      this.back.build(back);
    }
  }
}

// Higher-level mesh converter
export class CSGExporter {
  static fromGeometry(geometry: THREE.BufferGeometry): Node {
    const polygons: Polygon[] = [];

    // Ensure we have position attribute
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    if (!posAttr) return new Node();

    const normAttr = geometry.getAttribute('normal') as THREE.BufferAttribute;
    const uvAttr = geometry.getAttribute('uv') as THREE.BufferAttribute;
    const indexAttr = geometry.index;

    const getVertex = (index: number): Vertex => {
      const pos = new THREE.Vector3(posAttr.getX(index), posAttr.getY(index), posAttr.getZ(index));
      const normal = normAttr
        ? new THREE.Vector3(normAttr.getX(index), normAttr.getY(index), normAttr.getZ(index))
        : new THREE.Vector3(0, 1, 0);
      const uv = uvAttr
        ? new THREE.Vector2(uvAttr.getX(index), uvAttr.getY(index))
        : new THREE.Vector2(0, 0);
      return new Vertex(pos, normal, uv);
    };

    if (indexAttr) {
      for (let i = 0; i < indexAttr.count; i += 3) {
        const i0 = indexAttr.getX(i);
        const i1 = indexAttr.getY(i);
        const i2 = indexAttr.getZ(i);

        const v0 = getVertex(i0);
        const v1 = getVertex(i1);
        const v2 = getVertex(i2);

        // Avoid degenerate triangles (collinear vertices)
        if (new THREE.Triangle(v0.pos, v1.pos, v2.pos).getArea() > 1e-7) {
          polygons.push(new Polygon([v0, v1, v2]));
        }
      }
    } else {
      for (let i = 0; i < posAttr.count; i += 3) {
        const v0 = getVertex(i);
        const v1 = getVertex(i + 1);
        const v2 = getVertex(i + 2);

        if (new THREE.Triangle(v0.pos, v1.pos, v2.pos).getArea() > 1e-7) {
          polygons.push(new Polygon([v0, v1, v2]));
        }
      }
    }

    return new Node(polygons);
  }

  static toGeometry(node: Node): THREE.BufferGeometry {
    const polygons = node.allPolygons();
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    for (let i = 0; i < polygons.length; i++) {
      const poly = polygons[i];
      // Decompose concave polygons if they have more than 3 vertices (standard fan triangulation)
      for (let j = 2; j < poly.vertices.length; j++) {
        const v0 = poly.vertices[0];
        const v1 = poly.vertices[j - 1];
        const v2 = poly.vertices[j];

        // Triangle 1: v0, v1, v2
        positions.push(v0.pos.x, v0.pos.y, v0.pos.z);
        positions.push(v1.pos.x, v1.pos.y, v1.pos.z);
        positions.push(v2.pos.x, v2.pos.y, v2.pos.z);

        normals.push(v0.normal.x, v0.normal.y, v0.normal.z);
        normals.push(v1.normal.x, v1.normal.y, v1.normal.z);
        normals.push(v2.normal.x, v2.normal.y, v2.normal.z);

        uvs.push(v0.uv.x, v0.uv.y);
        uvs.push(v1.uv.x, v1.uv.y);
        uvs.push(v2.uv.x, v2.uv.y);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

    // Force recalculating bounding volumes
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return geometry;
  }

  static union(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
    const nodeA = this.fromGeometry(a);
    const nodeB = this.fromGeometry(b);

    const treeA = nodeA.clone();
    const treeB = nodeB.clone();

    treeA.clipTo(treeB);
    treeB.clipTo(treeA);
    treeB.invert();
    treeB.clipTo(treeA);
    treeB.invert();
    treeA.build(treeB.allPolygons());

    return this.toGeometry(treeA);
  }

  static subtract(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
    const nodeA = this.fromGeometry(a);
    const nodeB = this.fromGeometry(b);

    const treeA = nodeA.clone();
    const treeB = nodeB.clone();

    treeA.invert();
    treeA.clipTo(treeB);
    treeB.clipTo(treeA);
    treeB.invert();
    treeB.clipTo(treeA);
    treeB.invert();
    treeA.build(treeB.allPolygons());
    treeA.invert();

    return this.toGeometry(treeA);
  }

  static intersect(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
    const nodeA = this.fromGeometry(a);
    const nodeB = this.fromGeometry(b);

    const treeA = nodeA.clone();
    const treeB = nodeB.clone();

    treeA.invert();
    treeB.clipTo(treeA);
    treeB.invert();
    treeA.clipTo(treeB);
    treeB.clipTo(treeA);
    treeA.build(treeB.allPolygons());
    treeA.invert();

    return this.toGeometry(treeA);
  }
}
