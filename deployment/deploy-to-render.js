import fetch from 'node-fetch';

const RENDER_API_KEY = 'rnd_IVS11nXDAr4bh3BrdWa20ff6p0iy';
const RENDER_API_BASE = 'https://api.render.com/v1';

console.log('🚀 Deploying AI Agent Backend to Render...');

async function deployToRender() {
  try {
    // Step 1: Create a new web service
    console.log('📦 Creating Render web service...');
    
    const serviceConfig = {
      type: 'web_service',
      name: 'ai-agent-backend',
      ownerId: null, // Will use default owner
      repo: 'https://github.com/Mazowillbe2k/ai-app', // Update with your repo
      branch: 'main',
      runtime: 'node',
      buildCommand: 'cd backend && npm install',
      startCommand: 'cd backend && npm start',
      plan: 'free',
      region: 'oregon', // or 'virginia', 'frankfurt', 'singapore'
      envVars: [
        {
          key: 'NODE_ENV',
          value: 'production'
        },
        {
          key: 'PORT',
          value: '10000'
        }
      ],
      healthCheckPath: '/health'
    };

    const createResponse = await fetch(`${RENDER_API_BASE}/services`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(serviceConfig)
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create service: ${createResponse.status} ${errorText}`);
    }

    const service = await createResponse.json();
    console.log('✅ Service created:', service.service.name);
    console.log('🔗 Service URL:', service.service.serviceDetails.url);
    console.log('📋 Service ID:', service.service.id);

    // Step 2: Check deployment status
    console.log('⏳ Waiting for deployment to complete...');
    
    const serviceId = service.service.id;
    let deploymentComplete = false;
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes with 10-second intervals

    while (!deploymentComplete && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      
      const statusResponse = await fetch(`${RENDER_API_BASE}/services/${serviceId}`, {
        headers: {
          'Authorization': `Bearer ${RENDER_API_KEY}`,
        }
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        const deployStatus = statusData.serviceDetails?.deployStatus;
        
        console.log(`📊 Deployment status: ${deployStatus}`);
        
        if (deployStatus === 'live') {
          deploymentComplete = true;
          console.log('🎉 Deployment completed successfully!');
          console.log('🌐 Backend URL:', statusData.serviceDetails.url);
          
          // Test the deployed service
          await testDeployedService(statusData.serviceDetails.url);
          
        } else if (deployStatus === 'build_failed' || deployStatus === 'update_failed') {
          throw new Error('Deployment failed');
        }
      }
      
      attempts++;
    }

    if (!deploymentComplete) {
      console.log('⚠️ Deployment is taking longer than expected. Check Render dashboard for status.');
    }

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    
    if (error.message.includes('401')) {
      console.error('🔑 Authentication failed. Please check your Render API key.');
    } else if (error.message.includes('repo')) {
      console.error('📁 Make sure your GitHub repository is accessible and the URL is correct.');
    }
    
    process.exit(1);
  }
}

async function testDeployedService(url) {
  try {
    console.log('🧪 Testing deployed service...');
    
    const testResponse = await fetch(`${url}/health`);
    const testData = await testResponse.json();
    
    console.log('✅ Health check passed:', testData);
    
    // Update frontend configuration
    console.log('📝 Update your frontend to use the deployed backend:');
    console.log(`   Backend URL: ${url}`);
    console.log(`   API Base: ${url}/api`);
    
  } catch (error) {
    console.error('⚠️ Service test failed:', error.message);
    console.log('The service might still be starting up. Try the health check manually.');
  }
}

// Alternative: Manual deployment instructions
function showManualInstructions() {
  console.log('\n📋 Manual Deployment Instructions:');
  console.log('1. Go to https://dashboard.render.com');
  console.log('2. Click "New +" → "Web Service"');
  console.log('3. Connect your GitHub repository');
  console.log('4. Configure the service:');
  console.log('   - Name: ai-agent-backend');
  console.log('   - Runtime: Node');
  console.log('   - Build Command: cd backend && npm install');
  console.log('   - Start Command: cd backend && npm start');
  console.log('   - Plan: Free');
  console.log('5. Add environment variables:');
  console.log('   - NODE_ENV: production');
  console.log('   - PORT: 10000');
  console.log('6. Set Health Check Path: /health');
  console.log('7. Deploy!');
}

// Check if this is a manual run or automated
if (process.argv.includes('--manual')) {
  showManualInstructions();
} else {
  deployToRender();
} 