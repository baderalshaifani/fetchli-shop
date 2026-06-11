// ===================================
// shared/claude.js — استدعاء Claude API
// ===================================

const fetch  = require('node-fetch');
const config = require('../config');

/**
 * استدعاء Claude messages API
 * @returns {string} النص الخام من رد النموذج
 */
async function callClaude({ system, messages, max_tokens = 1000 }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         config.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.CLAUDE_MODEL,
      max_tokens,
      ...(system ? { system } : {}),
      messages,
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'Claude API error');
  return data.content?.[0]?.text || '';
}

/** يستخرج JSON من نص قد يحتوي markdown أو نص زائد */
function extractJson(raw) {
  const clean = String(raw).replace(/```json|```/g, '').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in response');
  return JSON.parse(match[0]);
}

module.exports = { callClaude, extractJson };
