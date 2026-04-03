import React, { useEffect, useRef, useState } from 'react';
import { Camera, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { CubeState, CubeColor, FaceName, FACE_ORDER, FACE_LABELS, INITIAL_CUBE_STATE, detectColor } from '../lib/cubeUtils';

interface ScannerProps {
  onComplete: (state: CubeState) => void;
}

const Scanner: React.FC<ScannerProps> = ({ onComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentFaceIndex, setCurrentFaceIndex] = useState(0);
  const [scannedState, setScannedState] = useState<CubeState>(INITIAL_CUBE_STATE);

  const currentFace = FACE_ORDER[currentFaceIndex];

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setCameraActive(true);
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setError("Failed to access camera. Please ensure camera permissions are granted.");
      }
    };

    startCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const captureFace = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to match video to get a clear image
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    
    // Flip the canvas context to match the mirrored video feed
    ctx.translate(videoWidth, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

    // The grid overlay is 3/4 of the video's width and height.
    const gridContainerSize = Math.min(videoWidth, videoHeight) * 0.75; 
    const stickerSize = gridContainerSize / 3;
    const startX = (videoWidth - gridContainerSize) / 2;
    const startY = (videoHeight - gridContainerSize) / 2;

    const newFaceState: CubeColor[][] = [];

    for (let row = 0; row < 3; row++) {
      const newRow: CubeColor[] = [];
      for (let col = 0; col < 3; col++) {
        const x = startX + col * stickerSize + stickerSize / 2;
        const y = startY + row * stickerSize + stickerSize / 2;
        
        // Get pixel data from a small area in the center of the sticker
        const sampleSize = 10;
        const imageData = ctx.getImageData(x - sampleSize/2, y - sampleSize/2, sampleSize, sampleSize);
        const data = imageData.data;

        let r = 0, g = 0, b = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
        const pixelCount = data.length / 4;
        r = r / pixelCount;
        g = g / pixelCount;
        b = b / pixelCount;

        const detected = detectColor(r, g, b);
        newRow.push(detected);
      }
      newFaceState.push(newRow);
    }
    
    setScannedState(prevState => ({
      ...prevState,
      [currentFace]: newFaceState,
    }));

    if (currentFaceIndex < 5) {
      setCurrentFaceIndex(currentFaceIndex + 1);
    }
  };

  const handleFinish = () => {
    onComplete(scannedState);
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Scan Cube</h2>
          <p className="text-zinc-400">Step {currentFaceIndex + 1} of 6: Scan {FACE_LABELS[currentFace]}</p>
        </div>

        <div className="relative w-full max-w-lg mx-auto bg-gray-900 rounded-lg shadow-lg overflow-hidden">
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-500 bg-opacity-75 text-white p-4 z-10">
              <p>{error}</p>
            </div>
          )}
          {!cameraActive && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-white p-4 z-10">
              <p>Loading camera...</p>
            </div>
          )}
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-auto object-cover transform scale-x-[-1]" />
          
          <canvas ref={canvasRef} className="hidden" />

          {cameraActive && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="grid grid-cols-3 grid-rows-3 w-3/4 h-3/4 border-4 border-emerald-400/50">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border border-emerald-400/30"></div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => setCurrentFaceIndex(i => Math.max(0, i - 1))}
            disabled={currentFaceIndex === 0}
            className="p-4 rounded-full bg-zinc-900 border border-zinc-800 disabled:opacity-50 hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <button
            onClick={captureFace}
            className="flex-1 py-4 px-6 rounded-2xl bg-white text-black font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors shadow-lg active:scale-95"
          >
            <Camera className="w-6 h-6" />
            Capture Face
          </button>

          {currentFaceIndex === 5 ? (
            <button
              onClick={handleFinish}
              className="p-4 rounded-full bg-green-600 border border-green-500 hover:bg-green-500 transition-colors"
            >
              <Check className="w-6 h-6" />
            </button>
          ) : (
            <button
              onClick={() => setCurrentFaceIndex(i => Math.min(5, i + 1))}
              disabled={!cameraActive}
              className="p-4 rounded-full bg-zinc-900 border border-zinc-800 disabled:opacity-50 hover:bg-zinc-800 transition-colors"
            >
              <ArrowRight className="w-6 h-6" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-6 gap-2">
          {FACE_ORDER.map((face, i) => (
            <div
              key={face}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i < currentFaceIndex ? 'bg-white' : i === currentFaceIndex ? 'bg-emerald-400' : 'bg-zinc-800'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Scanner;
