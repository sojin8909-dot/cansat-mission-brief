module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'server_not_configured' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const ideaTitle = String(body.ideaTitle || '').slice(0, 300);
  const step1 = String(body.step1 || '').slice(0, 1000);
  const step2 = String(body.step2 || '').slice(0, 1000);
  const step3 = String(body.step3 || '').slice(0, 1000);
  const step4 = String(body.step4 || '').slice(0, 1000);
  const step5 = String(body.step5 || '').slice(0, 1000);

  if (!step1 && !step2 && !step3) {
    res.status(400).json({ error: 'empty_idea' });
    return;
  }

  const prompt = [
    '너는 항공우주공학과 학부 1학년 캔위성(CanSat) 캡스톤 디자인 팀을 돕는 조언자야.',
    '아래는 학생이 편하게 적은 아이디어 초안이야. 맞춤법이나 표현이 거칠 수 있어.',
    '',
    '[아이디어 제목] ' + (ideaTitle || '(미입력)'),
    '[문제 정의] ' + (step1 || '(미입력)'),
    '[아이디어 설명] ' + (step2 || '(미입력)'),
    '[어떻게 만들까] ' + (step3 || '(미입력)'),
    '[좋은 점] ' + (step4 || '(미입력)'),
    '[예상되는 어려움] ' + (step5 || '(미입력)'),
    '',
    '두 가지를 해줘.',
    '1) 각 항목의 내용을 새로 지어내지 말고, 학생이 적은 내용을 문장만 다듬어서 더 깔끔하고 명확하게 정리해줘. 미입력 항목은 빈 문자열로 둬.',
    '2) 항공우주공학과 1학년 눈높이에서, 전문 용어를 최대한 피해 이 아이디어의 실현 가능성과 위험 요소를 쉬운 말로 분석해줘.',
    '',
    '아래 JSON 스키마로만 답해. 다른 설명 문장은 절대 포함하지 마.',
    '{',
    '  "polished": {',
    '    "step1": "",',
    '    "step2": "",',
    '    "step3": "",',
    '    "step4": "",',
    '    "step5": ""',
    '  },',
    '  "feasibility": "낮음|보통|높음 중 하나",',
    '  "feasibility_reason": "1~2문장, 쉬운 말",',
    '  "risk_level": "낮음|보통|높음 중 하나",',
    '  "risks": ["구체적인 위험 요소 2~4개, 각각 한 문장"],',
    '  "suggestions": ["보완 방법 1~3개, 각각 한 문장"]',
    '}'
  ].join('\n');

  const model = 'gemini-3.6-flash';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.4
        }
      })
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      res.status(upstream.status === 429 ? 429 : 502).json({
        error: 'upstream_error',
        detail: errText.slice(0, 1200)
      });
      return;
    }

    const data = await upstream.json();
    const candidate = data && data.candidates && data.candidates[0];
    const text = candidate && candidate.content && candidate.content.parts
      && candidate.content.parts[0] && candidate.content.parts[0].text;

    if (!text) {
      res.status(502).json({ error: 'empty_response' });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      res.status(502).json({ error: 'invalid_json' });
      return;
    }

    res.status(200).json(parsed);
  } catch (err) {
    res.status(502).json({ error: 'request_failed' });
  }
};
