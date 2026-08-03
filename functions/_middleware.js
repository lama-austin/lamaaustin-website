// Manual "Markdown for Agents" content negotiation for Cloudflare Pages.
// Mirrors https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/
// (that product feature requires a Pro/Business/Enterprise zone; this reproduces
// the same request/response contract as a free Pages Function instead.)
export async function onRequest(context) {
  const { request, next } = context;
  const response = await next();

  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('text/html')) return response;

  const accept = request.headers.get('Accept') || '';
  if (!accept.includes('text/markdown')) return varyOnAccept(response);

  const html = await response.text();
  const markdown = htmlToMarkdown(html, request.url);

  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'text/markdown; charset=utf-8');
  headers.set('x-markdown-tokens', String(estimateTokens(markdown)));
  headers.set('Vary', 'Accept');
  headers.delete('Content-Length');
  headers.delete('ETag');
  headers.delete('Last-Modified');

  return new Response(markdown, { status: response.status, headers });
}

function varyOnAccept(response) {
  const headers = new Headers(response.headers);
  const existing = headers.get('Vary');
  headers.set('Vary', existing ? (existing.includes('Accept') ? existing : `${existing}, Accept`) : 'Accept');
  return new Response(response.body, { status: response.status, headers });
}

function htmlToMarkdown(html, pageUrl) {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? clean(titleMatch[1]) : '';

  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]*>/i);
  const descContent = descMatch && descMatch[0].match(/content=["']([^"']*)["']/i);
  const description = descContent ? decodeEntities(descContent[1]).trim() : '';

  const jsonLdBlocks = [];
  html = html.replace(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi, (_, body) => {
    jsonLdBlocks.push(body.trim());
    return '';
  });

  html = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '');

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  let body = bodyMatch ? bodyMatch[1] : html;

  body = body
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, inner) => `**${clean(inner)}**`)
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, inner) => `*${clean(inner)}*`)
    .replace(/<img[^>]*\bsrc=["']([^"']*)["'][^>]*>/gi, (tag, src) => {
      const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
      const alt = altMatch ? decodeEntities(altMatch[1]) : '';
      return `![${alt}](${resolveUrl(src, pageUrl)})`;
    })
    .replace(/<a[^>]+href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
      const text = clean(inner);
      return text ? `[${text}](${resolveUrl(href, pageUrl)})` : '';
    });

  for (let level = 1; level <= 6; level++) {
    const re = new RegExp(`<h${level}[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'gi');
    body = body.replace(re, (_, inner) => `\n\n${'#'.repeat(level)} ${clean(inner)}\n\n`);
  }

  body = body
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => `- ${clean(inner)}\n`)
    .replace(/<\/?(ul|ol)[^>]*>/gi, '\n')
    .replace(/<\/(p|div|section|article)>/gi, '\n\n')
    .replace(/<(p|div|section|article)[^>]*>/gi, '');

  body = decodeEntities(stripTags(body))
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  let out = '';
  if (title || description) {
    out += '---\n';
    if (title) out += `title: ${yamlEscape(title)}\n`;
    if (description) out += `description: ${yamlEscape(description)}\n`;
    out += '---\n\n';
  }
  out += body + '\n';
  for (const block of jsonLdBlocks) {
    out += `\n\`\`\`json\n${block}\n\`\`\`\n`;
  }
  return out;
}

function clean(fragment) {
  return decodeEntities(stripTags(fragment)).replace(/\s+/g, ' ').trim();
}

function stripTags(str) {
  return str.replace(/<[^>]+>/g, '');
}

function decodeEntities(str) {
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function resolveUrl(href, pageUrl) {
  try {
    return new URL(href, pageUrl).toString();
  } catch {
    return href;
  }
}

function yamlEscape(value) {
  const needsQuotes = /[:"'#{}[\],&*!|>%@`\n]/.test(value);
  if (!needsQuotes) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}
