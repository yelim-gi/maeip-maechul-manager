/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

// Set high limits for handling base64 PDFs and images from OCR uploads
app.use(express.json({ limit: "25mb" }));

// Lazy initializer for Google GenAI SDK to prevent startup crashes if key is omitted
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || !apiKey.startsWith("AIzaSy")) {
      throw new Error("올바른 Gemini API Key가 설정되지 않았습니다. 우측 상단 [⚙️ Settings] -> [Secrets] 메뉴를 누르고, 여러분의 구글 AI Studio 발급 API 키(AIzaSy로 시작하는 키)를 붙여넣어 안전하게 저장해 주세요!");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
  }
  return aiClient;
}

// API Health Check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    hasApiKey: !!process.env.GEMINI_API_KEY 
  });
});

const CONFIG_FILE = path.join(process.cwd(), "supabase_credentials.json");

// API: Config endpoint to expose public Supabase connection info
app.get("/api/config", (req, res) => {
  let url = process.env.SUPABASE_URL || "";
  let anonKey = process.env.SUPABASE_ANON_KEY || "";

  // If environment variables are empty, check if we have a saved file on the server
  if (!url || !anonKey) {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const fileContent = fs.readFileSync(CONFIG_FILE, "utf-8");
        const parsed = JSON.parse(fileContent);
        if (parsed.supabaseUrl && parsed.supabaseAnonKey) {
          url = parsed.supabaseUrl;
          anonKey = parsed.supabaseAnonKey;
        }
      }
    } catch (err) {
      console.warn("Could not read credentials from file:", err);
    }
  }

  res.json({
    supabaseUrl: url,
    supabaseAnonKey: anonKey
  });
});

