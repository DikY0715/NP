import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { ChevronLeft, Flashlight, Image as ImageIcon, Keyboard, Sparkles, TriangleAlert } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { recognizeMedicine } from '@/lib/ai';
import type { Medicine } from '@/types';

interface ScanScreenProps {
  /** 自定义确认录入逻辑（如管理员入库到实体柜）；不传则走居民端默认逻辑 */
  onConfirm?: (medicine: Medicine) => Promise<void>;
  /** 确认按钮文案 */
  confirmLabel?: string;
  /** 是否显示"手动输入"入口（管理员端隐藏） */
  showManualInput?: boolean;
}

export default function ScanScreen({
  onConfirm,
  confirmLabel = '确认录入',
  showManualInput = true,
}: ScanScreenProps = {}) {
  const { dispatch, actions } = useApp();
  const [scanning, setScanning] = useState(true);
  const [showResult, setShowResult] = useState(false);
  const [scannedMedicine, setScannedMedicine] = useState<Medicine | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [flashOn, setFlashOn] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 启动真实摄像头
  useEffect(() => {
    startCamera();
    return () => {
      // 清理：停止摄像头
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      setCameraError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError('无法访问摄像头，请检查权限设置');
    }
  };

  const toggleFlash = async () => {
    if (!streamRef.current) {
      dispatch({ type: 'SHOW_TOAST', message: '摄像头未启动' });
      return;
    }
    try {
      const track = streamRef.current.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any;
      if (capabilities.torch) {
        await track.applyConstraints({ advanced: [{ torch: !flashOn }] as any });
        setFlashOn(!flashOn);
        dispatch({ type: 'SHOW_TOAST', message: !flashOn ? '手电筒已打开' : '手电筒已关闭' });
      } else {
        dispatch({ type: 'SHOW_TOAST', message: '您的设备不支持闪光灯控制' });
      }
    } catch (err) {
      console.error('Flash error:', err);
      dispatch({ type: 'SHOW_TOAST', message: '手电筒控制失败' });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // 截取摄像头当前画面，并压缩到 1024px 以内以控制上传体积
  const captureFrame = (): string => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      throw new Error('摄像头画面未就绪，请稍后重试');
    }
    const maxSide = 1024;
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('画面截取失败');
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  // 相册图片同样需要压缩，避免超出模型图片体积限制
  const downscaleImage = (dataUrl: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 1024;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('图片处理失败'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error('图片解析失败'));
      img.src = dataUrl;
    });

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(file);
    });

  // 交给后端 AI 识别药盒信息
  const runRecognition = async (imageDataUrl: string) => {
    setRecognizing(true);
    try {
      const recognized = await recognizeMedicine(imageDataUrl);
      setScannedMedicine({
        id: `temp_${Date.now()}`,
        name: recognized.name,
        spec: recognized.spec || '规格待补充',
        symptoms: recognized.symptoms.length > 0 ? recognized.symptoms : ['其他'],
        expiryDate: recognized.expiryDate,
        price: 0,
        status: 'normal',
        visibility: 'public',
        shareMode: 'free',
        shareScope: 'building',
        quantity: recognized.quantity,
        unit: recognized.unit,
        isOtc: true,
      });
      setShowResult(true);
    } catch (err) {
      console.error('AI recognition error:', err);
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof Error ? err.message : 'AI 识别失败，请重试',
      });
      // 识别失败：回到取景状态，允许重新拍摄
      setShowResult(false);
      setScannedMedicine(null);
      setScanning(true);
      startCamera();
    } finally {
      setRecognizing(false);
    }
  };

  // 点击取景框：截取当前画面交给 AI 识别
  const handleScan = async () => {
    if (!scanning || recognizing) return;
    setScanning(false);

    let imageDataUrl: string;
    try {
      imageDataUrl = captureFrame();
    } catch (err) {
      dispatch({ type: 'SHOW_TOAST', message: err instanceof Error ? err.message : '取景失败' });
      setScanning(true);
      return;
    }

    stopCamera();
    await runRecognition(imageDataUrl);
  };

  const handleConfirm = async () => {
    if (!scannedMedicine) return;
    if (onConfirm) {
      await onConfirm(scannedMedicine);
      return;
    }
    await actions.addMedicine({
      name: scannedMedicine.name,
      spec: scannedMedicine.spec,
      symptoms: scannedMedicine.symptoms,
      expiryDate: scannedMedicine.expiryDate,
      price: scannedMedicine.price,
      visibility: scannedMedicine.visibility,
      shareMode: scannedMedicine.shareMode,
      shareScope: scannedMedicine.shareScope,
      quantity: scannedMedicine.quantity,
      unit: scannedMedicine.unit,
    });
    dispatch({ type: 'SHOW_TOAST', message: '药品录入成功！' });
    dispatch({ type: 'SET_TAB', tab: 'home' });
  };

  const handleCancel = () => {
    setShowResult(false);
    setScannedMedicine(null);
    setScanning(true);
    startCamera();
  };

  const handleManualInput = () => {
    dispatch({ type: 'NAVIGATE', screen: 'addMedicine' });
  };

  const handleAlbumSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 清空 input，保证连续选择同一张图片也能触发 change
    e.target.value = '';
    if (!file) return;

    stopCamera();
    setScanning(false);

    setRecognizing(true);
    try {
      const raw = await readFileAsDataUrl(file);
      await runRecognition(await downscaleImage(raw));
    } catch (err) {
      dispatch({ type: 'SHOW_TOAST', message: err instanceof Error ? err.message : '图片处理失败' });
      setScanning(true);
      startCamera();
      setRecognizing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-4 pb-2">
        <button 
          onClick={() => dispatch({ type: 'GO_BACK' })}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="text-white font-semibold">AI 识药</h1>
        <button 
          onClick={toggleFlash}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center"
        >
          <Flashlight className={`w-5 h-5 ${flashOn ? 'text-yellow-400' : 'text-white'}`} />
        </button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative flex items-center justify-center">
        {/* Real camera video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: scanning && !cameraError ? 'block' : 'none' }}
        />
        
        {/* Fallback background when camera unavailable */}
        {(!scanning || cameraError) && (
          <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-gray-900">
            <div className="absolute inset-0 opacity-20">
              <div className="w-full h-full" style={{
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
              }} />
            </div>
          </div>
        )}

        {/* Error message */}
        {cameraError && scanning && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="bg-black/70 rounded-2xl p-6 mx-8 text-center">
              <p className="text-white text-sm mb-3">{cameraError}</p>
              <button onClick={startCamera} className="px-6 py-2 bg-orange-500 text-white rounded-full text-sm">
                重试
              </button>
            </div>
          </div>
        )}

        {/* Scan Frame */}
        {scanning && (
          <div 
            role="button"
            aria-label="点击识别药品"
            className="relative w-64 h-64 cursor-pointer"
            onClick={handleScan}
          >
            {/* Corner markers */}
            <div className="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 border-orange-400 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 border-orange-400 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 border-orange-400 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 border-orange-400 rounded-br-lg" />
            
            {/* Scan line */}
            <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-orange-400 to-transparent" style={{ animation: 'scanMove 2s linear infinite' }} />
          </div>
        )}

        {/* Success indicator */}
        {!scanning && !recognizing && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="w-16 h-16 rounded-full bg-green-500/90 flex items-center justify-center animate-bounce">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        )}

        {/* AI 识别中 */}
        {recognizing && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/60">
            <Spinner className="size-8 text-orange-400" />
            <p className="text-white text-sm">AI 正在识别药盒信息…</p>
          </div>
        )}

        {/* Hint */}
        <p className="absolute bottom-32 text-white/70 text-sm z-10">
          {recognizing ? '识别中，请稍候…' : scanning ? '将药盒正面放入框内，点击识别' : '识别完成'}
        </p>

        {/* AI 录入声明 */}
        <div className="absolute bottom-6 left-0 right-0 z-10 px-6">
          <div className="flex items-start gap-2 rounded-xl bg-black/50 px-3 py-2 backdrop-blur">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-orange-300" />
            <p className="text-[11px] leading-4 text-white/80">药品信息由 AI 识别录入，请仔细辨别</p>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

      {/* Bottom Actions */}
      <div className="bg-black/80 backdrop-blur px-6 pb-8 pt-4 z-20">
        <div className="flex items-center justify-center gap-8">
          {showManualInput && (
            <button onClick={handleManualInput} className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <Keyboard className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs text-white/70">手动输入</span>
            </button>
          )}
          <button onClick={handleAlbumSelect} className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs text-white/70">相册选择</span>
          </button>
        </div>
      </div>

      {/* Result Sheet */}
      {showResult && scannedMedicine && (
        <div className="absolute inset-0 z-30 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={handleCancel} />
          <div className="relative w-full bg-white rounded-t-3xl p-6 animate-slideUp">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5" />
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-800 truncate">{scannedMedicine.name}</h3>
                </div>
                <p className="text-sm text-gray-500">{scannedMedicine.spec}</p>
              </div>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">适应症</label>
                <div className="flex gap-2 flex-wrap">
                  {scannedMedicine.symptoms.map(s => <span key={s} className="px-3 py-1 bg-orange-50 text-orange-600 rounded-lg text-sm">{s}</span>)}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">保质期</label>
                <p className="text-sm text-gray-800">{scannedMedicine.expiryDate || '未识别，建议手动补充'}</p>
              </div>
            </div>

            {/* AI 录入声明 */}
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 mb-6">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <p className="text-xs leading-5 text-amber-700">药品信息由 AI 识别录入，请仔细辨别</p>
            </div>

            <div className="flex gap-3">
              <button onClick={handleCancel} className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-600 font-medium active:scale-[0.98] transition-transform">取消</button>
              <button onClick={handleConfirm} className="flex-1 h-12 rounded-xl bg-gradient-to-r from-orange-400 to-amber-500 text-white font-medium shadow-lg shadow-orange-200 active:scale-[0.98] transition-transform">{confirmLabel}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scanMove {
          0% { top: 0; } 50% { top: 100%; } 100% { top: 0; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1); }
      `}</style>
    </div>
  );
}
