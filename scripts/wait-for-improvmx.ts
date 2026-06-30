#!/usr/bin/env tsx
/**
 * Wait for ImprovMX domain to become active and check status
 */

import { config } from 'dotenv';
config({ path: '.env' });

const IMPROVMX_API_BASE = 'https://api.improvmx.com/v3';
const DOMAIN = 'weatherb.app';

async function improvmxRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const apiKey = process.env.IMPROVMX_API_KEY;
  if (!apiKey) {
    throw new Error('IMPROVMX_API_KEY environment variable is required');
  }

  const auth = Buffer.from(`api:${apiKey}`).toString('base64');

  const response = await fetch(`${IMPROVMX_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();
  return data as T;
}

async function checkDomainStatus() {
  const domain = await improvmxRequest<any>(`/domains/${DOMAIN}`);
  const domainData = domain.domain || domain;
  return {
    active: domainData.active === true,
    domain: domainData,
  };
}

async function waitForActive(maxWaitMinutes = 30) {
  console.log(`⏳ Waiting for ImprovMX domain to become active (max ${maxWaitMinutes} minutes)...\n`);
  
  const startTime = Date.now();
  const maxWaitMs = maxWaitMinutes * 60 * 1000;
  let checkCount = 0;

  while (Date.now() - startTime < maxWaitMs) {
    checkCount++;
    const { active, domain } = await checkDomainStatus();
    
    console.log(`[Check ${checkCount}] ${new Date().toLocaleTimeString()} - Domain active: ${active ? '✅ YES' : '❌ NO'}`);
    
    if (active) {
      console.log('\n🎉 Domain is now active! Email forwarding should work now.');
      console.log('\n📧 Test by sending an email to: hello@weatherb.app');
      return true;
    }

    // Wait 2 minutes between checks
    if (Date.now() - startTime < maxWaitMs) {
      console.log('   Waiting 2 minutes before next check...\n');
      await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000));
    }
  }

  console.log(`\n⏰ Timeout after ${maxWaitMinutes} minutes. Domain is still not active.`);
  console.log('\n💡 Troubleshooting:');
  console.log('   1. Check DNS records are correct: vercel dns ls weatherb.app');
  console.log('   2. Verify MX records: dig @8.8.8.8 MX weatherb.app');
  console.log('   3. Check ImprovMX dashboard: https://app.improvmx.com/domains');
  console.log('   4. DNS propagation can take up to 24 hours');
  
  return false;
}

waitForActive(30).catch(console.error);
