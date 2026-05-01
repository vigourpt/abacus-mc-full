// Test: what happens if we use libsql:// directly with authToken
import { createClient } from '@libsql/client';

// libsql:// uses HTTP transport (not HTTPS)
// The server at abacus-mc-vigourpt.aws-eu-west-1.turso.io supports BOTH:
// - libsql:// protocol (HTTP, port 443 or 8080)
// - https:// protocol (HTTPS)

const client = createClient({
  url: 'libsql://abacus-mc-vigourpt.aws-eu-west-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzc1ODQzMDUsImlkIjoiMDE5ZGUwNDQtZTIwMS03MDIwLWE4M2MtZjc4OGVmNzdmYjc1IiwicmlkIjoiZGRmZjU0MzQtODI2Ni00YmY5LTgyYjYtMWYyNzM5MjljYmJiIn0.eOS1O1ZAt_w3LPQOs12kUU3HPC3FoOXutNWFN01gU1GhVo9eNDbu3HEUDSCTiVT1qm_mDlRc9jramm4dbT4VAA',
});

const result = await client.execute('SELECT COUNT(*) as count FROM agents');
console.log('Result:', JSON.stringify(result));
