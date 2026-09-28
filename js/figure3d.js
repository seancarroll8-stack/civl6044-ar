// CIVL6044 AR Prototype 1.1 - three.js layer for the 3D figure.
// Converts the plain scene description from scene3d.js into three.js objects
// and animates: stand up / lay flat, size, beam bending and the entrance drop.
// Used by both the AR camera view (ar.js) and the no-camera 3D view (view3d.js).

import * as THREE from "three";
import { buildScene, pickLoadPlane, DIM } from "./scene3d.js";
import { renderLabel, labelGeometry } from "./labels.js";

const BASE_PX = 64;
const STAND_ANGLE = THREE.MathUtils.degToRad(70);

export function createFigure3D() {
  const root = new THREE.Group();      // sheet frame, millimetres
  const pivot = new THREE.Group();     // hinge line for standing up and resizing
  const figure = new THREE.Group();
  pivot.position.set(0, DIM.hingeY, 0);
  figure.position.set(0, -DIM.hingeY, 0);
  root.add(pivot); pivot.add(figure);
  const content = new THREE.Group();
  figure.add(content);
  const shadow = makeShadow();
  root.add(shadow);

  const labelCache = new Map();
  const anim = { theta: 0, thetaT: 0, size: 1, sizeT: 1, defl: 0, deflT: 0, drop: 0 };
  let input = null, dirty = false, builtDefl = -1;

  function labelTexture(spec) {
    const key = JSON.stringify([spec.lines, spec.color, spec.style, spec.halo]);
    let e = labelCache.get(key);
    if (e) { labelCache.delete(key); labelCache.set(key, e); return e; }   // keep most recently used last
    const img = renderLabel(spec, BASE_PX);
    const tex = new THREE.CanvasTexture(img.canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    e = { tex, img };
    labelCache.set(key, e);
    if (labelCache.size > 150) {
      const [oldKey, old] = labelCache.entries().next().value;
      old.tex.dispose(); labelCache.delete(oldKey);
    }
    return e;
  }

  function clearContent() {
    for (const o of [...content.children]) {
      content.remove(o);
      if (o.material) o.material.dispose();          // label textures are cached, not disposed here
      if (o.geometry && !o.isSprite) o.geometry.dispose();
    }
  }

  function rebuild() {
    clearContent();
    const S = buildScene({ ...input, defl: anim.defl });
    for (const b of S.batches.values()) {
      if (!b.idx.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(b.col, 3));
      g.setIndex(b.idx);
      const transparent = b.opacity < 1;
      const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
        vertexColors: true, side: THREE.DoubleSide, transparent, opacity: b.opacity, depthWrite: !transparent,
      }));
      mesh.renderOrder = b.order;
      content.add(mesh);
    }
    for (const L of S.labels) {
      const { tex, img } = labelTexture(L);
      const geo = labelGeometry(L, img, BASE_PX);
      if (L.flat) {
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(geo.w, geo.h),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
        plane.position.set(L.pos[0] + (0.5 - geo.centerX) * geo.w, L.pos[1], L.pos[2]);
        plane.renderOrder = 1;
        content.add(plane);
      } else {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
        sprite.center.set(geo.centerX, 0.5);
        sprite.scale.set(geo.w, geo.h, 1);
        sprite.position.set(L.pos[0], L.pos[1], L.pos[2]);
        sprite.renderOrder = 10;
        content.add(sprite);
      }
    }
    builtDefl = anim.defl;
    dirty = false;
  }

  const ease = (t) => 1 - (1 - t) ** 3;

  // Called every frame. Returns nothing; updates transforms and rebuilds when needed.
  function tick(dt) {
    const k = 1 - Math.exp(-dt * 7);
    for (const [c, t] of [["theta", "thetaT"], ["size", "sizeT"], ["defl", "deflT"]]) {
      const d = anim[t] - anim[c];
      anim[c] = Math.abs(d) < 1e-4 ? anim[t] : anim[c] + d * k;
    }
    if (anim.drop > 0) anim.drop = Math.max(0, anim.drop - dt * 2.4);
    const drop = anim.drop > 0 ? 1 - ease(1 - anim.drop) : 0;       // 1 -> 0 with ease-out

    pivot.rotation.x = anim.theta;
    pivot.position.z = (anim.theta > 1e-3 ? 0.4 : 0) + 45 * drop;
    pivot.scale.setScalar(anim.size * (1 - 0.1 * drop));

    const s = Math.sin(anim.theta);
    shadow.visible = s > 0.05;
    if (shadow.visible) {
      const Lh = 40 * anim.size, hw = 98 * anim.size;
      shadow.scale.set(2 * hw, Lh, 1);
      shadow.position.set(0, DIM.hingeY + 0.3 * Lh, 0.15);
      shadow.material.opacity = 0.9 * s * (1 - drop);
    }
    if (input && (dirty || Math.abs(anim.defl - builtDefl) > 0.004)) rebuild();
  }

  const inv = new THREE.Matrix4();
  const ray = new THREE.Ray();

  return {
    root,

    // s: { sol, layers, beam, standUp, size, dragging }
    setState(s) {
      input = { sol: s.sol, layers: s.layers, beam: s.beam, dragging: s.dragging };
      anim.thetaT = s.standUp ? STAND_ANGLE : 0;
      anim.sizeT = s.size;
      anim.deflT = s.beam === "original" ? 0 : 1;
      dirty = true;
    },

    playEntrance() { anim.drop = 1; },

    // Re-render label images (e.g. once web fonts have loaded).
    refreshLabels() {
      for (const e of labelCache.values()) e.tex.dispose();
      labelCache.clear();
      dirty = true;
    },

    // World-space ray -> page millimetres on the load plane (or null).
    pick(worldRay, bounded = true) {
      figure.updateWorldMatrix(true, false);
      inv.copy(figure.matrixWorld).invert();
      ray.copy(worldRay).applyMatrix4(inv);
      return pickLoadPlane([ray.origin.x, ray.origin.y, ray.origin.z], [ray.direction.x, ray.direction.y, ray.direction.z], bounded);
    },

    tick,

    dispose() {
      clearContent();
      for (const e of labelCache.values()) e.tex.dispose();
      labelCache.clear();
      shadow.geometry.dispose(); shadow.material.map.dispose(); shadow.material.dispose();
    },
  };
}

// Soft contact shadow where the standing figure meets the sheet.
function makeShadow() {
  const c = document.createElement("canvas"); c.width = 16; c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 128, 0, 0);
  grad.addColorStop(0, "rgba(10,20,30,0)");
  grad.addColorStop(0.2, "rgba(10,20,30,0.55)");
  grad.addColorStop(0.34, "rgba(10,20,30,0.3)");
  grad.addColorStop(1, "rgba(10,20,30,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 16, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
  mesh.renderOrder = -3;
  mesh.visible = false;
  return mesh;
}
