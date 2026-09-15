const https = require('https');

const token = 'bcf06343-421c-4bf8-881a-481f671be6d0';
const projectId = '627374bf-827b-4e60-bff8-5d915860e383';
const environmentId = 'e7fa824c-b3a9-4268-89cd-67f003b7734c';
const serviceId = 'ff63ce16-798c-4e92-a3fd-8dc5f439541d';

function callRailway(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ query, variables });
    const req = https.request({
      hostname: 'backboard.railway.app',
      path: '/graphql/v2',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'project-access-token': token,
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ raw: body, statusCode: res.statusCode });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function createTrigger() {
  console.log('⚡ Criando Deployment Trigger para conectar branch "main" de janiojandson/PuzzleRadar...');

  const mutation = `
    mutation CreateTrigger($input: DeploymentTriggerCreateInput!) {
      deploymentTriggerCreate(input: $input) {
        id
        branch
        repository
      }
    }
  `;

  const res = await callRailway(mutation, {
    input: {
      projectId,
      environmentId,
      serviceId,
      repository: "janiojandson/PuzzleRadar",
      branch: "main",
      provider: "github",
      checkSuites: true
    }
  });

  console.log('Resultado da criação do Trigger:', JSON.stringify(res, null, 2));
}

createTrigger().catch(console.error);
