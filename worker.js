#!/usr/bin/env node
/**
 * Mission Control Task Worker
 * 
 * Polls for tasks and sends them to OpenClaw agents for processing.
 * 
 * Usage:
 *   node worker.js
 *   node worker.js --interval 5000    # Poll every 5 seconds
 *   node worker.js --api-url http://localhost:3000
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '5000', 10);

async function processNextTask() {
  try {
    const response = await fetch(`${API_URL}/api/tasks/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`[${new Date().toISOString()}] Processed task: ${data.title}`);
    } else if (data.error === 'No tasks available to process') {
      // No tasks - that's fine, just wait
    } else {
      console.log(`[${new Date().toISOString()}] Task error: ${data.error}`);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Worker error:`, error.message);
  }
}

async function checkConnection() {
  try {
    // Just check if the API is responding - don't require gateway to be connected
    const response = await fetch(`${API_URL}/api/system/ready`);
    if (response.ok) {
      return true;
    }
  } catch (error) {
    // Ignore
  }
  return false;
}

async function main() {
  console.log('='.repeat(50));
  console.log('Mission Control Task Worker Started');
  console.log(`API URL: ${API_URL}`);
  console.log(`Poll Interval: ${POLL_INTERVAL}ms`);
  console.log('='.repeat(50));
  
  // Wait for API to be ready
  console.log('Waiting for API...');
  let connected = false;
  while (!connected) {
    connected = await checkConnection();
    if (!connected) {
      console.log('API not ready, waiting 5s...');
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  console.log('API is ready!');
  
  // Main loop
  setInterval(processNextTask, POLL_INTERVAL);
  
  // Process one immediately
  processNextTask();
}

main().catch(console.error);
