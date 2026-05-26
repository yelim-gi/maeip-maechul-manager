import { GoogleGenAI, Type } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY 환경변수가 Vercel에 설정되어 있지 않습니다.');
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

function getBody(req: any) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { fileData, fileType } = getBody(req);

    if (!fileData) {
      return res.status(400).json({ success: false, error: '파일 데이터가 존재하지 않습니다.' });
    }

    let mimeType = 'image/png';
    if (fileType) {
      const normalizedType = String(fileType).toLowerCase();
      if (normalizedType === 'pdf') mimeType = 'application/pdf';
      else if (normalizedType === 'jpg' || normalizedType === 'jpeg') mimeType = 'image/jpeg';
      else if (normalizedType === 'webp') mimeType = 'image/webp';
      else if (normalizedType === 'png') mimeType = 'image/png';
    }

    const ai = getAIClient();
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const cleanBase64 = String(fileData).replace(/^data:.*,/, '');

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          inlineData: {
            mimeType,
            data: cleanBase64
          }
        },
        {
          text: `이 문서는 한국 사업자가 세무 증빙을 위해 등록한 구매 영수증, 거래명세서, 세금계산서, 또는 해외 수입 일본어 인보이스(Invoice)입니다.
문서의 전체 텍스트와 레이아웃을 정확하게 OCR 분석한 후, 다음 정보들을 추출하여 지정된 JSON 구조로 응답해 주세요.

추출 규칙:
1. partner: 거래처명/상호
2. date: 거래 발생 날짜 (YYYY-MM-DD 형식)
3. amount: 총 결제액 또는 부가세를 포함한 합계액
4. tax: 부가세(VAT) 금액. 분리 표시가 없으면 합계 금액에서 10% 기준으로 계산하거나 0
5. shippingFee: 배송비/배송 수수료
6. customsFee: 관세/부가세 또는 수입비용
7. items: 구매 품목 리스트. 일본어 품목명은 translatedName에 한글 번역 포함
8. recommendedCategory: 상품매입, 배송비, 광고비, 소모품비, 지급수수료, 여비교통비, 통신비, 세금과공과, 복리후생비, 도서인쇄비, 임차료, 매출 중 가장 적합한 하나
9. rawSummary: 문서 종류 한 줄 요약`
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            partner: { type: Type.STRING },
            date: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            tax: { type: Type.NUMBER },
            shippingFee: { type: Type.NUMBER },
            customsFee: { type: Type.NUMBER },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  price: { type: Type.NUMBER },
                  translatedName: { type: Type.STRING }
                },
                required: ['name', 'quantity', 'price']
              }
            },
            recommendedCategory: { type: Type.STRING },
            rawSummary: { type: Type.STRING }
          },
          required: ['partner', 'date', 'amount', 'tax', 'shippingFee', 'customsFee', 'items', 'recommendedCategory']
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error('Gemini 응답을 분석할 수 없습니다.');
    }

    return res.status(200).json({ success: true, ocrResult: JSON.parse(resultText.trim()) });
  } catch (error: any) {
    console.error('AI 분석 에러:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '문서 분석 중 알 수 없는 에러가 발생했습니다.'
    });
  }
}
