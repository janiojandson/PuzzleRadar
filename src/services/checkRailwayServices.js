const https = require('https');

const token = 'bcf06343-421c-4bf8-881a-481f671be6d0';
const projectId = '627374bf-827b-4e60-bff8-5d915860e383';

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

async function check() {
  const query = `
    query GetProj($id: String!) {
      project(id: $id) {
        id
        name
        environments {
          edges {
            node {
              id
              name
            }
          }
        }
        services {
          edges {
            node {
              id
              name
              icon
            }
          }
        }
      }
    }
  `;

  const data = await callRailway(query, { id: projectId });
  const envId = data.data.project.environments.edges[0].node.id;

  console.log(`\n🏢 Projeto Railway: ${data.data.project.name} (ID: ${projectId})`);
  console.log(`🌐 Ambiente: ${envId}\n`);

  const varQuery = `
    query GetVars($projectId: String!, $environmentId: String!, $serviceId: String!) {
      variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
    }
  `;

  for (const s of data.data.project.services.edges) {
    const sId = s.node.id;
    const sName = s.node.name;

    const vars = await callRailway(varQuery, {
      projectId,
      environmentId: envId,
      serviceId: sId
    });

    console.log(`────────────────────────────────────────────────────────────`);
    console.log(`📦 Serviço: "${sName}" | ID: ${sId}`);
    if (vars.data && vars.data.variables) {
      console.log('   Variáveis configuradas:');
      const vObj = vars.data.variables;
      for (const [k, v] of Object.entries(vObj)) {
        if (k.includes('GOOGLE') || k.includes('RAILWAY') || k.includes('PORT') || k.includes('NODE') || k.includes('URL') || k.includes('SECRET')) {
          console.log(`     - ${k} = ${v}`);
        }
      }
    } else {
      console.log('   (Sem variáveis ou erro ao consultar)', vars);
    }
  }
}

check().catch(console.error);
