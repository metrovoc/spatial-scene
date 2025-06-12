import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Plane, Text } from "@react-three/drei";
import { useState, useRef, useMemo, Suspense } from "react";
import * as THREE from "three";

function LdiScene({
  originalImage,
  depthMap,
}: {
  originalImage: string;
  depthMap: string;
}) {
  const layers = 10;
  const depth = 0.5;

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
          <Plane args={[5, 5]} position={[0, 0, layerDepth]} key={i}>
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setOriginalImage(URL.createObjectURL(file));
    setDepthMap(null);

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

  return (
    <main className="bg-slate-900 text-white min-h-screen">
      <header className="p-4 text-center">
        <h1 className="text-4xl font-bold">Spatial Scene</h1>
        <p className="text-slate-400">
          Upload an image to convert it into a 3D scene.
        </p>
      </header>

      <div className="w-full h-[60vh] border-y border-slate-700 relative">
        <Canvas camera={{ position: [0, 0, 5], fov: 30 }}>
          <ambientLight intensity={1.5} />
          <Suspense fallback={null}>
            {originalImage && depthMap ? (
              <LdiScene originalImage={originalImage} depthMap={depthMap} />
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
            <div className="text-white text-2xl">Processing...</div>
          </div>
        )}
      </div>

      <footer className="p-8 text-center">
        <div className="inline-block bg-slate-800 rounded-lg p-6 border border-slate-700">
          <p className="mb-4">
            {originalImage
              ? "Drag to explore the scene"
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
