const https = require('https');
const token = 'bcf06343-421c-4bf8-881a-481f671be6d0';
const serviceId = 'ff63ce16-798c-4e92-a3fd-8dc5f439541d';

const payload = JSON.stringify({
  query: `query {
    deployments(input: { serviceId: "${serviceId}" }, first: 5) {
      edges {
        node {
          id
          status
          createdAt
          updatedAt
        }
      }
    }
  }`
});

const req = https.request({
  hostname: 'backboard.railway.app',
  path: '/graphql/v2',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'project-access-token': token,
    'Content-Length': Buffer.byteLength(payload)
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log(JSON.stringify(JSON.parse(body), null, 2)));
});
req.write(payload);
req.end();
