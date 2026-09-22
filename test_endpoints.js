const http = require('http');

setTimeout(() => {
  // Test worker registration
  const postData = JSON.stringify({
    name: 'test-go-worker-01',
    hardware: 'GPU',
    gpuModel: 'RTX 4090',
    cpuModel: 'amd64',
    lanes: 1024,
    version: '1.0.0'
  });
  
  const options = {
    hostname: 'localhost',
    port: 3010,
    path: '/api/worker/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Register response:', data);
      
      // Test get range
      const rangeReq = http.request({
        hostname: 'localhost',
        port: 3010,
        path: '/api/range/next/test-go-worker-01?client=go&hashrate=1200000000',
        method: 'GET'
      }, (res2) => {
        let d = '';
        res2.on('data', c => d += c);
        res2.on('end', () => console.log('Range response:', d));
      });
      rangeReq.end();
    });
  });
  req.on('error', e => console.error('Error:', e.message));
  req.write(postData);
  req.end();
}, 2000);