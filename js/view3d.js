// CIVL6044 AR Prototype 1.1 - 3D model view without the camera.
// Shows the same 3D figure standing on a virtual copy of the sheet.
// One finger (or mouse) turns the model, pinch or wheel zooms; dragging the
// red handle moves the load (app.js intercepts those touches first).

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { G } from "./geometry.js";

export function start3DView({ container, fig, sheetSrc }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.display = "block";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 5, 8000);
  camera.up.set(0, 0, 1);                         // sheet lies in x-y, z points up off the desk
  camera.position.set(0, -380, 330);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, -40, 10);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 140;
  controls.maxDistance = 1300;
  controls.maxPolarAngle = THREE.MathUtils.degToRad(84);
  controls.update();

  // the sheet, with a soft shadow on the desk
  const tex = new THREE.TextureLoader().load(sheetSrc);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(G.pageW, G.targetH), new THREE.MeshBasicMaterial({ map: tex }));
  scene.add(sheet);
  const deskShadow = new THREE.Mesh(new THREE.PlaneGeometry(G.pageW + 8, G.targetH + 8),
    new THREE.MeshBasicMaterial({ color: 0x0b1620, transparent: true, opacity: 0.12, depthWrite: false }));
  deskShadow.position.set(2.5, -3.5, -0.8);
  scene.add(deskShadow);

  fig.root.removeFromParent();
  fig.root.position.set(0, 0, 0);
  fig.root.scale.setScalar(1);
  scene.add(fig.root);

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // Keep the model centred as it stands up and grows.
  const aim = new THREE.Vector3(0, -40, 10);
  let last = performance.now();
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    controls.target.lerp(aim, 1 - Math.exp(-dt * 4));
    controls.update();
    fig.tick(dt);
    renderer.render(scene, camera);
  });

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  return {
    toSheet(clientX, clientY, bounded = true) {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return fig.pick(raycaster.ray, bounded);
    },
    frame(standUp, size) {
      aim.set(0, standUp ? -95 : -40, standUp ? 25 + 55 * size : 10);
    },
    stop() {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      controls.dispose();
      fig.root.removeFromParent();
      tex.dispose();
      for (const m of [sheet, deskShadow]) { m.geometry.dispose(); m.material.dispose(); }
      renderer.dispose();
      container.replaceChildren();
    },
  };
}
