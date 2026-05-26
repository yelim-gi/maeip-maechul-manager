export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' })
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return res.status(400).json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' })
    }

    const { text, fileName, mimeType } = req.body || {}

    if (!text || text.trim().length < 3) {
      return res.status(400).json({ error: '분석할 텍스트가 부족합니다.' })
    }

    const prompt = `
너는 개인사업자 매입매출 증빙관리 사이트의 문서 분석 도우미야.
아래 OCR/문서 텍스트에서 필요한 정보를 추출해서 반드시 JSON만 반환해.

파일명: ${fileName || ''}
파일형식: ${mimeType || ''}

반환 형식:
{
  "doc_type": "거래명세서|영수증|세금계산서|현금영수증|관부가세납부서|카드내역|통장내역|기타",
  "vendor": "거래처명",
  "document_date": "YYYY-MM-DD 또는 빈 문자열",
  "currency": "KRW|JPY|USD|기타",
  "total_amount": 숫자,
  "supply_amount": 숫자,
  "vat": 숫자,
  "shipping_fee": 숫자,
  "duty_tax": 숫자,
  "items": [
    {
      "name_original": "원문 품목명",
      "name_ko": "한국어 요약명",
      "quantity": 숫자,
      "unit_price": 숫자,
      "amount": 숫자,
      "category_guess": "상품매입|포장재|배송비|관부가세|기타"
    }
  ],
  "confidence": 0부터 1까지 숫자,
  "warnings": ["확인 필요한 내용"]
}

주의:
- 금액은 콤마 없이 숫자만.
- 모르면 0 또는 빈 문자열.
- 일본어 품목명은 name_original에 원문 그대로 저장.
- 부가세/소비세/送料/합계/請求金額 같은 표현을 잘 구분.
- JSON 외의 설명은 절대 쓰지 마.

문서 텍스트:
${text}
`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        })
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'Gemini 분석 실패',
        raw: data
      })
    }

    const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    let parsed

    try {
      parsed = JSON.parse(resultText)
    } catch (e) {
      parsed = { raw_text: resultText, warnings: ['JSON 파싱 실패. 원문을 확인하세요.'] }
    }

    return res.status(200).json(parsed)
  } catch (error) {
    return res.status(500).json({ error: error.message || '서버 오류' })
  }
}
