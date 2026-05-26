import { GoogleGenAI } from '@google/genai';

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
    const { message, history, ledgerData } = getBody(req);

    if (!message) {
      return res.status(400).json({ success: false, error: '메시지가 존재하지 않습니다.' });
    }

    const ai = getAIClient();
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    const transactionsCount = ledgerData?.transactions?.length || 0;
    const evidencesCount = ledgerData?.evidencesCount || 0;
    const rulesCount = ledgerData?.rulesCount || 0;

    let transactionsSummary = '등록된 거래 내역이 없습니다.';
    if (ledgerData?.transactions?.length > 0) {
      transactionsSummary = ledgerData.transactions.slice(0, 40).map((t: any) => {
        return `- [${t.date}] 거래처: ${t.partner}, 금액: ${t.amount}원, 세액: ${t.tax}원, 분류: ${t.category}, 수입배송비/관세: 배송비(${t.shippingFee || 0}원)/관세(${t.customsFee || 0}원), 증빙여부: ${t.evidenceId ? '연동됨' : '누락됨'}`;
      }).join('\n');
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
   - 위 [현재 장부의 거래 내역]에서 분류 매칭이 잘못되었을 확률이 높은 건을 지목해 피드백을 주세요.
   - 거래 금액이 수만 원 이상인데도 증빙여부가 '누락됨'으로 된 건들을 찾아내어 증빙 업로드를 권해 주세요.
   - 지출이 많은 부문 및 절세 아이디어를 간략하게 추천해 주세요.
3. 말투: 친근하고 따뜻하며, 전문성 있고 스마트한 어조를 유지하세요. 이모티콘을 적당히 조화롭게 사용해 주고 꼭 한글 존댓말을 구사해 주세요.`;

    const formattedContents: any[] = [];
    if (Array.isArray(history)) {
      history.forEach((h: any) => {
        if (h.role === 'user' || h.role === 'model') {
          formattedContents.push({ role: h.role, parts: [{ text: h.text }] });
        } else if (h.role === 'assistant') {
          formattedContents.push({ role: 'model', parts: [{ text: h.text }] });
        }
      });
    }

    formattedContents.push({ role: 'user', parts: [{ text: message }] });

    const response = await ai.models.generateContent({
      model,
      contents: formattedContents,
      config: {
        systemInstruction,
        temperature: 0.7
      }
    });

    return res.status(200).json({ success: true, text: response.text || '죄송합니다. 답변을 생성하지 못했습니다.' });
  } catch (error: any) {
    console.error('AI 챗봇 에러:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '서버 통신 중 알 수 없는 에러가 발생했습니다.'
    });
  }
}
