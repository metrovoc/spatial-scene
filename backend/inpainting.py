from PIL import Image
import numpy as np
import torch
from lama import SimpleLama
import os
import cv2

class Inpainter:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(Inpainter, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, 'initialized'):
            print("Initializing Inpainter...")
            # Get the directory of the current script
            script_dir = os.path.dirname(os.path.realpath(__file__))
            model_path = os.path.join(script_dir, "models", "big-lama")

            self.device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
            print(f"Inpainter using device: {self.device}")
            
            self.lama = SimpleLama(device=self.device)
            self.initialized = True
            print("Inpainter initialized.")

    def inpaint_image(self, image: Image.Image, depth_map: Image.Image) -> tuple[Image.Image, Image.Image]:
        """
        Performs context-aware inpainting on an image based on a depth map.
        It identifies disocclusion areas from the depth map, inpaints both the
        color image and the depth map, and returns the results.
        """
        print("Starting context-aware inpainting...")

        # Convert PIL Images to numpy arrays for processing
        image_rgb = image.convert("RGB")
        image_np = np.array(image_rgb)
        depth_map_np = np.array(depth_map.convert("L"))

        # 1. Create a mask from depth discontinuities
        # Use Canny edge detector on the depth map to find sharp changes
        edges = cv2.Canny(depth_map_np, threshold1=50, threshold2=150)

        # Dilate the edges to create a wider mask for inpainting
        # This covers the area "behind" the edges that needs to be filled
        kernel = np.ones((15, 15), np.uint8)
        mask_dilated = cv2.dilate(edges, kernel, iterations=1)
        
        # Convert dilated mask to a PIL Image
        mask = Image.fromarray(mask_dilated)

        # 2. Inpaint the color image
        print("Inpainting color image...")
        inpainted_image = self.lama(image_rgb, mask)
        
        # 3. Inpaint the depth map
        print("Inpainting depth map...")
        # Use Navier-Stokes based inpainting from OpenCV
        inpainted_depth_np = cv2.inpaint(depth_map_np, mask_dilated, 10, cv2.INPAINT_NS)

        # Convert the results back to PIL Images
        inpainted_depth_map = Image.fromarray(inpainted_depth_np)

        print("Context-aware inpainting finished.")
        return inpainted_image, inpainted_depth_map

# Singleton instance
inpainter = Inpainter() 