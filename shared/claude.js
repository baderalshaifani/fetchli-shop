// ===================================
// fetchli.shop — Claude API مشترك
// ===================================
// كل موديول يستدعي هذه الدالة بـ prompt خاص به

const fetch  = require('node-fetch');
const config = require('../config');

/**
 * استدعاء Claude API
 * @param {object} options
 * @param {string}   options.system       — system prompt
 * @param {Array}    options.messages     — messages array
 * @param {number}   [options.maxTokens]  — افتراضي 1000
 * @returns {string} نص الرد من Claude
 */
async function callClaude({ system, messages, maxTokens = 1000 }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         config.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Claude API error: ${data.error.message}`);
  }

  return data.content?.[0]?.text || '';
}

/**
 * استدعاء Claude مع prefill لـ JSON نقي
 * يضيف { في بداية رد Claude لضمان JSON صحيح
 */
async function callClaudeJSON({ system, userContent, maxTokens = 1000 }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         config.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system,
      messages: [
        { role: 'user',      content: userContent },
        { role: 'assistant', content: [{ type: 'text', text: '{' }] },
      ],
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Claude API error: ${data.error.message}`);
  }

  const raw  = data.content?.[0]?.text || '';
  const text = raw.startsWith('{') ? raw : '{' + raw;
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    console.error('Claude raw response:', raw.slice(0, 200));
    throw new Error('No valid JSON in Claude response');
  }

  return JSON.parse(jsonMatch[0]);
}

module.exports = { callClaude, callClaudeJSON };
