// Repassa um arquivo JSON do TSE. O cache fica na borda da Vercel (s-maxage),
// então muita gente abrindo o painel gera poucas requisições ao TSE.
// Inclui suporte a ETag por hash SHA-1 do corpo, Vary e respostas 304 (seção 6.5).
const crypto = require('crypto');

module.exports = function makeProxy(upstream) {
  return async function handler(req, res) {
    const rest = [].concat(req.query.path || []).join('/');
    if (!/^[\w\-./]+\.json$/.test(rest) || rest.includes('..')) {
      res.status(400).send('caminho inválido');
      return;
    }

    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('vary', 'Accept-Encoding');

    const headers = { 'user-agent': 'painel-apuracao/2.0' };
    if (req.headers['if-none-match']) {
      headers['if-none-match'] = req.headers['if-none-match'];
    }
    if (req.headers['if-modified-since']) {
      headers['if-modified-since'] = req.headers['if-modified-since'];
    }

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 9000);
      const r = await fetch(upstream + rest, { headers, signal: ctrl.signal });
      clearTimeout(timer);

      if (r.status === 304) {
        res.setHeader('cache-control', 's-maxage=10, stale-while-revalidate=20');
        const upstreamEtag = r.headers.get('etag');
        if (upstreamEtag) res.setHeader('etag', upstreamEtag);
        res.status(304).end();
        return;
      }

      const body = Buffer.from(await r.arrayBuffer());
      const etag = r.headers.get('etag') || `"${crypto.createHash('sha1').update(body).digest('hex').slice(0, 16)}"`;

      res.setHeader('etag', etag);
      if (r.status === 200) {
        res.setHeader('cache-control', 's-maxage=10, stale-while-revalidate=20');
        if (req.headers['if-none-match'] === etag) {
          res.status(304).end();
          return;
        }
      } else {
        // Para 404 e outros códigos, mantém cache curto de 30s na borda (protege contra bloqueio do TSE)
        res.setHeader('cache-control', 's-maxage=30');
      }

      res.status(r.status).send(body);
    } catch (e) {
      res.setHeader('cache-control', 's-maxage=5');
      res.status(502).send('{"error":"upstream_unreachable"}');
    }
  };
};
