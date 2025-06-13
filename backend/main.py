from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import io
import base64
import json
import os
from datetime import datetime
from typing import List, Dict
from depth_estimation import depth_estimator
from inpainting import inpainter

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create gallery directory if it doesn't exist
GALLERY_DIR = "gallery"
os.makedirs(GALLERY_DIR, exist_ok=True)

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.post("/process-image")
async def process_image(file: UploadFile = File(...), inpaint: bool = Form(True)):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))
    
    # 1. Estimate Depth
    depth_map_image = depth_estimator.estimate_depth(image)
    
    # 2. Inpaint Image (and depth map)
    inpainted_image, inpainted_depth_map = inpainter.inpaint_image(image, depth_map_image, enabled=inpaint)

    # 3. Encode all images to Base64
    def image_to_base64(img: Image.Image) -> str:
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        encoded = base64.b64encode(buffered.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{encoded}"

    original_base64 = image_to_base64(image.convert("RGB"))
    depth_map_base64 = image_to_base64(inpainted_depth_map)
    inpainted_base64 = image_to_base64(inpainted_image)

    return {
        "original_image": original_base64,
        "depth_map": depth_map_base64,
        "inpainted_image": inpainted_base64
    }

@app.post("/save-to-gallery")
async def save_to_gallery(data: Dict):
    """Save processed scene to gallery"""
    try:
        # Generate unique ID for this scene
        scene_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:20]
        
        scene_data = {
            "id": scene_id,
            "created_at": datetime.now().isoformat(),
            "title": data.get("title", f"Scene {scene_id}"),
            "original_image": data["original_image"],
            "depth_map": data["depth_map"], 
            "inpainted_image": data["inpainted_image"],
            "image_size": data.get("image_size", {"width": 1024, "height": 1024})
        }
        
        # Save scene data
        scene_file = os.path.join(GALLERY_DIR, f"{scene_id}.json")
        with open(scene_file, "w") as f:
            json.dump(scene_data, f)
            
        return {"success": True, "scene_id": scene_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save scene: {str(e)}")

@app.get("/gallery")
async def get_gallery() -> List[Dict]:
    """Get all saved scenes in gallery"""
    try:
        scenes = []
        if os.path.exists(GALLERY_DIR):
            for filename in os.listdir(GALLERY_DIR):
                if filename.endswith(".json"):
                    scene_file = os.path.join(GALLERY_DIR, filename)
                    with open(scene_file, "r") as f:
                        scene_data = json.load(f)
                        # Only include metadata for gallery list (without full image data)
                        scenes.append({
                            "id": scene_data["id"],
                            "title": scene_data["title"],
                            "created_at": scene_data["created_at"],
                            "image_size": scene_data["image_size"],
                            "thumbnail": scene_data["original_image"]  # Full image for thumbnail
                        })
        
        # Sort by creation date (newest first)
        scenes.sort(key=lambda x: x["created_at"], reverse=True)
        return scenes
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get gallery: {str(e)}")

@app.get("/gallery/{scene_id}")
async def get_scene(scene_id: str) -> Dict:
    """Get full scene data by ID"""
    try:
        scene_file = os.path.join(GALLERY_DIR, f"{scene_id}.json")
        if not os.path.exists(scene_file):
            raise HTTPException(status_code=404, detail="Scene not found")
            
        with open(scene_file, "r") as f:
            scene_data = json.load(f)
            
        return scene_data
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Failed to get scene: {str(e)}")

@app.delete("/gallery/{scene_id}")
async def delete_scene(scene_id: str):
    """Delete scene from gallery"""
    try:
        scene_file = os.path.join(GALLERY_DIR, f"{scene_id}.json")
        if not os.path.exists(scene_file):
            raise HTTPException(status_code=404, detail="Scene not found")
            
        os.remove(scene_file)
        return {"success": True}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Failed to delete scene: {str(e)}") 