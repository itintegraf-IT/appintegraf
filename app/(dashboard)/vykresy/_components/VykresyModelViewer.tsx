"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { getFileExtension } from "@/lib/vykresy/constants";

type Props = {
  url: string;
  filename: string;
};

function fitCameraToObject(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  controls: OrbitControls
) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const fov = (camera.fov * Math.PI) / 180;
  const distance = (maxDim / (2 * Math.tan(fov / 2))) * 1.6;

  camera.near = Math.max(distance / 100, 0.01);
  camera.far = Math.max(distance * 100, 1000);
  camera.position.set(center.x + distance, center.y + distance * 0.6, center.z + distance);
  camera.lookAt(center);
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  controls.update();
}

export function VykresyModelViewer({ url, filename }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let animationId = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f4f6);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    camera.position.set(80, 60, 80);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(80, 120, 60);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-60, 40, -80);
    scene.add(fill);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    const setSize = () => {
      if (!renderer || !container) return;
      const w = container.clientWidth || 640;
      const h = container.clientHeight || 480;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    setSize();
    resizeObserver = new ResizeObserver(setSize);
    resizeObserver.observe(container);

    const animate = () => {
      if (disposed) return;
      animationId = requestAnimationFrame(animate);
      controls?.update();
      if (renderer) renderer.render(scene, camera);
    };
    animate();

    const load = async () => {
      setStatus("loading");
      setErrorMsg("");
      try {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error("Soubor se nepodařilo načíst.");
        }
        const buffer = await res.arrayBuffer();
        if (disposed) return;

        const ext = getFileExtension(filename);
        let root: THREE.Object3D;

        if (ext === ".stl") {
          const geometry = new STLLoader().parse(buffer);
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({
            color: 0xb91c1c,
            metalness: 0.15,
            roughness: 0.55,
          });
          root = new THREE.Mesh(geometry, material);
        } else if (ext === ".3mf") {
          root = new ThreeMFLoader().parse(buffer);
          root.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              for (const m of mats) {
                if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshPhongMaterial) {
                  m.side = THREE.DoubleSide;
                }
              }
            }
          });
        } else {
          throw new Error("Nepodporovaný formát 3D modelu.");
        }

        scene.add(root);
        if (controls) fitCameraToObject(camera, root, controls);
        setStatus("ready");
      } catch (e) {
        if (disposed) return;
        setStatus("error");
        setErrorMsg(e instanceof Error ? e.message : "Chyba při načítání 3D modelu.");
      }
    };

    void load();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationId);
      resizeObserver?.disconnect();
      controls?.dispose();
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
      }
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) m?.dispose?.();
        }
      });
    };
  }, [url, filename]);

  return (
    <div className="relative h-[min(78vh,720px)] w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
      <div ref={containerRef} className="h-full w-full" />
      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gray-100/80 text-sm text-gray-600">
          Načítám 3D model…
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 p-4 text-center text-sm text-red-700">
          {errorMsg || "Náhled se nepodařilo zobrazit."}
        </div>
      )}
      {status === "ready" && (
        <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-xs text-white">
          Tažením otočíte · kolečko = zoom · pravé tlačítko = posun
        </p>
      )}
    </div>
  );
}