// API: Save config endpoint (persists configuration so newly joined devices/phones get connected instantly)
app.post("/api/config", (req, res) => {
  try {
    const { supabaseUrl, supabaseAnonKey } = req.body;
    
    // Save to file
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ supabaseUrl, supabaseAnonKey }, null, 2), "utf-8");
    
    // Also inject them into process.env
    if (supabaseUrl && supabaseAnonKey) {
      process.env.SUPABASE_URL = supabaseUrl;
      process.env.SUPABASE_ANON_KEY = supabaseAnonKey;
    } else {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;
    }

    res.json({ success: true, message: "Credentials stored successfully on server." });
  } catch (err: any) {
    console.error("Failed to save credentials on server:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Document Analysis using Gemini-3.5-flash Model and OCR
app.post("/api/ocr/analyze", async (req, res) => {
  try {
    const { fileData, fileType, fileName } = req.body;

    if (!fileData) {
      res.status(400).json({ error: "파일 데이터가 존재하지 않습니다." });
      return;
    }

    // Determine mimeType
    let mimeType = "image/png";
    if (fileType) {
      if (fileType.toLowerCase() === "pdf") {
        mimeType = "application/pdf";
      } else if (fileType.toLowerCase() === "jpg" || fileType.toLowerCase() === "jpeg") {
        mimeType = "image/jpeg";
      } else if (fileType.toLowerCase() === "webp") {
        mimeType = "image/webp";
      }
    }

    // Initialize AI Client
    const ai = getAIClient();

    // Prepare contents containing the file and the prompt
    const cleanBase64 = fileData.replace(/^data:.*,/, "");
    const docPart = {
      inlineData: {
        mimeType: mimeType,
        data: cleanBase64,
      },
    };

    const textPart = {
      text: `이 문서는 한국 사업자가 세무 증빙을 위해 등록한 구매 영수증, 거래명세서, 세금계산서, 또는 해외 수입 일본어 인보이스(Invoice)입니다.
문서의 전체 텍스트와 레이아웃을 정확하게 OCR 분석한 후, 다음 정보들을 추출하여 지정된 JSON 구조로 응답해 주세요.

추출 규칙:
1. partner: 거래처명/상호 (일본어의 경우 가급적 읽기 편한 상호명 한글 발음 표기나 영어명 표기 병행, 예: 'Super Delivery (수퍼딜리버리)', 세무 처리용 거래명)
2. date: 거래 발생 날짜 (YYYY-MM-DD 형식). 날짜가 불명확할 경우 가장 가까운 예상 날짜나 부가 정보 사용.
3. amount: 총 결제액 또는 부가세를 포함한 합계액 (숫자만 표시, 예: 일본어 영수증 15200엔이면 해외 원화 환산이 아닌 영수증 표기 금액 15200 그대로 또는 원화 문서면 원화 금액)
4. tax: 부가세(VAT) 금액. 영수증에 부가세가 분리 표시되지 않았다면 합계 금액에서 10%를 기준으로 계산해 추천 입력하거나 0 기입.
5. shippingFee: 배송비/배송 수수료 (표시되어 있을 경우 수치 기입, 없을 경우 0)
6. customsFee: 관세/부가세 또는 수입비용 (인보이스 등으로 수입신고서가 기재된 경우 세관 납부 비용, 없을 경우 0)
7. items: 구매 품목 리스트. 각 품목별 name, quantity, price(단가 또는 해당 행 합계)를 기입하세요.
   - 만약 품목명(name)이 일본어인 경우, 한국어 발음과 한국어 번역 뜻을 포함해서 translatedName으로 한글 번역해 적어주세요. (예: original name 'レディースジャケット', translatedName: '여성용 재킷')
8. recommendedCategory: 아래 세무 비용 분류 중 가장 적합한 하나를 골라 추천해 주세요:
   - '상품매입': 판매 목적으로 매입한 상품 (예: 도소매, 도매 사입, Super Delivery)
   - '배송비': 우체국 택배, 해외 운송비, DHL, Fedex 등
   - '광고비': 페이스북 광고, 구글 마케팅, 네이버 스마트스토어 입점 광고
   - '소모품비': 사무용품, 가구, 전자기기 구매 등 비용
   - '지급수수료': 플랫폼 수수료, 매입 결제 대행 대금
   - '여비교통비': KTX, 항공, 대중교통 등 비용
   - '통신비': 인터넷비, 전화요금 등
   - '세금과공과': 관세 납부, 공공 세금
   - '복리후생비': 직원 식대, 복지 비용
   - '도서인쇄비': 책, 인쇄물 제작
   - '임차료': 월세, 공간 대여
   - '매출': 다른 고객에게 발행한 세금계산서나 정산 대금
9. rawSummary: 이 문서가 어떤 종류인지 한 줄 요약 (예: '일본 수퍼딜리버리 인보이스', '국내 간이영수증', '세금계산서')`,
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [docPart, textPart],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            partner: { type: Type.STRING, description: "Name of the partner/store/merchant" },
            date: { type: Type.STRING, description: "Date in YYYY-MM-DD" },
            amount: { type: Type.NUMBER, description: "Total payment amount (number)" },
            tax: { type: Type.NUMBER, description: "VAT tax amount (number)" },
            shippingFee: { type: Type.NUMBER, description: "Shipping or delivery fee (number)" },
            customsFee: { type: Type.NUMBER, description: "Customs or import duty/tax (number)" },
            items: {
              type: Type.ARRAY,
              description: "Purchased items lists",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Original item name in original language" },
                  quantity: { type: Type.NUMBER, description: "Item quantity" },
                  price: { type: Type.NUMBER, description: "Item unit price or total item price" },
                  translatedName: { type: Type.STRING, description: "Korean translated name of the product" }
                },
                required: ["name", "quantity", "price"]
              }
            },
            recommendedCategory: { type: Type.STRING, description: "Best recommended tax expense category" },
            rawSummary: { type: Type.STRING, description: "One-line document summary" }
          },
          required: ["partner", "date", "amount", "tax", "shippingFee", "customsFee", "items", "recommendedCategory"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Gemini 응답을 분석할 수 없습니다.");
    }

    const parsedData = JSON.parse(resultText.trim());
    res.json({ success: true, ocrResult: parsedData });

  } catch (error: any) {
    console.error("AI 분석 에러:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "문서 분석 중 알 수 없는 에러가 발생했습니다." 
    });
  }
});

