import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Plane } from "@react-three/drei";
import { useState, useRef, useMemo, useEffect } from "react";
import * as THREE from "three";

interface AdvancedLDIProps {
  inpaintedImage: string;
  depthMap: string;
  planeWidth: number;
  planeHeight: number;
  isGyroEnabled: boolean;
  cameraPosition?: THREE.Vector3;
  targetPosition?: THREE.Vector3;
}

export function AdvancedLDIRenderer({
  inpaintedImage,
  depthMap,
  planeWidth,
  planeHeight,
  isGyroEnabled,
  cameraPosition,
  targetPosition,
}: AdvancedLDIProps) {
  const { camera } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const [adaptiveLayers, setAdaptiveLayers] = useState(32);

  // Load textures
  const texture = useMemo(
    () => new THREE.TextureLoader().load(inpaintedImage),
    [inpaintedImage]
  );

  const depthTexture = useMemo(
    () => new THREE.TextureLoader().load(depthMap),
    [depthMap]
  );

  const parallax = useRef(new THREE.Vector2(0, 0));
  const targetParallax = useRef(new THREE.Vector2(0, 0));
  const prevCameraPosition = useRef(new THREE.Vector3());
  const frameBuffer = useRef<THREE.WebGLRenderTarget | null>(null);

  // Advanced fragment shader with adaptive occlusion handling
  const advancedFragmentShader = `
    uniform sampler2D uTexture;
    uniform sampler2D uDepthMap;
    uniform sampler2D uPrevFrame;
    uniform int uLayer;
    uniform int uLayers;
    uniform vec2 uMouse;
    uniform float uParallax;
    uniform vec3 uCameraPosition;
    uniform vec3 uPrevCameraPosition;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform bool uTemporalConsistency;
    
    varying vec2 vUv;

    // Noise function for temporal dithering
    float rand(vec2 co) {
        return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    // Advanced depth-aware parallax mapping
    vec2 getParallaxUV(vec2 uv, float depth, vec2 parallaxOffset) {
        // Non-linear parallax based on depth
        float depthFactor = 1.0 - depth;
        depthFactor = depthFactor * depthFactor; // Square for more realistic effect
        
        // Adaptive parallax strength based on camera movement
        vec3 cameraMovement = uCameraPosition - uPrevCameraPosition;
        float movementMagnitude = length(cameraMovement);
        float adaptiveParallax = uParallax * (1.0 + movementMagnitude * 0.5);
        
        return uv - parallaxOffset * adaptiveParallax * depthFactor;
    }

    // Multi-scale hole detection
    bool isHole(vec2 uv) {
        vec2 pixelSize = 1.0 / uResolution;
        
        // Sample surrounding pixels for depth discontinuity
        float centerDepth = texture2D(uDepthMap, uv).r;
        float threshold = 0.1;
        
        for (int i = -1; i <= 1; i++) {
            for (int j = -1; j <= 1; j++) {
                if (i == 0 && j == 0) continue;
                
                vec2 sampleUV = uv + vec2(float(i), float(j)) * pixelSize;
                float sampleDepth = texture2D(uDepthMap, sampleUV).r;
                
                if (abs(centerDepth - sampleDepth) > threshold) {
                    return true;
                }
            }
        }
        
        return false;
    }

    // Advanced hole filling with temporal consistency
    vec4 fillHole(vec2 uv) {
        vec2 pixelSize = 1.0 / uResolution;
        vec4 filledColor = vec4(0.0);
        float totalWeight = 0.0;
        
        // Multi-scale sampling for structure-aware filling
        for (int scale = 1; scale <= 3; scale++) {
            float radius = float(scale) * 2.0;
            int samples = scale * 4;
            
            for (int i = 0; i < samples; i++) {
                float angle = 2.0 * 3.14159 * float(i) / float(samples);
                vec2 sampleOffset = radius * pixelSize * vec2(cos(angle), sin(angle));
                vec2 sampleUV = uv + sampleOffset;
                
                if (sampleUV.x >= 0.0 && sampleUV.x <= 1.0 && 
                    sampleUV.y >= 0.0 && sampleUV.y <= 1.0) {
                    
                    vec4 sampleColor = texture2D(uTexture, sampleUV);
                    float sampleDepth = texture2D(uDepthMap, sampleUV).r;
                    
                    // Weight based on distance and depth similarity
                    float weight = 1.0 / (1.0 + radius);
                    weight *= 1.0 / (1.0 + abs(sampleDepth - texture2D(uDepthMap, uv).r) * 10.0);
                    
                    filledColor += sampleColor * weight;
                    totalWeight += weight;
                }
            }
        }
        
        // Temporal consistency
        if (uTemporalConsistency) {
            vec4 prevFrameColor = texture2D(uPrevFrame, uv);
            float temporalWeight = 0.3;
            filledColor += prevFrameColor * temporalWeight;
            totalWeight += temporalWeight;
        }
        
        return totalWeight > 0.0 ? filledColor / totalWeight : vec4(0.0, 0.0, 0.0, 1.0);
    }

    void main() {
        float layer_depth = float(uLayer) / float(uLayers);
        
        // Enhanced parallax calculation
        vec2 parallaxUv = getParallaxUV(vUv, layer_depth, uMouse);
        
        // Boundary check with soft falloff
        float fadeDistance = 0.02;
        float fadeX = min(
            smoothstep(0.0, fadeDistance, parallaxUv.x),
            smoothstep(1.0, 1.0 - fadeDistance, parallaxUv.x)
        );
        float fadeY = min(
            smoothstep(0.0, fadeDistance, parallaxUv.y),
            smoothstep(1.0, 1.0 - fadeDistance, parallaxUv.y)
        );
        float boundaryFade = fadeX * fadeY;
        
        if (boundaryFade < 0.01) {
            discard;
        }
        
        // Sample depth and determine layer visibility
        float scene_depth = texture2D(uDepthMap, parallaxUv).r;
        float slice_width = 1.0 / float(uLayers);
        float slice_floor = layer_depth;
        float slice_ceil = slice_floor + slice_width;
        
        // Improved layer blending with adaptive fuzziness
        float adaptiveFuzz = slice_width * (0.2 + 0.3 * length(uMouse));
        float alpha = smoothstep(slice_floor - adaptiveFuzz, slice_floor, scene_depth) - 
                     smoothstep(slice_ceil, slice_ceil + adaptiveFuzz, scene_depth);
        
        if (alpha < 0.01) {
            discard;
        }
        
        // Sample color with hole detection and filling
        vec4 color;
        if (isHole(parallaxUv)) {
            color = fillHole(parallaxUv);
        } else {
            color = texture2D(uTexture, parallaxUv);
        }
        
        // Apply boundary fade and temporal dithering
        color.a *= alpha * boundaryFade;
        
        // Temporal dithering to reduce artifacts
        float dither = (rand(parallaxUv + vec2(uTime)) - 0.5) * 0.02;
        color.rgb += dither;
        
        gl_FragColor = color;
    }
  `;

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  // Update camera movement tracking
  useFrame((state) => {
    if (!isGyroEnabled) {
      targetParallax.current.set(state.mouse.x, state.mouse.y);
    }
    parallax.current.lerp(targetParallax.current, 0.05);

    // Track camera position for occlusion prediction
    const currentPos = state.camera.position;
    if (!prevCameraPosition.current.equals(currentPos)) {
      prevCameraPosition.current.copy(currentPos);
    }
  });

  // Adaptive layer count based on camera movement
  useEffect(() => {
    const updateLayers = () => {
      if (camera && prevCameraPosition.current) {
        const movement = camera.position.distanceTo(prevCameraPosition.current);
        // More layers for larger movements to reduce artifacts
        const newLayers = Math.min(
          64,
          Math.max(16, Math.floor(32 + movement * 100))
        );
        setAdaptiveLayers(newLayers);
      }
    };

    const interval = setInterval(updateLayers, 100);
    return () => clearInterval(interval);
  }, [camera]);

  // Create render layers
  const renderLayers = useMemo(() => {
    return Array.from({ length: adaptiveLayers }).map((_, i) => {
      const layerZ = i * 0.001;

      const uniforms = {
        uTexture: { value: texture },
        uDepthMap: { value: depthTexture },
        uPrevFrame: { value: frameBuffer.current?.texture || null },
        uLayer: { value: i },
        uLayers: { value: adaptiveLayers },
        uMouse: { value: parallax.current },
        uParallax: { value: 0.05 },
        uCameraPosition: { value: camera?.position || new THREE.Vector3() },
        uPrevCameraPosition: { value: prevCameraPosition.current },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1024, 1024) },
        uTemporalConsistency: { value: true },
      };

      return (
        <Plane
          args={[planeWidth, planeHeight]}
          position={[0, 0, layerZ]}
          key={`${i}-${adaptiveLayers}`}
          ref={i === 0 ? meshRef : undefined}
        >
          <shaderMaterial
            vertexShader={vertexShader}
            fragmentShader={advancedFragmentShader}
            uniforms={uniforms}
            transparent={true}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </Plane>
      );
    });
  }, [adaptiveLayers, texture, depthTexture, planeWidth, planeHeight, camera]);

  return <group>{renderLayers}</group>;
}
