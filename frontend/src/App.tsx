import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Plane, Text } from "@react-three/drei";
import { useState, useRef, useMemo, Suspense, useEffect } from "react";
import * as THREE from "three";
import screenfull from "screenfull";

// Inlining the icon component to avoid module resolution issues.
const FullscreenIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-white"
  >
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
  </svg>
);

const LDI_PLANE_WIDTH = 5; // Base width for our 3D plane in world units

function LdiLayers({
  layers,
  depth,
  originalImage,
  depthMap,
  planeWidth,
  planeHeight,
}: {
  layers: number;
  depth: number;
  originalImage: string;
  depthMap: string;
  planeWidth: number;
  planeHeight: number;
}) {
  const originalTexture = useMemo(
    () => new THREE.TextureLoader().load(originalImage),
    [originalImage]
  );
  const depthTexture = useMemo(
    () => new THREE.TextureLoader().load(depthMap),
    [depthMap]
  );

  originalTexture.wrapS = originalTexture.wrapT = THREE.RepeatWrapping;
  depthTexture.wrapS = depthTexture.wrapT = THREE.RepeatWrapping;

  return (
    <>
      {Array.from({ length: layers }).map((_, i) => {
        const layerZ = (i / (layers - 1)) * depth - depth / 2;
        const depthSlice = i / (layers - 1);

        return (
          <Plane
            args={[planeWidth, planeHeight]}
            position={[0, 0, layerZ]}
            key={i}
          >
            <meshStandardMaterial
              map={originalTexture}
              depthTest={false}
              transparent={true}
              onBeforeCompile={(shader) => {
                shader.uniforms.depthMap = { value: depthTexture };
                shader.uniforms.u_depth_slice = { value: depthSlice };
                shader.uniforms.u_layers_count = { value: layers };
                shader.uniforms.u_scene_depth = { value: depth };

                shader.vertexShader = `
                uniform sampler2D depthMap;
                varying float v_depth;
                ${shader.vertexShader}
              `.replace(
                  `#include <begin_vertex>`,
                  `#include <begin_vertex>
                vec4 depth_color = texture2D(depthMap, uv);
                v_depth = depth_color.r;
                `
                );

                shader.fragmentShader = `
                uniform float u_depth_slice;
                uniform float u_layers_count;
                varying float v_depth;
                ${shader.fragmentShader}
              `.replace(
                  `vec4 diffuseColor = vec4( diffuse, opacity );`,
                  `
                float depth_threshold = (1.0 / u_layers_count) * 0.5;
                float alpha = smoothstep(u_depth_slice - depth_threshold, u_depth_slice, v_depth) - smoothstep(u_depth_slice, u_depth_slice + depth_threshold, v_depth);
                vec4 diffuseColor = vec4(diffuse, alpha * opacity);
                `
                );
              }}
            />
          </Plane>
        );
      })}
    </>
  );
}

function SpatialScene({
  originalImage,
  depthMap,
  imageSize,
}: {
  originalImage: string;
  depthMap: string;
  imageSize: { width: number; height: number };
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const { camera, size: canvasSize } = useThree();

  const layers = 16;
  const sceneDepth = 0.5;
  const basePlaneWidth = 5;

  const imageAspect = imageSize.width / imageSize.height;
  const planeHeight = basePlaneWidth / imageAspect;

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;

    const verticalFov = camera.fov * (Math.PI / 180);
    const canvasAspect = canvasSize.width / canvasSize.height;

    let distance;
    if (imageAspect > canvasAspect) {
      const horizontalFov =
        2 * Math.atan(Math.tan(verticalFov / 2) * canvasAspect);
      distance = basePlaneWidth / 2 / Math.tan(horizontalFov / 2);
    } else {
      distance = planeHeight / 2 / Math.tan(verticalFov / 2);
    }

    camera.position.z = distance * 1.2;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, canvasSize, imageSize, planeHeight, imageAspect]);

  useFrame(({ mouse }) => {
    if (groupRef.current) {
      const x = (mouse.x * Math.PI) / 12;
      const y = (mouse.y * Math.PI) / 12;
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        -y,
        0.05
      );
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        x,
        0.05
      );
    }
  });

  return (
    <group ref={groupRef}>
      <LdiLayers
        layers={layers}
        depth={sceneDepth}
        originalImage={originalImage}
        depthMap={depthMap}
        planeWidth={basePlaneWidth}
        planeHeight={planeHeight}
      />
    </group>
  );
}

function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [depthMap, setDepthMap] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Effect to handle cleanup of blob URLs
  useEffect(() => {
    return () => {
      if (originalImage) {
        URL.revokeObjectURL(originalImage);
      }
    };
  }, [originalImage]);

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const imageUrl = URL.createObjectURL(file);
    setOriginalImage(imageUrl);
    setDepthMap(null);

    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = imageUrl;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://127.0.0.1:8000/process-image", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      setDepthMap(data.depth_map);
    } catch (error) {
      console.error("Error processing image:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFullscreen = () => {
    if (screenfull.isEnabled && canvasContainerRef.current) {
      screenfull.toggle(canvasContainerRef.current);
    }
  };

  return (
    <main className="bg-slate-900 text-white min-h-screen">
      <header className="p-4 text-center">
        <h1 className="text-4xl font-bold">Spatial Scene</h1>
        <p className="text-slate-400">
          Upload an image to convert it into a 3D scene.
        </p>
      </header>

      <div
        ref={canvasContainerRef}
        className="w-full h-[60vh] border-y border-slate-700 relative bg-black"
      >
        <button
          onClick={handleFullscreen}
          className="absolute top-2 right-2 z-10 p-2 bg-slate-700 bg-opacity-50 rounded-md hover:bg-opacity-75 transition-colors"
          title="Toggle Fullscreen"
        >
          <FullscreenIcon />
        </button>
        <Canvas camera={{ fov: 45 }}>
          <ambientLight intensity={1.5} />
          <Suspense fallback={null}>
            {originalImage && depthMap ? (
              <SpatialScene
                originalImage={originalImage}
                depthMap={depthMap}
                imageSize={imageSize}
              />
            ) : (
              <Text color="white" anchorX="center" anchorY="middle">
                {isLoading ? "Processing..." : "Upload an image"}
              </Text>
            )}
          </Suspense>
        </Canvas>
        {isLoading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="animate-pulse text-white text-2xl">
              Processing...
            </div>
          </div>
        )}
      </div>

      <footer className="p-8 text-center">
        <div className="inline-block bg-slate-800 rounded-lg p-6 border border-slate-700">
          <p className="mb-4">
            {originalImage
              ? "Move your mouse to explore the scene"
              : "Select an image to begin"}
          </p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            className="hidden"
            accept="image/*"
            disabled={isLoading}
          />
          <button
            onClick={triggerFileInput}
            disabled={isLoading}
            className="
              py-2 px-4 rounded-full border-0
              text-sm font-semibold
              bg-violet-50 text-violet-700
              hover:bg-violet-100
              disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed
            "
          >
            {isLoading
              ? "Processing..."
              : originalImage
              ? "Change Image"
              : "Upload Image"}
          </button>
        </div>
      </footer>
    </main>
  );
}

export default App;
