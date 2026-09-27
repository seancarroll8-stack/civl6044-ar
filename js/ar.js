// CIVL6044 AR Prototype 1 - AR tracking layer (MindAR image tracking + Three.js).
// Loaded on demand, so the 2D view works even if the AR libraries cannot load.
//
// MindAR anchor space: the target image is 1 unit wide, centred on the origin,
// y up. The overlay canvas is mapped onto a plane positioned in that space
// using the same mm geometry that drew the printed sheet.

import * as THREE from "three";
import { MindARThree } from "mindar-image-three";
import { G } from "./geometry.js";
import { OVERLAY_W_MM, OVERLAY_H_MM } from "./overlay.js";

export async function startAR({ container, overlayCanvas, targetSrc, onFound, onLost }) {
  const mindar = new MindARThree({
    container,
    imageTargetSrc: targetSrc,
    maxTrack: 1,
    uiLoading: "no", uiScanning: "no", uiError: "no",
    // Heavier smoothing: steadier labels at the cost of slight lag.
    filterMinCF: 0.0001, filterBeta: 0.001,
  });
  const { renderer, scene, camera } = mindar;
  const anchor = mindar.addAnchor(0);

  const texture = new THREE.CanvasTexture(overlayCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const unit = G.pageW; // mm per anchor unit
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(OVERLAY_W_MM / unit, OVERLAY_H_MM / unit),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false })
  );
  const cy = (G.overlay.y0 + G.overlay.y1) / 2;
  mesh.position.set(0, (G.targetH / 2 - cy) / unit, 0.001);
  anchor.group.add(mesh);

  anchor.onTargetFound = () => onFound && onFound();
  anchor.onTargetLost = () => onLost && onLost();

  await mindar.start();
  renderer.setAnimationLoop(() => renderer.render(scene, camera));

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let frozen = false;

  return {
    refresh() { texture.needsUpdate = true; },

    // Screen point -> sheet coordinates (mm), or null if not over the tracked sheet.
    toSheet(clientX, clientY) {
      if (!anchor.group.visible) return null;
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObject(mesh, false)[0];
      if (!hit || !hit.uv) return null;
      return { x: hit.uv.x * OVERLAY_W_MM, y: G.overlay.y0 + (1 - hit.uv.y) * OVERLAY_H_MM };
    },

    // Freeze = pause the camera and tracking; the last pose and camera frame stay on screen.
    setFrozen(on) {
      if (on === frozen) return;
      if (typeof mindar.pause !== "function") return;   // older MindAR builds: keep tracking
      frozen = on;
      if (on) mindar.pause(false); else mindar.unpause();
    },

    isTracking() { return anchor.group.visible; },

    async stop() {
      renderer.setAnimationLoop(null);
      try { await mindar.stop(); } catch (e) { /* camera may already be closed */ }
      texture.dispose(); mesh.geometry.dispose(); mesh.material.dispose();
      renderer.dispose();
      container.replaceChildren();
    },
  };
}
