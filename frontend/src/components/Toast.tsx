import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  type: "success" | "error" | "info";
  duration?: number;
  onClose: () => void;
}

const Toast = ({ message, type, duration = 3000, onClose }: ToastProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for animation to complete
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getTypeStyles = () => {
    switch (type) {
      case "success":
        return "bg-green-600 border-green-500";
      case "error":
        return "bg-red-600 border-red-500";
      case "info":
        return "bg-blue-600 border-blue-500";
      default:
        return "bg-slate-600 border-slate-500";
    }
  };

  return (
    <div
      className={`fixed top-4 right-4 z-[9999] transform transition-all duration-300 ${
        isVisible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      }`}
    >
      <div
        className={`${getTypeStyles()} text-white px-6 py-3 rounded-lg border shadow-lg flex items-center gap-3 min-w-[300px]`}
      >
        <div className="flex-1">
          <p className="font-medium">{message}</p>
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
          className="text-white hover:text-gray-200 text-xl font-bold leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default Toast;
