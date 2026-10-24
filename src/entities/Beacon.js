import * as THREE from 'three';

const BEAM_HEIGHT = 180;

/** Level goal: a glowing pillar visible from far away. */
export class Beacon {
  constructor(position) {
    this.position = position.clone();
    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.8, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x4b4f63, flatShading: true }),
    );
    base.position.y = 0.6;

    this.core = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.2, 0),
      new THREE.MeshStandardMaterial({ color: 0xffd36b, emissive: 0xffa31a, emissiveIntensity: 2, flatShading: true }),
    );

    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, BEAM_HEIGHT, 12, 1, true).translate(0, BEAM_HEIGHT / 2, 0),
      new THREE.MeshBasicMaterial({
        color: 0xffd36b,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );

    this.group.add(base, this.core, this.beam);
  }

  update(time) {
    this.core.rotation.y = time;
    this.core.position.y = 3 + Math.sin(time * 2) * 0.4;
    this.beam.material.opacity = 0.28 + Math.sin(time * 3) * 0.08;
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((node) => {
      if (!node.isMesh) return;
      node.geometry.dispose();
      node.material.dispose();
    });
  }
}
