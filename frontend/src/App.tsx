import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Plane, Text } from "@react-three/drei";
import { useState, useRef, useMemo, Suspense } from "react";
import * as THREE from "three";
import screenfull from "screenfull";
import { FullscreenIcon } from "./FullscreenIcon";

function LdiScene({
  originalImage,
  depthMap,
  imageSize,
}: {
  originalImage: string;
  depthMap: string;
  imageSize: { width: number; height: number };
}) {
  const layers = 10;
  const depth = 0.5;

  const { width, height } = imageSize;
  const aspect = width / height;

  const planeWidth = 5;
  const planeHeight = 5 / aspect;

  const originalTexture = useMemo(
    () => new THREE.TextureLoader().load(originalImage),
    [originalImage]
  );
  const depthTexture = useMemo(
    () => new THREE.TextureLoader().load(depthMap),
    [depthMap]
  );

  const onBeforeCompile = (shader: any) => {
    shader.uniforms.depthMap = { value: depthTexture };
    shader.uniforms.z_offset = { value: 0 };

    shader.vertexShader = `
      uniform sampler2D depthMap;
      varying float v_depth;
      ${shader.vertexShader}
    `.replace(
      `#include <begin_vertex>`,
      `#include <begin_vertex>
      vec4 depth_color = texture2D(depthMap, uv);
      float depth_value = depth_color.r;
      v_depth = depth_value;
      transformed.z += depth_value * 0.1;`
    );

    shader.fragmentShader = `
        varying float v_depth;
        ${shader.fragmentShader}
    `.replace(
      `vec4 diffuseColor = vec4( diffuse, opacity );`,
      `vec4 diffuseColor = vec4( diffuse, opacity );
         if (v_depth < 0.1) discard;`
    );
  };

  return (
    <>
      {Array.from({ length: layers }).map((_, i) => {
        const layerDepth = (i / (layers - 1)) * depth - depth / 2;
        const planeOpacity = i === 0 ? 1 : 1.0 / layers;

        return (
          <Plane
            args={[planeWidth, planeHeight]}
            position={[0, 0, layerDepth]}
            key={i}
          >
            <meshStandardMaterial
              map={originalTexture}
              transparent={true}
              onBeforeCompile={onBeforeCompile}
            />
          </Plane>
        );
      })}
    </>
  );
}

function SceneController() {
  const { camera } = useThree();
  useFrame(({ mouse }) => {
    const x = mouse.x * 0.1;
    const y = mouse.y * 0.1;
    camera.position.lerp(new THREE.Vector3(x, y, 5), 0.05);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [depthMap, setDepthMap] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

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
        <Canvas camera={{ position: [0, 0, 5], fov: 30 }}>
          <ambientLight intensity={1.5} />
          <Suspense fallback={null}>
            {originalImage && depthMap ? (
              <LdiScene
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
          <SceneController />
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
