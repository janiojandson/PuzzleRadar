const https = require('https');

const token = 'bcf06343-421c-4bf8-881a-481f671be6d0';

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

async function inspectTypes() {
  const query = `
    query {
      deploymentTriggerType: __type(name: "DeploymentTriggerCreateInput") {
        inputFields {
          name
          type {
            name
            kind
          }
        }
      }
      serviceUpdateType: __type(name: "ServiceUpdateInput") {
        inputFields {
          name
          type {
            name
            kind
          }
        }
      }
      serviceInstanceUpdateType: __type(name: "ServiceInstanceUpdateInput") {
        inputFields {
          name
          type {
            name
            kind
          }
        }
      }
    }
  `;

  const data = await callRailway(query);
  console.log('DeploymentTriggerCreateInput:', JSON.stringify(data.data.deploymentTriggerType, null, 2));
  console.log('ServiceInstanceUpdateInput:', JSON.stringify(data.data.serviceInstanceUpdateType, null, 2));
}

inspectTypes().catch(console.error);
