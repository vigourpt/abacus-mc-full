export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import * as os from 'os';

// Use native https instead of db.ts to avoid Promise issues
const https = require('https');

async function queryTurso(sql: string): Promise<any> {
  const data = JSON.stringify({ statements: [sql] });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'abacus-mc-vigourpt.aws-eu-west-1.turso.io',
      port: 443, path: '/', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzc1ODQzMDUsImlkIjoiMDE5ZGUwNDQtZTIwMS03MDIwLWE4M2MtZjc4OGVmNzdmYjc1IiwicmlkIjoiZGRmZjU0MzQtODI2Ni00YmY5LTgyYjYtMWYyNzM5MjljYmJiIn0.eOS1O1ZAt_w3LPQOs12kUU3HPC3FoOXutNWFN01gU1GhVo9eNDbu3HEUDSCTiVT1qm_mDlRc9jramm4dbT4VAA`, 'Content-Length': Buffer.byteLength(data) },
      timeout: 10000,
    }, (res) => { let b = ''; res.on('data', c => b += c); res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve(null); } }); });
    req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data); req.end();
  });
}

export async function GET() {
  try {
    const [agentResult, taskResult, dbCheck] = await Promise.all([
      queryTurso('SELECT COUNT(*) as count FROM agents'),
      queryTurso('SELECT COUNT(*) as count FROM tasks'),
      queryTurso('SELECT 1'),
    ]);
    
    const agentCount = agentResult?.[0]?.results?.rows?.[0]?.[0] ?? 0;
    const taskCount = taskResult?.[0]?.results?.rows?.[0]?.[0] ?? 0;
    const dbOk = dbCheck && !dbCheck[0]?.error;
    
    const cpuUsage = os.loadavg()[0];
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);
    
    const openclawConfigured = !!process.env.OPENCLAW_GATEWAY_HOST;
    
    return NextResponse.json({
      status: 'healthy',
      version: '1.0.0',
      uptime: process.uptime(),
      checks: {
        database: { status: dbOk ? 'pass' : 'fail' },
        memory: { status: memoryUsage > 95 ? 'fail' : 'pass', detail: `${memoryUsage}%` },
      },
      stats: {
        agents: { total: agentCount },
        tasks: { total: taskCount },
      },
      system: { cpu: cpuUsage, memory: memoryUsage },
      config: { openclawConfigured },
    });
  } catch (error) {
    return NextResponse.json({ status: 'unhealthy', error: String(error) }, { status: 500 });
  }
}
