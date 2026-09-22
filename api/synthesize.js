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

  const raw = String(body.text || '').slice(0, 8000).trim();
  if (!raw) {
    res.status(400).json({ error: 'empty_text' });
    return;
  }

  const prompt = [
    '너는 항공우주공학과 학부 1학년 캔위성(CanSat) 캡스톤 디자인 팀의 회의를 돕는 조언자야.',
    '아래는 카카오톡 등에서 모은, 팀원 여러 명이 각자 낸 아이디어 제안서를 이어붙인 텍스트야.',
    '형식이 정확히 통일되어 있지 않을 수 있어. 사람 이름/아이디어 제목/문제 정의/설명/구현 방법/좋은 점/어려움 같은 내용을 보고 알아서 아이디어별로 나눠줘.',
    '전문 용어를 최대한 피하고, 1학년이 이해할 수 있는 쉬운 말로 정리해줘.',
    '',
    '[모은 아이디어 원문]',
    raw,
    '',
    '아래 JSON 스키마로만 답해. 다른 설명 문장은 절대 포함하지 마.',
    '{',
    '  "ideas": [',
    '    {',
    '      "proposer": "제안자 이름, 모르면 빈 문자열",',
    '      "title": "아이디어 제목",',
    '      "summary": "한두 문장 요약",',
    '      "feasibility": "낮음|보통|높음 중 하나",',
    '      "risk_level": "낮음|보통|높음 중 하나"',
    '    }',
    '  ],',
    '  "comparison_note": "아이디어들을 서로 비교했을 때 두드러지는 차이점, 3~5문장",',
    '  "recommendation": "팀에 추천하는 방향 (특정 아이디어를 밀거나, 여러 아이디어를 합치는 방법 등), 3~5문장",',
    '  "discussion_points": ["회의에서 이야기해보면 좋을 질문이나 논의거리 2~4개, 각각 한 문장"]',
    '}'
  ].join('\n');

  const model = 'gemini-flash-lite-latest';
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
        detail: errText.slice(0, 300)
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
