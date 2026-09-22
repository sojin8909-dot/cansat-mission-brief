module.exports = async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'server_not_configured' });
    return;
  }

  try {
    const upstream = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey
    );
    const data = await upstream.json();
    const models = (data.models || [])
      .filter(function(m){
        return (m.supportedGenerationMethods || []).indexOf('generateContent') !== -1;
      })
      .map(function(m){
        return { name: m.name, displayName: m.displayName };
      });
    res.status(upstream.status).json({ models: models });
  } catch (err) {
    res.status(502).json({ error: 'request_failed' });
  }
};
