const https = require('https');

const token = 'bcf06343-421c-4bf8-881a-481f671be6d0';
const projectId = '627374bf-827b-4e60-bff8-5d915860e383';
const environmentId = 'e7fa824c-b3a9-4268-89cd-67f003b7734c';
const serviceId = 'ff63ce16-798c-4e92-a3fd-8dc5f439541d'; // PuzzleRadar

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

async function inspectAndLink() {
  console.log('🔍 Consultando configurações de repositório do serviço PuzzleRadar...');

  const query = `
    query GetService($id: String!) {
      service(id: $id) {
        id
        name
        icon
      }
    }
  `;

  const serviceData = await callRailway(query, { id: serviceId });
  console.log('Dados do Serviço:', JSON.stringify(serviceData, null, 2));

  // Tentar conectar o repositório github via mutation serviceConnect
  console.log('⚡ Tentando conectar o repositório janiojandson/PuzzleRadar (branch: main)...');
  
  // Lista de mutations possíveis no Railway GraphQL para conectar repositório
  const connectMutation = `
    mutation ServiceUpdate($id: String!, $input: ServiceUpdateInput!) {
      serviceUpdate(id: $id, input: $input) {
        id
        name
      }
    }
  `;

  const updateRes = await callRailway(connectMutation, {
    id: serviceId,
    input: {
      source: {
        repo: "janiojandson/PuzzleRadar"
      }
    }
  });
  console.log('Resultado serviceUpdate:', JSON.stringify(updateRes, null, 2));

  // Tentar disparar novo deployment manual
  console.log('🚀 Tentando acionar build/deploy manual...');
  const deployMutation = `
    mutation DeploymentTrigger($input: DeploymentTriggerInput!) {
      deploymentTrigger(input: $input)
    }
  `;

  const deployRes = await callRailway(deployMutation, {
    input: {
      projectId,
      environmentId,
      serviceId,
      branch: "main"
    }
  });
  console.log('Resultado deploymentTrigger:', JSON.stringify(deployRes, null, 2));
}

inspectAndLink().catch(console.error);
