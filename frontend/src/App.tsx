import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Plane, Text } from "@react-three/drei";
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

// This is the new, advanced LDI renderer with true parallax.
function LdiLayers({
  inpaintedImage,
  depthMap,
  planeWidth,
  planeHeight,
  isGyroEnabled,
}: {
  inpaintedImage: string;
  depthMap: string;
  planeWidth: number;
  planeHeight: number;
  isGyroEnabled: boolean;
}) {
  const layers = 32; // More layers for a smoother effect
  const parallaxFactor = 0.05; // How much the layers shift

  const texture = useMemo(
    () => new THREE.TextureLoader().load(inpaintedImage),
    [inpaintedImage]
  );
  const depthTexture = useMemo(
    () => new THREE.TextureLoader().load(depthMap),
    [depthMap]
  );

  const isMobile = useMemo(
    () =>
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ),
    []
  );

  const parallax = useRef(new THREE.Vector2(0, 0));
  const targetParallax = useRef(new THREE.Vector2(0, 0));

  useEffect(() => {
    if (!isMobile || !isGyroEnabled) return;

    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma === null || event.beta === null) return;

      const maxTilt = 15; // Max tilt in degrees
      const gamma = event.gamma; // Left-to-right tilt [-90, 90]
      const beta = event.beta; // Front-to-back tilt [-180, 180]

      const x = Math.min(Math.max(gamma, -maxTilt), maxTilt) / maxTilt;
      const neutralBeta = 0; // When the device is flat, beta is 0.
      const y =
        Math.min(Math.max(beta - neutralBeta, -maxTilt), maxTilt) / maxTilt;

      targetParallax.current.set(x, y);
    };

    window.addEventListener("deviceorientation", handleDeviceOrientation);

    return () => {
      window.removeEventListener("deviceorientation", handleDeviceOrientation);
    };
  }, [isMobile, isGyroEnabled]);

  useFrame(({ mouse }) => {
    if (!isMobile) {
      targetParallax.current.set(mouse.x, mouse.y);
    }
    parallax.current.lerp(targetParallax.current, 0.05);
  });

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform sampler2D uTexture;
    uniform sampler2D uDepthMap;
    uniform int uLayer;
    uniform int uLayers;
    uniform vec2 uMouse;
    uniform float uParallax;
    varying vec2 vUv;

    void main() {
      float layer_depth = float(uLayer) / float(uLayers);
      
      // Calculate parallax offset
      vec2 parallaxOffset = uMouse * uParallax * layer_depth;
      vec2 parallaxUv = vUv - parallaxOffset;

      if (parallaxUv.x < 0.0 || parallaxUv.x > 1.0 || parallaxUv.y < 0.0 || parallaxUv.y > 1.0) {
        discard;
      }
      
      float scene_depth = texture2D(uDepthMap, parallaxUv).r;

      float slice_width = 1.0 / float(uLayers);
      float slice_floor = layer_depth;
      float slice_ceil = slice_floor + slice_width;

      // Use smoothstep for soft layer blending
      float fuzz = slice_width * 0.4;
      float alpha = smoothstep(slice_floor - fuzz, slice_floor, scene_depth) - smoothstep(slice_ceil, slice_ceil + fuzz, scene_depth);

      if (alpha < 0.01) {
        discard;
      }

      vec4 color = texture2D(uTexture, parallaxUv);
      gl_FragColor = vec4(color.rgb, color.a * alpha);
    }
  `;

  return (
    <>
      {Array.from({ length: layers }).map((_, i) => {
        const layerZ = i * 0.001; // Stagger layers slightly to handle transparency correctly

        const uniforms = {
          uTexture: { value: texture },
          uDepthMap: { value: depthTexture },
          uLayer: { value: i },
          uLayers: { value: layers },
          uMouse: { value: parallax.current },
          uParallax: { value: parallaxFactor },
        };

        return (
          <Plane
            args={[planeWidth, planeHeight]}
            position={[0, 0, layerZ]}
            key={i}
          >
            <shaderMaterial
              vertexShader={vertexShader}
              fragmentShader={fragmentShader}
              uniforms={uniforms}
              transparent={true}
              depthWrite={false}
            />
          </Plane>
        );
      })}
    </>
  );
}

function SpatialScene({
  inpaintedImage,
  depthMap,
  imageSize,
  isGyroEnabled,
}: {
  inpaintedImage: string;
  depthMap: string;
  imageSize: { width: number; height: number };
  isGyroEnabled: boolean;
}) {
  const { camera, size: canvasSize } = useThree();

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

  return (
    <group>
      <LdiLayers
        inpaintedImage={inpaintedImage}
        depthMap={depthMap}
        planeWidth={basePlaneWidth}
        planeHeight={planeHeight}
        isGyroEnabled={isGyroEnabled}
      />
    </group>
  );
}

function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [inpaintedImage, setInpaintedImage] = useState<string | null>(null);
  const [depthMap, setDepthMap] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const [isInpaintingEnabled, setIsInpaintingEnabled] = useState(true);
  const [gyroPermissionState, setGyroPermissionState] = useState<
    "prompt" | "granted" | "denied"
  >("prompt");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const isMobile = useMemo(
    () =>
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ),
    []
  );

  useEffect(() => {
    // For non-iOS devices that support DeviceOrientation out of the box (e.g., Android in secure contexts)
    if (
      isMobile &&
      typeof (DeviceOrientationEvent as any).requestPermission !== "function"
    ) {
      setGyroPermissionState("granted");
    }
  }, [isMobile]);

  // Effect to handle cleanup of blob URL for the initial upload
  useEffect(() => {
    let blobUrl: string | null = null;
    if (originalImage && originalImage.startsWith("blob:")) {
      blobUrl = originalImage;
    }

    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [originalImage]);

  const handleRequestGyroPermission = () => {
    (DeviceOrientationEvent as any)
      .requestPermission()
      .then((permissionState: string) => {
        if (permissionState === "granted") {
          setGyroPermissionState("granted");
        } else {
          setGyroPermissionState("denied");
          alert("Gyroscope permission not granted.");
        }
      })
      .catch((error: any) => {
        console.error(error);
        setGyroPermissionState("denied");
        alert("Error requesting gyroscope permission.");
      });
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    // Use a blob URL only for the initial preview
    const previewUrl = URL.createObjectURL(file);
    setOriginalImage(previewUrl);
    setDepthMap(null);
    setInpaintedImage(null);

    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = previewUrl;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("inpaint", String(isInpaintingEnabled));

    try {
      const response = await fetch("/api/process-image", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      // Now use the persistent base64 URLs from the server
      setOriginalImage(data.original_image);
      setDepthMap(data.depth_map);
      setInpaintedImage(data.inpainted_image);
    } catch (error) {
      console.error("Error processing image:", error);
      // Reset on error
      setOriginalImage(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFullscreen = () => {
    if (screenfull.isEnabled && canvasContainerRef.current) {
      screenfull.toggle(canvasContainerRef.current).catch(() => {
        alert("Could not activate fullscreen mode.");
      });
    } else {
      alert("Fullscreen is not supported on this device.");
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const hasContent = inpaintedImage && depthMap;

  return (
    <main className="bg-slate-900 text-white min-h-screen">
      <header className="p-4 text-center">
        <h1 className="text-4xl font-bold">Spatial Scene</h1>
        <p className="text-slate-400">
          Upload an image to convert it into a 3D scene with real parallax.
        </p>
      </header>
      {isMobile && gyroPermissionState === "prompt" && (
        <div className="flex justify-center mb-4">
          <button
            onClick={handleRequestGyroPermission}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-indigo-700 transition-colors"
          >
            Enable Gyroscope for Motion Control
          </button>
        </div>
      )}
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
            {inpaintedImage && depthMap ? (
              <SpatialScene
                inpaintedImage={inpaintedImage}
                depthMap={depthMap}
                imageSize={imageSize}
                isGyroEnabled={gyroPermissionState === "granted"}
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
              ? "Move your mouse or device to experience the parallax effect"
              : "Select an image to begin"}
          </p>
          <div className="flex items-center justify-center mb-4">
            <input
              type="checkbox"
              id="inpainting-toggle"
              checked={isInpaintingEnabled}
              onChange={(e) => setIsInpaintingEnabled(e.target.checked)}
              className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500"
            />
            <label
              htmlFor="inpainting-toggle"
              className="ml-2 text-sm font-medium text-gray-300"
            >
              Enable Inpainting
            </label>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            className="hidden"
            accept="image/*"
          />
          <button
            onClick={triggerFileInput}
            disabled={isLoading}
            className="bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-600 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Processing..." : "Upload Image"}
          </button>
        </div>
      </footer>
    </main>
  );
}

export default App;
