const https = require('https');

const token = 'bcf06343-421c-4bf8-881a-481f671be6d0';
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

async function run() {
  const query = `
    query GetDeployments($serviceId: String!) {
      deployments(first: 3, input: { serviceId: $serviceId }) {
        edges {
          node {
            id
            status
            createdAt
            meta
          }
        }
      }
    }
  `;

  const res = await callRailway(query, { serviceId });
  const deployments = res.data.deployments.edges.map(e => ({
    id: e.node.id,
    status: e.node.status,
    createdAt: e.node.createdAt,
    commit: e.node.meta.commitMessage,
    commitHash: e.node.meta.commitHash
  }));
  console.log('Deployments:', JSON.stringify(deployments, null, 2));

  // Get logs for the active deployment
  const activeDeploy = deployments.find(d => d.status === 'SUCCESS' || d.status === 'CRASHED' || d.status === 'BUILDING' || d.status === 'DEPLOYING') || deployments[0];
  if (activeDeploy) {
    console.log(`\n📋 Logs do deployment ${activeDeploy.id} (${activeDeploy.status}):`);
    const logsQuery = `
      query GetDeploymentLogs($deploymentId: String!) {
        deploymentLogs(deploymentId: $deploymentId, limit: 100) {
          timestamp
          message
          severity
        }
      }
    `;
    const logsRes = await callRailway(logsQuery, { deploymentId: activeDeploy.id });
    if (logsRes.data && logsRes.data.deploymentLogs) {
      logsRes.data.deploymentLogs.slice(-30).forEach(log => {
        console.log(`[${log.timestamp}] ${log.message}`);
      });
    } else {
      console.log('Log result:', JSON.stringify(logsRes));
    }
  }
}

run().catch(console.error);