// API: Real-time Tax & Ledger AI Chat advisor
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, ledgerData } = req.body;

    if (!message) {
      res.status(400).json({ error: "메시지가 존재하지 않습니다." });
      return;
    }

    const ai = getAIClient();

    // Compile contextual information of the ledger
    const transactionsCount = ledgerData?.transactions?.length || 0;
    const evidencesCount = ledgerData?.evidencesCount || 0;
    const rulesCount = ledgerData?.rulesCount || 0;

    // Summarize transactions to give context to Gemini
    let transactionsSummary = "등록된 거래 내역이 없습니다.";
    if (ledgerData?.transactions?.length > 0) {
      transactionsSummary = ledgerData.transactions.slice(0, 40).map((t: any) => {
        return `- [${t.date}] 거래처: ${t.partner}, 금액: ${t.amount}원, 세액: ${t.tax}원, 분류: ${t.category}, 수입배송비/관세: 배송비(${t.shippingFee || 0}원)/관세(${t.customsFee || 0}원), 증빙여부: ${t.evidenceId ? '연동됨' : '누락됨'}`;
      }).join("\n");
      if (ledgerData.transactions.length > 40) {
        transactionsSummary += `\n...외 ${ledgerData.transactions.length - 40}건의 거래가 장부에 더 존재합니다.`;
      }
    }

    const systemInstruction = `당신은 대한민국 온라인 쇼핑몰 및 수입/국내 사입 소상공인 사업자들을 위한 초간편 세무/장부 분석 AI 비서입니다.
사업자 세금 지식(부가가치세 신고, 환급, 소득세 절세 요령, 해외 사입 및 인보이스 세무 처리 등)에 대한 신뢰도 높은 자문과 장부 진단 서비스를 제공합니다.

[사장님의 현재 장부 정보]
- 현재 장부에 등록된 총 거래 건수: ${transactionsCount}개
- 증빙 자료 보관 건수: ${evidencesCount}개
- 카테고리 자동매칭 규칙 수: ${rulesCount}개

[현재 장부의 거래 내역 상세 (최근 최대 40건)]
${transactionsSummary}

[상황별 답변 가이드라인]
1. 세금 상식/신고 질문: 부가가치세 환급 조건, 종합소득세율, 간이사업자의 장단점 등 대한민국 세법에 맞춰 정확하고 핵심 위주로, 가독성 높은 마크다운 형식으로 설명해 주세요.
2. '장부 분석', '문제점 진단', '절세 조언' 등을 요청할 때:
   - 위 [현재 장부의 거래 내역]에서 분류 매칭이 잘못되었을 확률이 높은 건을 날카롭게 지목해 피드백을 주세요 (예: "거래처가 DHL이나 우체국인데 카테고리가 '상품매입'으로 되어 있네요. 이는 '배송비' 카테고리로 변경하는 것이 국세청 분류상 더 명확합니다.").
   - 거래 금액이 수만 원 이상인데도 증빙여부가 '누락됨'으로 된 건들을 찾아내어 "이 거래들은 꼭 영수증이나 인보이스 이미지를 스캔/업로드 하셔서 증빙을 연동해 놓으셔야 종소세 비용 인정이 수월합니다."라고 조언해 주세요.
   - 사장님의 매입 분포나 항목을 보고 지출이 많은 부문 및 절세 아이디어를 간략하게 추천해 주세요.
3. 말투: 친근하고 따뜻하며, 전문성 있고 스마트한 어조를 유지하세요. 이모티콘을 적당히 조화롭게 사용해 주고 꼭 한글 존댓말을 구사해 주세요.`;

    // Map history to Google GenAI content format
    const formattedContents: any[] = [];
    
    // Add history from client
    if (Array.isArray(history)) {
      history.forEach((h: any) => {
        if (h.role === "user" || h.role === "model") {
          formattedContents.push({
            role: h.role,
            parts: [{ text: h.text }]
          });
        } else if (h.role === "assistant") {
          formattedContents.push({
            role: "model",
            parts: [{ text: h.text }]
          });
        }
      });
    }

    // Add current user prompt
    formattedContents.push({
      role: "user",
      parts: [{ text: message }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      },
    });

    const aiMessage = response.text || "죄송합니다. 답변을 생성하지 못했습니다.";
    res.json({ success: true, text: aiMessage });

  } catch (error: any) {
    console.error("AI 챗봇 에러:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "서버 통신 중 알 수 없는 에러가 발생했습니다." 
    });
  }
});

// Vite & Static file configurations
async function initializeServer() {
  if (process.env.NODE_ENV !== "production") {
    // Mount Vite in development middleware mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite middleware mounted in development mode.");
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static files in production mode.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] 매입매출 증빙관리 웹사이트가 백엔드 포트 ${PORT}에서 작동 중입니다!`);
  });
}

initializeServer();
