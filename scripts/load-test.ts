#!/usr/bin/env npx tsx
// =====================================================
// Load Testing Utility
// =====================================================

import { getPerformanceMonitor } from '../src/lib/performance-monitor';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

interface TestResult {
  endpoint: string;
  requests: number;
  successful: number;
  failed: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  p95Duration: number;
}

async function runLoadTest(
  endpoint: string,
  requests: number = 10,
  concurrency: number = 2
): Promise<TestResult> {
  const durations: number[] = [];
  let successful = 0;
  let failed = 0;

  console.log(`\nTesting ${endpoint} with ${requests} requests (${concurrency} concurrent)...`);

  const batches = Math.ceil(requests / concurrency);
  
  for (let batch = 0; batch < batches; batch++) {
    const batchSize = Math.min(concurrency, requests - batch * concurrency);
    const promises = [];

    for (let i = 0; i < batchSize; i++) {
      promises.push(
        (async () => {
          const start = Date.now();
          try {
            const res = await fetch(`${BASE_URL}${endpoint}`);
            const duration = Date.now() - start;
            durations.push(duration);
            
            if (res.ok) {
              successful++;
            } else {
              failed++;
            }
          } catch (error) {
            failed++;
            durations.push(Date.now() - start);
          }
        })()
      );
    }

    await Promise.all(promises);
    process.stdout.write('.');
  }

  console.log(' Done!');

  durations.sort((a, b) => a - b);
  const p95Index = Math.floor(durations.length * 0.95);

  return {
    endpoint,
    requests,
    successful,
    failed,
    avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length || 0,
    minDuration: durations[0] || 0,
    maxDuration: durations[durations.length - 1] || 0,
    p95Duration: durations[p95Index] || 0,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const requests = parseInt(args[0]) || 20;
  const concurrency = parseInt(args[1]) || 4;

  console.log('\n🚀 Load Test Utility\n');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Requests per endpoint: ${requests}`);
  console.log(`Concurrency: ${concurrency}`);

  const endpoints = [
    '/api/agents',
    '/api/tasks',
    '/api/analytics/agents',
    '/api/analytics/tasks',
    '/api/analytics/system',
    '/api/analytics/performance',
  ];

  const results: TestResult[] = [];

  for (const endpoint of endpoints) {
    try {
      const result = await runLoadTest(endpoint, requests, concurrency);
      results.push(result);
    } catch (error) {
      console.error(`  Error testing ${endpoint}:`, error);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 RESULTS\n');
  console.log('Endpoint'.padEnd(35) + 'Avg'.padStart(8) + 'P95'.padStart(8) + 'Success'.padStart(10));
  console.log('-'.repeat(61));

  for (const result of results) {
    const successRate = ((result.successful / result.requests) * 100).toFixed(0) + '%';
    console.log(
      result.endpoint.padEnd(35) +
      `${Math.round(result.avgDuration)}ms`.padStart(8) +
      `${Math.round(result.p95Duration)}ms`.padStart(8) +
      successRate.padStart(10)
    );
  }

  console.log('\n' + '='.repeat(60));

  // Summary
  const totalRequests = results.reduce((sum, r) => sum + r.requests, 0);
  const totalSuccessful = results.reduce((sum, r) => sum + r.successful, 0);
  const avgDuration = results.reduce((sum, r) => sum + r.avgDuration, 0) / results.length;

  console.log('\n📝 SUMMARY\n');
  console.log(`  Total Requests: ${totalRequests}`);
  console.log(`  Successful: ${totalSuccessful} (${((totalSuccessful / totalRequests) * 100).toFixed(1)}%)`);
  console.log(`  Avg Latency: ${Math.round(avgDuration)}ms`);
  console.log('\nDone!\n');
}

main().catch(console.error);
