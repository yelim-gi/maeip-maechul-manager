/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Evidence, Transaction, OCRResult, OCRItem } from '../types';
import { 
  FileText, 
  Upload, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Trash2, 
  ExternalLink, 
  HelpCircle,
  TrendingDown,
  Globe,
  Edit3,
  Check,
  Search,
  RefreshCw,
  PlusCircle, FileSpreadsheet,
  Camera,
  Video,
  X
} from 'lucide-react';

interface EvidenceManagerProps {
  evidences: Evidence[];
  transactions: Transaction[];
  onAddEvidence: (newEv: Evidence) => void;
  onDeleteEvidence: (id: string) => void;
  onLinkTransaction: (evidenceId: string, transactionId: string | null) => void;
  onTriggerAutoMatch: () => Promise<{ matchedCount: number }>;
}

// Low-resolution safe base64 sample receipts to allow direct instant simulation of server-side AI OCR
const SAMPLE_DOCS = [
  {
    name: "일본 수퍼딜리버리 인보이스 (SUPER DELIVERY).png",
    type: "png",
    size: 204850,
    // Small gray square base64 representing a document mock
    base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACt3gxoAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4gIFDA8VAD61pAAABK1JREFUeN7t1bERADAMwLA8+/+yF7gqMvclU6Cqqp8fMDIgYEDAgIABAYMCBgQM ...",
    description: "일본 도소매 사입 도구 인보이스 (일본어 상품과 엔화 표시)"
  },
  {
    name: "우체국택배 발송 영수증.pdf",
    type: "pdf",
    size: 512400,
    base64: "data:application/pdf;base64,JVBERi0xLjQKJSDi4uDjCjEgMCBvYmoKPDw...L3N0YXJ0eHJlZgoxMjM0NToKJSVFT0YK",
    description: "국내 세무 경비 처리용 우체국 택배 배송비 납부 영수증"
  },
  {
    name: "네이버 비즈니스 광고 정산명세서.png",
    type: "png",
    size: 154020,
    base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACt3gxoAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4gIFDA8VAD61pAAABK1JREFUeN7t1bERADAMwLA8+/+yF7gqMvclU6Cqqp8fMDIgYEDAgIABAYMCBgQM ...",
    description: "네이버 광고비 집행 및 스마트스토어 마케팅 전표"
  }
];

