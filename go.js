export default async function handler(req, res) {
  const url = new URL(req.url, 'https://baywb.pages.dev');

  // Check for authorization
  if (!isAuthorized(req)) {
    return res.status(401).setHeader('WWW-Authenticate', 'Basic realm="User Visible Realm"').send('Unauthorized. Please provide credentials.');
  }

  const newRequest = createNewRequest(url, req);
  const response = await fetch(newRequest);
  const contentLength = response.headers.get('Content-Length');
  const newHeaders = createNewHeaders(response.headers, contentLength);
  
  const range = req.headers.get('Range');
  if (range) {
    return handleRangeRequest(response, newHeaders, range, contentLength, res);
  }

  res.writeHead(200, newHeaders);
  response.body.pipe(res);
}

function isAuthorized(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return false;

  const encodedCredentials = Buffer.from('nim:leecher').toString('base64');
  return authHeader === `Basic ${encodedCredentials}`;
}

function createNewRequest(url, req) {
  return new Request(url, {
    method: req.method,
    headers: req.headers,
    body: req.method === 'POST' ? req.body : undefined,
    redirect: req.redirect,
  });
}

function createNewHeaders(originalHeaders, contentLength) {
  const newHeaders = {};
  for (const [key, value] of originalHeaders.entries()) {
    newHeaders[key] = value;
  }
  newHeaders['Content-Disposition'] = 'attachment';
  newHeaders['Accept-Ranges'] = 'bytes';

  if (contentLength) {
    newHeaders['Content-Length'] = contentLength;
  }

  return newHeaders;
}

function handleRangeRequest(response, headers, range, contentLength, res) {
  const parts = range.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1;
  const chunksize = end - start + 1;

  headers['Content-Range'] = `bytes ${start}-${end}/${contentLength}`;
  headers['Content-Length'] = chunksize.toString();

  res.writeHead(206, headers);
  const reader = response.body.getReader();

  return reader.read().then(function processText({ done, value }) {
    if (done) return;
    res.write(value);
    return reader.read().then(processText);
  });
}
