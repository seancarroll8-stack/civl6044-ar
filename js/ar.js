// CIVL6044 AR Prototype 1.1 - AR camera view (MindAR image tracking + three.js).
// MindAR anchor space: the target image is 1 unit wide, centred on the origin, y up,
// z towards the camera. The 3D figure is built in sheet millimetres, so it is
// scaled by 1/210 to sit exactly on the printed sheet.

import * as THREE from "three";
import { MindARThree } from "mindar-image-three";
import { G } from "./geometry.js";

export async function startAR({ container, targetSrc, fig, onFound, onLost }) {
  const mindar = new MindARThree({
    container,
    imageTargetSrc: targetSrc,
    maxTrack: 1,
    uiLoading: "no", uiScanning: "no", uiError: "no",
    filterMinCF: 0.0001, filterBeta: 0.001,        // heavier smoothing: steadier model, slight lag
  });
  const { renderer, scene, camera } = mindar;
  const anchor = mindar.addAnchor(0);

  fig.root.removeFromParent();
  fig.root.position.set(0, 0, 0);
  fig.root.scale.setScalar(1 / G.pageW);
  anchor.group.add(fig.root);

  anchor.onTargetFound = () => onFound && onFound();
  anchor.onTargetLost = () => onLost && onLost();

  await mindar.start();

  let last = performance.now();
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    fig.tick(Math.min(0.1, (now - last) / 1000));
    last = now;
    renderer.render(scene, camera);
  });

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let frozen = false;

  return {
    // Screen point -> page millimetres on the load plane, or null.
    toSheet(clientX, clientY, bounded = true) {
      if (!anchor.group.visible) return null;
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return fig.pick(raycaster.ray, bounded);
    },

    // Freeze = pause camera + tracking; the last pose stays on screen.
    setFrozen(on) {
      if (on === frozen || typeof mindar.pause !== "function") return;
      frozen = on;
      if (on) mindar.pause(false); else mindar.unpause();
    },

    async stop() {
      renderer.setAnimationLoop(null);
      try { await mindar.stop(); } catch (e) { /* camera may already be closed */ }
      fig.root.removeFromParent();
      renderer.dispose();
      container.replaceChildren();
    },
  };
}
