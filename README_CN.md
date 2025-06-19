# 空间场景处理系统

基于深度估计和图像修复技术，将 2D 图像处理为 3D 空间场景的 Web 应用。

## 主要功能

- **深度估计**: 从 2D 图像生成深度图
- **图像修复**: 使用 AI 模型填补和增强图像
- **3D 可视化**: 渲染具有视差效果的分层深度图像(LDI)
- **画廊管理**: 保存和管理已处理的场景
- **跨平台**: 基于 Web 的界面，支持移动设备

## 技术栈

### 后端

- FastAPI 构建 REST API
- PyTorch 驱动 AI 模型
- Transformers 处理深度估计
- OpenCV 进行图像处理

### 前端

- React 18 + TypeScript
- Three.js + React Three Fiber
- Vite 开发工具
- TailwindCSS 样式框架

## 快速开始

### 环境要求

- Python 3.8+
- Node.js 18+
- 现代浏览器

### 安装配置

1. **后端启动**

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

2. **前端启动**

```bash
cd frontend
npm install
npm run dev
```

3. **访问应用**
   - 前端界面: http://localhost:5173
   - 后端 API: http://localhost:8000

## 使用方法

1. 通过 Web 界面上传图像
2. 系统将自动完成：
   - 生成深度图
   - 创建修复版本
   - 渲染为 3D 分层场景
3. 使用鼠标/触摸与 3D 场景交互
4. 将场景保存到画廊供后续查看

## 开发环境

使用提供的脚本快速启动开发环境：

- `./start-dev.sh` (Unix/Mac)
- `start-dev.bat` (Windows)

## 许可证

MIT License
