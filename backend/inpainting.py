from PIL import Image
import numpy as np
import torch
from simple_lama_inpainting import SimpleLama
import os

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

    def inpaint_image(self, image: Image.Image) -> Image.Image:
        """
        Performs inpainting on the entire image to fill potential missing areas.
        """
        print("Starting image inpainting...")
        
        # Create a mask that covers the entire image
        mask = Image.fromarray(np.ones((image.height, image.width), dtype=np.uint8) * 255)

        # The library expects the image in RGB format
        image_rgb = image.convert("RGB")
        
        inpainted_image = self.lama(image_rgb, mask)
        
        print("Image inpainting finished.")
        return inpainted_image

# Singleton instance
inpainter = Inpainter() 