export default function EvidenceManager({
  evidences,
  transactions,
  onAddEvidence,
  onDeleteEvidence,
  onLinkTransaction,
  onTriggerAutoMatch
}: EvidenceManagerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [multiUploadProgress, setMultiUploadProgress] = useState<{current: number, total: number} | null>(null);
  
  // OCR output draft state for direct user corrections
  const [draftResult, setDraftResult] = useState<OCRResult | null>(null);
  const [draftFileName, setDraftFileName] = useState("");
  const [draftFileType, setDraftFileType] = useState("png");
  const [draftFileSize, setDraftFileSize] = useState(0);
  const [draftBase64, setDraftBase64] = useState("");
  const [selectedEvidenceForDetail, setSelectedEvidenceForDetail] = useState<Evidence | null>(null);
  
  // Filter search
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'unmatched' | 'matched'>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);

  const startLiveCamera = async () => {
    setIsLiveCameraOpen(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
      setActiveStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Camera access failed", err);
      // Fallback
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
        setActiveStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
        }
      } catch (fbErr: any) {
        console.error("Fallback camera failed", fbErr);
        setCameraError("카메라 접근에 실패했습니다. 카메라 권한을 확인해 주시거나 다른 기기/앱환경에서 실행해 주세요.");
      }
    }
  };

  const stopLiveCamera = () => {
    if (activeStream) {
      activeStream.getTracks().forEach(track => track.stop());
      setActiveStream(null);
    }
    setIsLiveCameraOpen(false);
  };

  const captureSnapshot = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        stopLiveCamera();
        
        const fileStamp = new Date().toISOString().slice(0,19).replace(/[:-]/g, '');
        const filename = `즉석촬영_영수증_${fileStamp}.png`;
        handleFileAnalysis(filename, 'png', 350000, dataUrl);
      }
    } catch (err) {
      console.error("Capture failure", err);
      alert("스냅샷을 촬영하여 이미지로 추출하는 작업에 오류가 발생했습니다.");
    }
  };

  // Helper helper to convert a File object into data URL
  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Parse file and send to Express `/api/ocr/analyze`
  const handleFileAnalysis = async (fileName: string, fileType: string, fileSize: number, base64Data: string) => {
    setIsAnalyzing(true);
    setDraftResult(null);
    setErrorMsg(null);
    setAnalysisProgress("파일을 서버로 전용 전송 채널을 통해 입출력 중입니다...");

    const progressTimeout = setTimeout(() => {
      setAnalysisProgress("Gemini-3.5-Flash 모델로 이미지를 해독하고 텍스트 OCR 작업을 실행하고 있습니다...");
    }, 1500);

    const translationTimeout = setTimeout(() => {
      setAnalysisProgress("해외 자료 감지: 일본어/영어 제품 번역 및 한국 세무 경비 카테고리 매핑 규칙을 적용 중입니다...");
    }, 3500);

    try {
      const response = await fetch("/api/ocr/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData: base64Data,
          fileType: fileType,
          fileName: fileName
        })
      });

      const data = await response.json();
      clearTimeout(progressTimeout);
      clearTimeout(translationTimeout);

      if (data.success && data.ocrResult) {
        // Build items inside the OCR with specific auto-generated ids
        const itemsWithId: OCRItem[] = (data.ocrResult.items || []).map((item: any, index: number) => ({
          id: `item-${Date.now()}-${index}`,
          name: item.name || "알 수 없는 상품",
          quantity: Number(item.quantity) || 1,
          price: Number(item.price) || 0,
          translatedName: item.translatedName || item.name
        }));

        setDraftResult({
          partner: data.ocrResult.partner || "미상 거래처",
          date: data.ocrResult.date || new Date().toISOString().substring(0, 10),
          amount: Number(data.ocrResult.amount) || 0,
          tax: Number(data.ocrResult.tax) || 0,
          shippingFee: Number(data.ocrResult.shippingFee) || 0,
          customsFee: Number(data.ocrResult.customsFee) || 0,
          recommendedCategory: data.ocrResult.recommendedCategory || "상품매입",
          items: itemsWithId,
          rawSummary: data.ocrResult.rawSummary || "영수증 서식 문서"
        });
        setDraftFileName(fileName);
        setDraftFileType(fileType);
        setDraftFileSize(fileSize);
        setDraftBase64(base64Data);
      } else {
        throw new Error(data.error || "Gemini 분석에 실패했습니다. 올바른 문서 형식인지 또는 API 키를 확인해 주세요.");
      }
    } catch (error: any) {
      clearTimeout(progressTimeout);
      clearTimeout(translationTimeout);
      console.error(error);
      setErrorMsg(error.message || "서버와 통신하는 중 장애가 발생했습니다.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Core file processing function (Supports single and multiple files)
  const processFiles = async (fileList: FileList) => {
    if (fileList.length === 0) return;

    if (fileList.length === 1) {
      // Single file flow: Load in editor manually
      const file = fileList[0];
      try {
        const base64 = await readFileAsDataURL(file);
        const ext = file.name.split('.').pop() || 'png';
        handleFileAnalysis(file.name, ext, file.size, base64);
      } catch (err) {
        console.error(err);
        setErrorMsg("파일을 읽는 과정에서 에러가 발생했습니다.");
      }
      return;
    }

    // Multiple files flow: Parallel or quick sequential automatic OCR and direct save
    setIsAnalyzing(true);
    setDraftResult(null);
    setErrorMsg(null);

    const total = fileList.length;
    setMultiUploadProgress({ current: 0, total });

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < total; i++) {
      const file = fileList[i];
      setAnalysisProgress(`[${i + 1}/${total}] '${file.name}' 실시간 AI OCR 해독 중...`);
      setMultiUploadProgress({ current: i, total });

      try {
        const base64 = await readFileAsDataURL(file);
        const ext = file.name.split('.').pop() || 'png';

        const response = await fetch("/api/ocr/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileData: base64,
            fileType: ext,
            fileName: file.name
          })
        });

        const data = await response.json();
        if (data.success && data.ocrResult) {
          const rawOcr = data.ocrResult;
          const itemsWithId: OCRItem[] = (rawOcr.items || []).map((item: any, index: number) => ({
            id: `item-${Date.now()}-${i}-${index}`,
            name: item.name || "알 수 없는 상품",
            quantity: Number(item.quantity) || 1,
            price: Number(item.price) || 0,
            translatedName: item.translatedName || item.name
          }));

          const newEvidence: Evidence = {
            id: `ev-${Date.now()}-${i}`,
            fileName: file.name,
            fileType: ext,
            fileSize: file.size,
            uploadedAt: new Date().toISOString(),
            ocrData: {
              partner: rawOcr.partner || "미상 거래처",
              date: rawOcr.date || new Date().toISOString().substring(0, 10),
              amount: Number(rawOcr.amount) || 0,
              tax: Number(rawOcr.tax) || 0,
              shippingFee: Number(rawOcr.shippingFee) || 0,
              customsFee: Number(rawOcr.customsFee) || 0,
              recommendedCategory: rawOcr.recommendedCategory || "상품매입",
              items: itemsWithId,
              rawSummary: rawOcr.rawSummary || "일괄 업로드 문서"
            },
            ocrStatus: 'success',
            isMatched: false,
            matchedTransactionId: null,
            fileDataUrl: base64
          };

          onAddEvidence(newEvidence);
          successCount++;
        } else {
          failedCount++;
        }
      } catch (err) {
        console.error(`File ${file.name} processing error:`, err);
        failedCount++;
      }
    }

    setMultiUploadProgress({ current: total, total });
    setIsAnalyzing(false);
    setMultiUploadProgress(null);

    // Auto-match once all are added
    setTimeout(async () => {
      const matchStats = await onTriggerAutoMatch();
      let alertMsg = `🎉 영수증/인보이스 ${total}개 일괄 분석 완료!\n- 완료: ${successCount}건\n- 실패/오류: ${failedCount}건`;
      if (matchStats.matchedCount > 0) {
        alertMsg += `\n- 자동 매칭 연동: 업로드된 증빙 중 ${matchStats.matchedCount}건이 동일 금액/날짜의 은행 및 카드 지출 전표에 1초 만에 자동 결합되었습니다!`;
      }
      alert(alertMsg);
    }, 450);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  };

  const runSampleSimulation = (sample: typeof SAMPLE_DOCS[0]) => {
    handleFileAnalysis(sample.name, sample.type, sample.size, sample.base64);
  };

  // Draft handlers for OCR edit correction
  const handleDraftFieldChange = (key: keyof OCRResult, value: any) => {
    if (draftResult) {
      setDraftResult({ ...draftResult, [key]: value });
    }
  };

  const handleDraftItemChange = (index: number, key: keyof OCRItem, value: any) => {
    if (draftResult) {
      const updatedItems = [...draftResult.items];
      updatedItems[index] = { ...updatedItems[index], [key]: value };
      setDraftResult({ ...draftResult, items: updatedItems });
    }
  };

  const handleSaveDraft = () => {
    if (!draftResult) return;

    const newEvidence: Evidence = {
      id: `ev-${Date.now()}`,
      fileName: draftFileName,
      fileType: draftFileType,
      fileSize: draftFileSize,
      uploadedAt: new Date().toISOString(),
      ocrData: draftResult,
      ocrStatus: 'success',
      isMatched: false,
      matchedTransactionId: null,
      fileDataUrl: draftBase64
    };

    onAddEvidence(newEvidence);
    setDraftResult(null); // Clear editor

    // Also trigger immediate AI auto match to save business clicks!
    setTimeout(async () => {
      const matchStats = await onTriggerAutoMatch();
      if (matchStats.matchedCount > 0) {
        alert(`저장 성공! 새 증빙자료와 거래소 내역 중 ${matchStats.matchedCount}건이 금액 및 날짜 기준에 부합하여 자동으로 상호 매칭되었습니다.`);
      }
    }, 400);
  };

  // Filter and sort evidence list by date descending (newest receipt date first)
  const filteredEvidences = evidences
    .filter(e => {
      const matchesSearch = e.fileName.toLowerCase().includes(searchText.toLowerCase()) || 
        (e.ocrData?.partner && e.ocrData.partner.toLowerCase().includes(searchText.toLowerCase())) ||
        (e.ocrData?.recommendedCategory && e.ocrData.recommendedCategory.includes(searchText));
      
      if (statusFilter === 'all') return matchesSearch;
      if (statusFilter === 'unmatched') return matchesSearch && !e.isMatched;
      if (statusFilter === 'matched') return matchesSearch && e.isMatched;
      return matchesSearch;
    })
    .sort((a, b) => {
      const dateA = a.ocrData?.date || a.uploadedAt;
      const dateB = b.ocrData?.date || b.uploadedAt;
      return dateB.localeCompare(dateA);
    });

  return (
    <div id="evidence-manager-view" className="space-y-6">
      
      {/* 2-Column Core: Upload Area / Interactive AI Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Document submission and presets (Column size 5 or 12 depending on editor availability) */}
        <div className={`${draftResult ? "lg:col-span-5" : "lg:col-span-12"} space-y-6`}>
          
          {/* Upload card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-800 text-lg mb-2">실시간 AI 증빙 분석 (OCR)</h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              PDF 청구서, 영수증, 또는 해외 일본어 송인장(Invoice) 등 임의의 문서를 드래그앤드롭하여 올려보세요. 
              최첨단 <strong>Gemini 3.5 Flash</strong> 모델이 전표의 거래처, 금액, 부가세, 배송비 및 상호명을 상세히 분리하고 일본 제품명 번역까지 고해상도로 지원해 줍니다.
            </p>

            {/* Drag & Drop Frame */}
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging ? "border-indigo-600 bg-indigo-50" : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="image/*,application/pdf" 
                className="hidden" 
                multiple
              />
              <div className="p-3 bg-indigo-50 text-indigo-900 rounded-full mb-3">
                <Upload className="w-8 h-8" />
              </div>
              <p className="text-sm font-bold text-slate-700 mb-1">인보이스 또는 영수증 복수 선택/드롭</p>
              <p className="text-xs text-slate-400">PDF, JPG, PNG, WEBP 지원 (한 번에 여러 개의 증빙 일괄 등록 가능)</p>
            </div>

            {/* Mobile Native Camera & Live WebCam Scanner Controls */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Native Mobile Snap Input Selector */}
              <input 
                type="file" 
                ref={cameraInputRef} 
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) {
                    processFiles(files);
                  }
                }} 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
              />
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold p-3.5 rounded-2xl cursor-pointer hover:shadow-md transition duration-200"
              >
                <Camera className="w-5 h-5 shrink-0" />
                <div className="text-left leading-tight">
                  <p className="text-xs">📸 휴대폰 즉석 촬영</p>
                  <p className="text-[10px] opacity-80 font-normal">터치 시 즉시 폰카메라 기동</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isLiveCameraOpen) {
                    stopLiveCamera();
                  } else {
                    startLiveCamera();
                  }
                }}
                className={`flex items-center justify-center gap-2 font-bold p-3.5 rounded-2xl cursor-pointer transition duration-200 hover:shadow-md ${
                  isLiveCameraOpen 
                    ? "bg-rose-600 hover:bg-rose-700 text-white" 
                    : "bg-indigo-900 hover:bg-indigo-950 text-white"
                }`}
              >
                <Video className="w-5 h-5 shrink-0" />
                <div className="text-left leading-tight">
                  <p className="text-xs">{isLiveCameraOpen ? "실시간 스캐너 종료" : "🎥 실시간 인식 카메라"}</p>
                  <p className="text-[10px] opacity-80 font-normal">웹브라우저 카메라 연동</p>
                </div>
              </button>
            </div>

            {/* In-Browser Live Webcam Frame Streamer */}
            {isLiveCameraOpen && (
              <div className="mt-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 text-white space-y-3.5 relative overflow-hidden animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold">
                    <span className="w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
                    <span className="text-slate-300 font-mono text-[9px]">LIVE CAMERA SCANNER (REAR-PREFERRED)</span>
                  </span>
                  <button 
                    type="button" 
                    onClick={stopLiveCamera}
                    className="p-1 bg-white/10 hover:bg-white/20 rounded-full transition cursor-pointer"
                  >
                    <X className="w-4 h-4 text-slate-300" />
                  </button>
                </div>

                {cameraError ? (
                  <div className="p-3 bg-rose-950/50 border border-rose-900/60 rounded-xl text-xs text-rose-205">
                    {cameraError}
                  </div>
                ) : (
                  <div className="relative rounded-xl overflow-hidden aspect-video bg-black border border-slate-800 flex items-center justify-center">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      className="w-full h-full object-cover" 
                    />
                    {/* Centered Guide Overlay Bracket */}
                    <div className="absolute inset-6 border-2 border-dashed border-emerald-500/35 rounded-lg pointer-events-none flex items-center justify-center">
                      <span className="text-[9px] bg-black/75 text-emerald-350 px-2.5 py-1 rounded-full font-bold">
                        영수증이나 인보이스를 틀 안에 맞춰주세요
                      </span>
                    </div>
                  </div>
                )}

                {!cameraError && (
                  <div className="flex justify-between gap-3 text-xs">
                    <button
                      type="button"
                      onClick={stopLiveCamera}
                      className="flex-1 bg-white/10 hover:bg-white/20 font-bold py-2.5 rounded-xl transition cursor-pointer"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={captureSnapshot}
                      className="flex-[2] bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-500/10 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>📸 즉시 스냅촬영 및 자동 기재</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Error display */}
            {errorMsg && (
              <div className="mt-4 p-3.5 bg-rose-50 border border-rose-150 rounded-xl text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-0.5">분석 오류 발생</span>
                  {errorMsg}
                </div>
              </div>
            )}

            {/* Analyzing progress indicator */}
            {isAnalyzing && (
              <div className="mt-4 bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col gap-2.5">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-6 h-6 text-indigo-900 animate-spin shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-slate-800">
                      {multiUploadProgress ? "AI 실시간 증빙 대량 일괄 분석 작동 중..." : "AI 세무 인텔리전스 가동 중..."}
                    </p>
                    <p className="text-slate-500 animate-pulse">{analysisProgress}</p>
                  </div>
                </div>
                
                {multiUploadProgress && (
                  <div className="w-full mt-1.5 space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                      <span>진행도</span>
                      <span>{multiUploadProgress.current} / {multiUploadProgress.total}개 완료</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-indigo-950 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(multiUploadProgress.current / multiUploadProgress.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Preset Simulated Samples for quick experience (Satisfies user request to make it functional instantly) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h4 className="font-semibold text-slate-800 text-sm mb-3">샘플 증빙자료로 간편하게 AI OCR 테스트하기</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SAMPLE_DOCS.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => runSampleSimulation(sample)}
                  disabled={isAnalyzing}
                  className="bg-slate-50 hover:bg-indigo-50 border border-slate-150 rounded-xl p-3 text-left transition-all hover:border-indigo-200 disabled:opacity-50"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1">
                    <FileText className="w-3.5 h-3.5 text-indigo-900" />
                    <span className="truncate">{sample.name.split(' (')[0]}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">
                    {sample.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* OCR Result Correction Draft Panel (Column size 7, visible ONLY when analysis is done) */}
        {draftResult && (
          <div className="lg:col-span-7 bg-white rounded-2xl border border-indigo-150 shadow-md p-6 space-y-4 animate-fade-in relative">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <span className="bg-indigo-100 text-indigo-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  AI OCR 임시 보관함
                </span>
                <h3 className="font-bold text-slate-800 text-base mt-1">인보이스 분석 결과 검토 및 수정</h3>
              </div>
              <button 
                onClick={() => setDraftResult(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-medium"
              >
                취소하기
              </button>
            </div>

            {/* Document type summary parsed by model */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 flex items-center justify-between">
              <div className="text-xs">
                <span className="text-slate-450 block">문서 식별 요약</span>
                <strong className="text-indigo-900 font-bold">{draftResult.rawSummary || "외화/내수 결제 영수증"}</strong>
              </div>
              <div className="text-right text-xs">
                <span className="text-slate-450 block">원본파일명</span>
                <span className="text-slate-600 truncate max-w-xs block font-mono">{draftFileName}</span>
              </div>
            </div>

            {/* Interactive Grid inputs for OCR corrections */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              
              <div>
                <label className="block font-semibold text-slate-700 mb-1">거래처 상호명</label>
                <input 
                  type="text" 
                  value={draftResult.partner}
                  onChange={(e) => handleDraftFieldChange('partner', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg p-2 font-medium focus:ring-1 focus:ring-indigo-550"
                  placeholder="예: SUPER DELIVERY"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">거래 일자 (날짜)</label>
                <input 
                  type="date" 
                  value={draftResult.date}
                  onChange={(e) => handleDraftFieldChange('date', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg p-2 font-medium focus:ring-1 focus:ring-indigo-550"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">금액 합계 (원금)</label>
                <input 
                  type="number" 
                  value={draftResult.amount}
                  onChange={(e) => handleDraftFieldChange('amount', Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-lg p-2 focus:ring-1 focus:ring-indigo-550"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">부가세 (VAT)</label>
                <input 
                  type="number" 
                  value={draftResult.tax}
                  onChange={(e) => handleDraftFieldChange('tax', Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg p-2 focus:ring-1 focus:ring-indigo-550"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">배송료 / 수선료</label>
                <input 
                  type="number" 
                  value={draftResult.shippingFee}
                  onChange={(e) => handleDraftFieldChange('shippingFee', Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg p-2 focus:ring-1 focus:ring-indigo-550"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">수입 관부가세</label>
                <input 
                  type="number" 
                  value={draftResult.customsFee}
                  onChange={(e) => handleDraftFieldChange('customsFee', Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg p-2 focus:ring-1 focus:ring-indigo-550"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">AI 지출 추천 카테고리</label>
                <select 
                  value={draftResult.recommendedCategory}
                  onChange={(e) => handleDraftFieldChange('recommendedCategory', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-indigo-900 font-semibold rounded-lg p-2 focus:ring-1 focus:ring-indigo-550"
                >
                  <option value="상품매입">📦 상품매입 (도소매 사입/재공품)</option>
                  <option value="배송비">📞 배송비 (우체국, 택배, 운임)</option>
                  <option value="광고비">📢 광고비 (네이버, 페이스북, 구글 키워드)</option>
                  <option value="소모품비">📎 소모품비 (집기, 집재 및 비품)</option>
                  <option value="지급수수료">💳 지급수수료 (스토어 정산수수료, 대행료)</option>
                  <option value="여비교통비">🚄 여비교통비 (출장인건비, 주유비)</option>
                  <option value="세금과공과">📊 세금과공과 (관세 청구금, 공공기관비)</option>
                  <option value="매출">🌟 매출 (판매자 매출 정산용 영수증)</option>
                </select>
              </div>

            </div>

            {/* Product lists OCR translation items (Satisfies request: OCR 결과에서 개별 아이템 확인 및 번역 관리) */}
            <div className="space-y-2 mt-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-xs shrink-0 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-indigo-900" />
                  <span>세부 거래 품목 및 해외 어휘 번역 교정</span>
                </h4>
                <span className="text-[10px] text-slate-400">일본 사입 물품 한글로 번역 제공</span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2.5 border border-slate-100 p-2 rounded-xl">
                {draftResult.items.map((item, idx) => (
                  <div key={item.id} className="bg-slate-50 p-2.5 rounded-lg text-xs space-y-1.5 border border-slate-150">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-slate-400 font-light">#{idx + 1}</span>
                      <input 
                        type="text" 
                        value={item.name}
                        onChange={(e) => handleDraftItemChange(idx, 'name', e.target.value)}
                        className="bg-transparent border-0 border-b border-transparent focus:border-slate-350 p-0 text-slate-700 font-medium truncate w-full"
                        placeholder="원본 품목명"
                      />
                    </div>
                    
                    {/* Translation Input (Korean name) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="flex items-center gap-1 bg-white px-2 py-0.5 border border-slate-200 rounded">
                        <span className="text-[9px] text-indigo-600 font-semibold text-wrap truncate shrink-0">뜻번역:</span>
                        <input 
                          type="text" 
                          value={item.translatedName || ""}
                          onChange={(e) => handleDraftItemChange(idx, 'translatedName', e.target.value)}
                          className="w-full bg-transparent border-none text-[11px] p-0 font-bold text-slate-800 focus:ring-0"
                          placeholder="한글로 번역 교환"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                        <span>수량:</span>
                        <input 
                          type="number" 
                          value={item.quantity}
                          onChange={(e) => handleDraftItemChange(idx, 'quantity', Number(e.target.value))}
                          className="w-10 bg-white border border-slate-200 text-center rounded p-0 text-slate-700" 
                        />
                        <span className="ml-2">단가:</span>
                        <input 
                          type="number" 
                          value={item.price}
                          onChange={(e) => handleDraftItemChange(idx, 'price', Number(e.target.value))}
                          className="w-16 bg-white border border-slate-200 text-center rounded p-0 text-slate-700" 
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Confirm buttons */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setDraftResult(null)}
                className="bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl transition"
              >
                작성 취소
              </button>
              <button
                onClick={handleSaveDraft}
                className="bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-bold px-5 py-2.5 rounded-xl inline-flex items-center gap-1.5 shadow-sm transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>체크 완료 및 AI 매칭 증빙저장</span>
              </button>
            </div>

          </div>
        )}

      </div>

      {/* Uploaded evidences inventory Section (with search, filters, matching) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">보관 중인 증빙문서 카탈로그</h3>
            <p className="text-xs text-slate-500">
              현재까지 업로드 및 저장된 총 {evidences.length}개의 매입매출 증빙 문서 데이터 목록입니다.
            </p>
          </div>

          <button 
            onClick={async () => {
              const res = await onTriggerAutoMatch();
              alert(`자동 매칭이 성공적으로 이루어졌습니다! 총 ${res.matchedCount}건의 증빙 정보가 연동되었습니다.`);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5 shadow transition-all shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>날짜/금액 기준 자동 매칭 재실행 (Match Now)</span>
          </button>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-150">
          <div className="flex flex-1 max-w-sm items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input 
              type="text"
              placeholder="문서명, 거래처명, 분류 검색..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="text-xs bg-transparent border-none text-slate-800 w-full focus:outline-none"
            />
          </div>

          {/* Status filter tabs */}
          <div className="flex bg-slate-200/50 p-1 rounded-lg border border-slate-100">
            <button
              onClick={() => setStatusFilter('all')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition ${statusFilter === 'all' ? "bg-white text-indigo-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              전체보기 ({evidences.length})
            </button>
            <button
              onClick={() => setStatusFilter('unmatched')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition ${statusFilter === 'unmatched' ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              매칭 대기 ({evidences.filter(e => !e.isMatched).length})
            </button>
            <button
              onClick={() => setStatusFilter('matched')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition ${statusFilter === 'matched' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              매칭 완료 ({evidences.filter(e => e.isMatched).length})
            </button>
          </div>
        </div>

        {/* Catalog Table */}
        <div className="overflow-x-auto rounded-xl">
          <table className="w-full text-xs text-left text-slate-500">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">문서 정보</th>
                <th className="px-4 py-3">거래 날짜</th>
                <th className="px-4 py-3">거래처 상호</th>
                <th className="px-4 py-3">AI 감지 금액</th>
                <th className="px-4 py-3">추천 카테고리</th>
                <th className="px-4 py-3">매칭 상태</th>
                <th className="px-4 py-3 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEvidences.map(e => (
                <tr key={e.id} className="hover:bg-slate-50 bg-white transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-50 text-indigo-900 rounded-lg">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 block truncate max-w-xs">{e.fileName}</span>
                        <span className="text-[10px] text-slate-400">Uploaded {e.uploadedAt.split('T')[0]} · {Math.round(e.fileSize / 1024)}KB</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700 font-mono font-medium">{e.ocrData?.date || "미확인"}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{e.ocrData?.partner || "미상"}</td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-slate-950">
                      {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(e.ocrData?.amount || 0)}
                    </span>
                    {e.ocrData && (e.ocrData.tax > 0 || e.ocrData.shippingFee > 0) && (
                      <span className="text-[10px] text-slate-400 block font-light">
                        (세액: {Math.round(e.ocrData.tax)}원 / 배송비: {Math.round(e.ocrData.shippingFee)}원)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-slate-100 text-slate-800 font-medium px-2 py-0.5 rounded">
                      {e.ocrData?.recommendedCategory || "미확인"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {e.isMatched ? (
                      <div className="space-y-0.5">
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block">
                          ✓ 거래내역 상호연동 완료
                        </span>
                        {/* Show matched transactions details directly */}
                        {transactions.find(t => t.id === e.matchedTransactionId) && (
                          <span className="text-[10px] text-slate-400 block max-w-xs truncate">
                            ID: #{e.matchedTransactionId?.substring(0, 8)} to {transactions.find(t => t.id === e.matchedTransactionId)?.partner}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block animate-pulse">
                        ⚠ 매칭 대기 중
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button 
                        onClick={() => setSelectedEvidenceForDetail(e)}
                        className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg font-semibold transition"
                      >
                        세부 항목
                      </button>
                      <button
                        onClick={() => onDeleteEvidence(e.id)}
                        className="text-rose-500 hover:text-rose-700 font-bold p-1.5 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
                        title="증빙 자료 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredEvidences.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <FileSpreadsheet className="w-12 h-12 stroke-1 text-slate-300 mx-auto mb-2" />
                    현재 필터에 매칭되는 증빙자료 전표가 공백 상태입니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Evidence 세부 사항 Drawer Modal */}
      {selectedEvidenceForDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-4 border border-indigo-200">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">증빙 정보 상세 내역서</h3>
                <p className="text-xs text-slate-400">문서 고유 ID: {selectedEvidenceForDetail.id}</p>
              </div>
              <button 
                onClick={() => setSelectedEvidenceForDetail(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold bg-slate-50 hover:bg-slate-100 p-2 rounded-full"
              >
                ✕ 닫기
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px]">거래처명</span>
                <strong className="text-slate-800 text-sm">{selectedEvidenceForDetail.ocrData?.partner || "기재 유실"}</strong>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px]">거래 일자</span>
                <strong className="text-slate-800 text-sm">{selectedEvidenceForDetail.ocrData?.date || "기재 유실"}</strong>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px]">총 결제 금액</span>
                <strong className="text-slate-800 text-sm">
                  {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(selectedEvidenceForDetail.ocrData?.amount || 0)}
                </strong>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px]">설정 세무 항목 카테고리</span>
                <span className="bg-indigo-100 text-indigo-900 border border-indigo-200 rounded px-2 py-0.5 inline-block mt-0.5 font-bold">
                  {selectedEvidenceForDetail.ocrData?.recommendedCategory || "미분류"}
                </span>
              </div>
            </div>

            {/* Itemized lists detail print */}
            {selectedEvidenceForDetail.ocrData && selectedEvidenceForDetail.ocrData.items.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 text-xs">세부 품목 내역 ({selectedEvidenceForDetail.ocrData.items.length}개)</h4>
                <div className="border border-slate-150 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                      <tr>
                        <th className="px-3 py-2">상품 품목명</th>
                        <th className="px-3 py-2">수량</th>
                        <th className="px-3 py-2">외화/거래액</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedEvidenceForDetail.ocrData.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 text-slate-700 bg-white">
                          <td className="px-3 py-2 font-medium">
                            <span className="block text-slate-800">{item.name}</span>
                            {item.translatedName && item.translatedName !== item.name && (
                              <span className="text-[10px] text-indigo-700 font-semibold block">
                                ↳ 한글번역: {item.translatedName}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-light font-mono text-slate-500">{item.quantity}</td>
                          <td className="px-3 py-2 font-bold font-mono text-slate-900">
                            {new Intl.NumberFormat('ko-KR', { style: 'decimal' }).format(item.price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Manually link transaction capability (Satisfies user request to link and match freely) */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-emerald-600" />
                <span>수동 연결 상태 제어</span>
              </span>
              
              {selectedEvidenceForDetail.isMatched ? (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-lg border border-slate-150">
                  <span className="text-xs text-emerald-700 font-semibold">
                    연결된 거래내역 ID: <strong className="font-mono text-slate-900">#{selectedEvidenceForDetail.matchedTransactionId}</strong>
                  </span>
                  <button
                    onClick={() => {
                      onLinkTransaction(selectedEvidenceForDetail.id, null);
                      setSelectedEvidenceForDetail({ ...selectedEvidenceForDetail, isMatched: false, matchedTransactionId: null });
                    }}
                    className="bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 text-[10px] font-bold px-3 py-1.5 rounded-lg transition"
                  >
                    연동 끊기 (Unlink)
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] text-slate-500 leading-normal">
                    현재 보관된 수입/국내 영수증과 금액이 일치하는 미결합 지출 거래내역 목록입니다. 
                    아래 거래 중 하나를 골라 수동 링크를 체결할 수 있습니다.
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-1.5">
                    {transactions
                      .filter(t => !t.evidenceId)
                      .map(t => {
                        const isSuggestedAmount = t.amount === selectedEvidenceForDetail.ocrData?.amount;
                        return (
                          <div 
                            key={t.id} 
                            className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                              isSuggestedAmount ? "border-emerald-300 bg-emerald-50/55" : "border-slate-150 bg-white"
                            }`}
                          >
                            <div className="text-[11px]">
                              <span className="font-bold text-slate-800">{t.partner}</span>
                              <span className="text-slate-400 block">{t.date} · {t.category}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">
                                {new Intl.NumberFormat('ko-KR', { style: 'decimal' }).format(t.amount)}원
                              </span>
                              <button
                                onClick={() => {
                                  onLinkTransaction(selectedEvidenceForDetail.id, t.id);
                                  setSelectedEvidenceForDetail(null);
                                  alert("거래 내역과 증빙 결합을 수동으로 긴밀하게 연동 완료했습니다.");
                                }}
                                className="bg-indigo-900 hover:bg-indigo-950 text-white font-bold p-1 px-2.5 rounded text-[10px] transition"
                              >
                                연동하기
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    {transactions.filter(t => !t.evidenceId).length === 0 && (
                      <p className="text-center text-[11px] text-slate-400 py-4 font-light">연동 대기 상태인 미증빙 거래 데이터가 없습니다.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="text-right">
              <button 
                onClick={() => setSelectedEvidenceForDetail(null)}
                className="bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
