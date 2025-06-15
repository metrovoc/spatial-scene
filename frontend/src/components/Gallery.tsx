import { useState, useEffect } from "react";

interface GalleryItem {
  id: string;
  title: string;
  created_at: string;
  image_size: { width: number; height: number };
  thumbnail: string;
}

interface GalleryScene {
  id: string;
  title: string;
  created_at: string;
  original_image: string;
  depth_map: string;
  inpainted_image: string;
  image_size: { width: number; height: number };
}

interface GalleryProps {
  onSelectScene: (scene: GalleryScene) => void;
  onClose: () => void;
}

const Gallery = ({ onSelectScene, onClose }: GalleryProps) => {
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScene, setSelectedScene] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadGallery();
  }, []);

  const loadGallery = async () => {
    try {
      const response = await fetch("/api/gallery");
      const data = await response.json();
      setGalleryItems(data);
    } catch (error) {
      console.error("Failed to load gallery:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadScene = async (sceneId: string) => {
    setSelectedScene(sceneId);
    try {
      const response = await fetch(`/api/gallery/${sceneId}`);
      const scene = await response.json();
      onSelectScene(scene);
      onClose();
    } catch (error) {
      console.error("Failed to load scene:", error);
      setSelectedScene(null);
    }
  };

  const deleteScene = async (sceneId: string) => {
    try {
      await fetch(`/api/gallery/${sceneId}`, { method: "DELETE" });
      setGalleryItems((items) => items.filter((item) => item.id !== sceneId));
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Failed to delete scene:", error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9998]">
        <div className="bg-slate-800 rounded-lg p-8 shadow-2xl">
          <div className="animate-pulse text-white text-xl">
            Loading gallery...
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9998] p-4">
        <div className="bg-slate-800 rounded-lg w-full h-full max-w-7xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-600">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-700 bg-slate-900 rounded-t-lg">
            <h2 className="text-2xl font-bold text-white">Scene Gallery</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-2xl font-bold w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 transition-colors"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6">
            {galleryItems.length === 0 ? (
              <div className="text-center text-slate-400 py-12">
                <svg
                  className="mx-auto h-16 w-16 text-slate-500 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-xl">No saved scenes yet</p>
                <p className="mt-2">
                  Process some images to build your gallery
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {galleryItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-700 rounded-lg overflow-hidden cursor-pointer hover:bg-slate-600 transition-all duration-200 relative group hover:shadow-lg hover:scale-[1.02]"
                    onClick={() => loadScene(item.id)}
                  >
                    {/* Thumbnail preview */}
                    <div className="aspect-square bg-slate-600 flex items-center justify-center relative overflow-hidden">
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = "none";
                            const parent = target.parentElement;
                            if (parent) {
                              const fallback = document.createElement("div");
                              fallback.className =
                                "flex items-center justify-center w-full h-full text-slate-400";
                              fallback.innerHTML =
                                '<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full text-slate-400">
                          <svg
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                          </svg>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white font-semibold">
                          View Scene
                        </span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <h3
                        className="text-white font-semibold truncate text-sm"
                        title={item.title}
                      >
                        {item.title}
                      </h3>
                      <p className="text-slate-400 text-xs mt-1">
                        {formatDate(item.created_at)}
                      </p>
                      <p className="text-slate-400 text-xs mt-1">
                        {item.image_size.width} × {item.image_size.height}
                      </p>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(item.id);
                      }}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                      title="Delete scene"
                    >
                      ×
                    </button>

                    {/* Loading indicator */}
                    {selectedScene === item.id && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <div className="animate-pulse text-white">
                          Loading...
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-600 shadow-2xl max-w-md mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">
              Delete Scene
            </h3>
            <p className="text-slate-300 mb-6">
              Are you sure you want to delete this scene? This action cannot be
              undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteScene(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Gallery;
