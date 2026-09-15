const https = require('https');

const token = process.env.RAILWAY_TOKEN || 'bcf06343-421c-4bf8-881a-481f671be6d0';
const projectId = process.env.RAILWAY_PROJECT_ID || '627374bf-827b-4e60-bff8-5d915860e383';

function callRailwayGraphQL(query, variables = {}) {
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
  console.log('📡 Consultando projeto com Project Access Token...');
  const projectQuery = `
    query GetProj($id: String!) {
      project(id: $id) {
        id
        name
        services {
          edges {
            node {
              id
              name
            }
          }
        }
        environments {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    }
  `;

  const projectData = await callRailwayGraphQL(projectQuery, { id: projectId });
  console.log('Resultado Railway:', JSON.stringify(projectData, null, 2));

  if (projectData.data && projectData.data.project) {
    const project = projectData.data.project;
    const environmentId = project.environments.edges[0]?.node?.id;
    const serviceId = project.services.edges[0]?.node?.id;

    console.log(`Projeto: ${project.name} | Env ID: ${environmentId} | Service ID: ${serviceId}`);

    if (environmentId && serviceId) {
      console.log('⚡ Atualizando variáveis no Railway...');
      const mutation = `
        mutation VariableUpsert($input: VariableUpsertInput!) {
          variableUpsert(input: $input)
        }
      `;

      const vars = [
        { name: 'GOOGLE_SPREADSHEET_ID', value: '1-rmjfxommqVZ-MNLMozU5EevdMErWQdKIM594lltIpg' },
        { name: 'GOOGLE_APPS_SCRIPT_WEBHOOK_URL', value: 'https://script.google.com/macros/s/AKfycbxx1VUWthDRiWJuLTFoD30dxK7-BeDDHhoqJ9hDWdCbjEurDf19-nttaQGvZIL4g0Q/exec' },
        { name: 'NODE_ENV', value: 'production' },
        { name: 'JWT_SECRET', value: 'puzzleradar_super_secret_jwt_key_2026_production' }
      ];

      for (const v of vars) {
        const res = await callRailwayGraphQL(mutation, {
          input: {
            projectId: project.id,
            environmentId,
            serviceId,
            name: v.name,
            value: v.value
          }
        });
        console.log(`Variável ${v.name}:`, res);
      }
      console.log('✅ Todas as variáveis foram atualizadas no Railway com sucesso!');
    }
  }
}

run().catch(console.error);
