'use strict'
// 极简静态服务器：只用于本地预览 test/harness.html，不参与插件运行。
//   node test/serve.js [port]
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')

const port = Number(process.argv[2] || 8791)
const root = path.resolve(__dirname, '..')
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost')
  const relative = decodeURIComponent(url.pathname === '/' ? '/test/harness.html' : url.pathname)
  const target = path.join(root, relative)
  if (!target.startsWith(root)) {
    response.writeHead(403).end('forbidden')
    return
  }
  fs.readFile(target, (error, data) => {
    if (error) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found: ' + relative)
      return
    }
    response.writeHead(200, {
      'content-type': types[path.extname(target)] || 'application/octet-stream',
      'cache-control': 'no-store',
    })
    response.end(data)
  })
})

server.listen(port, '127.0.0.1', () => {
  console.log('harness: http://127.0.0.1:' + port + '/test/harness.html')
})
