const https = require('https');

const token = 'bcf06343-421c-4bf8-881a-481f671be6d0';
const projectId = '627374bf-827b-4e60-bff8-5d915860e383';
const environmentId = 'e7fa824c-b3a9-4268-89cd-67f003b7734c';
const puzzleRadarServiceId = 'ff63ce16-798c-4e92-a3fd-8dc5f439541d';

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

async function run() {
  console.log('⚡ Injetando variáveis EXATAMENTE no serviço PuzzleRadar (ff63ce16-798c-4e92-a3fd-8dc5f439541d)...');

  const mutation = `
    mutation VariableUpsert($input: VariableUpsertInput!) {
      variableUpsert(input: $input)
    }
  `;

  const varsToSet = [
    { name: 'GOOGLE_SPREADSHEET_ID', value: '1-rmjfxommqVZ-MNLMozU5EevdMErWQdKIM594lltIpg' },
    { name: 'GOOGLE_APPS_SCRIPT_WEBHOOK_URL', value: 'https://script.google.com/macros/s/AKfycbxx1VUWthDRiWJuLTFoD30dxK7-BeDDHhoqJ9hDWdCbjEurDf19-nttaQGvZIL4g0Q/exec' },
    { name: 'PORT', value: '3010' },
    { name: 'NODE_ENV', value: 'production' }
  ];

  for (const v of varsToSet) {
    const res = await callRailway(mutation, {
      input: {
        projectId,
        environmentId,
        serviceId: puzzleRadarServiceId,
        name: v.name,
        value: v.value
      }
    });
    console.log(`Variável ${v.name} em PuzzleRadar:`, JSON.stringify(res));
  }

  // Trigger Redeploy of PuzzleRadar Service
  console.log('🚀 Solicitando Redeploy do serviço PuzzleRadar no Railway...');
  const redeployMutation = `
    mutation ServiceInstanceRedeploy($environmentId: String!, $serviceId: String!) {
      serviceInstanceRedeploy(environmentId: $environmentId, serviceId: $serviceId)
    }
  `;

  const deployRes = await callRailway(redeployMutation, {
    environmentId,
    serviceId: puzzleRadarServiceId
  });
  console.log('Resultado do Redeploy:', JSON.stringify(deployRes));
}

run().catch(console.error);
