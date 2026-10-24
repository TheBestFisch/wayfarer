import * as THREE from 'three';

/** Geometries and materials shared by every chunk. Created once per game. */
export function createWorldResources() {
  const flat = { flatShading: true, roughness: 1, metalness: 0 };

  const resources = {
    terrainMaterial: new THREE.MeshStandardMaterial({ ...flat, vertexColors: true }),
    trunkGeometry: new THREE.CylinderGeometry(0.22, 0.36, 2, 6).translate(0, 1, 0),
    trunkMaterial: new THREE.MeshStandardMaterial({ ...flat, color: 0x6b4a2f }),
    crownGeometry: new THREE.ConeGeometry(1.6, 3.8, 7).translate(0, 3.6, 0),
    crownMaterial: new THREE.MeshStandardMaterial({ ...flat, color: 0xffffff }),
    rockGeometry: new THREE.DodecahedronGeometry(1, 0),
    rockMaterial: new THREE.MeshStandardMaterial({ ...flat, color: 0xffffff }),
    shardGeometry: new THREE.OctahedronGeometry(0.7, 0),
    shardMaterial: new THREE.MeshStandardMaterial({
      color: 0x7ff3ff,
      emissive: 0x29c6ff,
      emissiveIntensity: 1.6,
      flatShading: true,
      roughness: 0.3,
    }),
  };

  return {
    ...resources,
    dispose() {
      for (const resource of Object.values(resources)) resource.dispose();
    },
  };
}
