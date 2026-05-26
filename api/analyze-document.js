export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST만 지원합니다.' })
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' })
    }

    const { fileName, mimeType, base64, text } = req.body || {}

    if (!base64 && !text) {
      return res.status(400).json({ error: '분석할 파일 또는 텍스트가 없습니다.' })
    }

    const prompt = `
너는 개인사업자 매입매출 증빙관리 사이트의 문서 분석 보조야.
거래명세서, 영수증, 세금계산서, 현금영수증, 인보이스, 일본어 명세서에서 필요한 정보를 추출해.

반드시 JSON만 반환해.
설명 문장 금지.
마크다운 코드블록 금지.

JSON 형식:
{
  "documentType": "거래명세서",
  "vendor": "거래처명",
  "documentDate": "YYYY-MM-DD",
  "currency": "KRW 또는 JPY",
  "subtotal": 0,
  "vat": 0,
  "shippingFee": 0,
  "customsDuty": 0,
  "totalAmount": 0,
  "categorySuggestion": "상품매입",
  "confidence": 0,
  "warnings": [],
  "items": [
    {
      "nameOriginal": "원문 품목명",
      "nameKo": "한국어 요약명",
      "quantity": 0,
      "unitPrice": 0,
      "amount": 0
    }
  ]
}

파일명: ${fileName || '직접입력'}
`

    const parts = [{ text: prompt }]

    if (text) {
      parts.push({ text })
    }

    if (base64) {
      parts.push({
        inlineData: {
          mimeType: mimeType || 'application/octet-stream',
          data: base64
        }
      })
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationConfig: {
            temperature: 0.1
          },
          contents: [
            {
              role: 'user',
              parts
            }
          ]
        })
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'Gemini 분석 실패'
      })
    }

    const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

    let cleanText = resultText.trim()
    cleanText = cleanText.replace(/^```json/i, '')
    cleanText = cleanText.replace(/^```/i, '')
    cleanText = cleanText.replace(/```$/i, '')
    cleanText = cleanText.trim()

    let result

    try {
      result = JSON.parse(cleanText)
    } catch {
      result = {
        documentType: '기타',
        vendor: '',
        documentDate: '',
        currency: 'KRW',
        subtotal: 0,
        vat: 0,
        shippingFee: 0,
        customsDuty: 0,
        totalAmount: 0,
        categorySuggestion: '확인필요',
        confidence: 0,
        warnings: ['JSON 파싱 실패: raw 값을 확인하세요.'],
        items: [],
        raw: resultText
      }
    }

    return res.status(200).json({ result })
  } catch (error) {
    return res.status(500).json({
      error: error.message || '서버 오류'
    })
  }
}
