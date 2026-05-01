export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  // Test require in async function
  let test1 = 'ok';
  try {
    const fs = require('fs');
    test1 = `fs loaded: ${typeof fs.exists}`;
  } catch (e: any) { test1 = `error: ${e.message}`; }
  
  let test2 = 'ok';
  try {
    const http = require('http');
    test2 = `http loaded: ${typeof http.request}`;
  } catch (e: any) { test2 = `error: ${e.message}`; }
  
  let test3 = 'ok';
  try {
    const https = require('https');
    test3 = `https loaded: ${typeof https.request}`;
  } catch (e: any) { test3 = `error: ${e.message}`; }
  
  return NextResponse.json({ test1, test2, test3 });
}
