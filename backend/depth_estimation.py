import torch
from transformers import AutoImageProcessor, AutoModelForDepthEstimation
from PIL import Image
import numpy as np

class DepthEstimator:
    def __init__(self):
        self.processor = AutoImageProcessor.from_pretrained("depth-anything/Depth-Anything-V2-Large-hf", use_fast=True)
        self.model = AutoModelForDepthEstimation.from_pretrained("depth-anything/Depth-Anything-V2-Large-hf")
        self.device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
        self.model.to(self.device)

    def estimate_depth(self, image: Image.Image) -> Image.Image:
        if image.mode != 'RGB':
            image = image.convert('RGB')
            
        inputs = self.processor(images=image, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = self.model(**inputs)
            predicted_depth = outputs.predicted_depth

        # Interpolate to original size
        prediction = torch.nn.functional.interpolate(
            predicted_depth.unsqueeze(1),
            size=image.size[::-1],
            mode="bicubic",
            align_corners=False,
        )

        # Normalize and convert to an image
        output = prediction.squeeze().cpu().numpy()
        formatted = (output * 255 / np.max(output)).astype(np.uint8)
        depth_image = Image.fromarray(formatted)

        return depth_image

# Singleton instance
depth_estimator = DepthEstimator() 