const http = require('http');
const { spawn } = require('child_process');

const server = spawn('node', ['src/server/index.js'], {
  cwd: 'D:\\Programas\\Desenvolvendo\\PuzzleRadar',
  stdio: ['ignore', 'pipe', 'pipe']
});

server.stdout.on('data', (data) => {
  console.log(`[SERVER] ${data.toString().trim()}`);
});

server.stderr.on('data', (data) => {
  console.error(`[SERVER ERR] ${data.toString().trim()}`);
});

setTimeout(() => {
  runTests();
}, 3000);

function runTests() {
  // Test 1: Worker registration
  testRegister()
    .then(() => testGetRange())
    .then(() => testHeartbeat())
    .then(() => testStats())
    .then(() => testFleetSummary())
    .then(() => {
      console.log('\n✅ All tests passed!');
      server.kill();
      process.exit(0);
    })
    .catch(err => {
      console.error('\n❌ Test failed:', err.message);
      server.kill();
      process.exit(1);
    });
}

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function testRegister() {
  console.log('\n📝 Test 1: Worker Registration');
  return httpRequest({
    hostname: 'localhost',
    port: 3010,
    path: '/api/workers/worker/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: 'test-go-worker-01',
    hardware: 'GPU',
    gpuModel: 'RTX 4090',
    cpuModel: 'amd64',
    lanes: 1024,
    version: '1.0.0'
  }).then(res => {
    console.log('Response:', JSON.stringify(res, null, 2));
    if (!res.success) throw new Error('Registration failed');
  });
}

function testGetRange() {
  console.log('\n📦 Test 2: Get Range (Go Worker)');
  return httpRequest({
    hostname: 'localhost',
    port: 3010,
    path: '/api/range/next/test-go-worker-01?client=go&hashrate=1200000000',
    method: 'GET'
  }).then(res => {
    console.log('Response:', JSON.stringify(res, null, 2));
    if (!res.custom_range) throw new Error('No custom_range in response');
  });
}

function testHeartbeat() {
  console.log('\n💓 Test 3: Heartbeat');
  return httpRequest({
    hostname: 'localhost',
    port: 3010,
    path: '/api/workers/worker/beat',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    worker_id: 'go_test-go-worker-01_1234567890',
    keys_checked: 1000000,
    hashrate: 1200000000,
    progress_pct: '0.5',
    current_key: '0x400000000000000000',
    status: 'RUNNING',
    lote_id: 'test-lote'
  }).then(res => {
    console.log('Response:', JSON.stringify(res, null, 2));
    if (!res.ok) throw new Error('Heartbeat failed');
  });
}

function testStats() {
  console.log('\n📊 Test 4: Worker Stats');
  return httpRequest({
    hostname: 'localhost',
    port: 3010,
    path: '/api/workers/worker/stats/go_test-go-worker-01_1234567890',
    method: 'GET'
  }).then(res => {
    console.log('Response:', JSON.stringify(res, null, 2));
    if (!res.success) throw new Error('Stats failed');
  });
}

function testFleetSummary() {
  console.log('\n🚀 Test 5: Fleet Summary');
  return httpRequest({
    hostname: 'localhost',
    port: 3010,
    path: '/api/workers/fleet/summary',
    method: 'GET'
  }).then(res => {
    console.log('Response:', JSON.stringify(res, null, 2));
    if (!res.success) throw new Error('Fleet summary failed');
  });
}