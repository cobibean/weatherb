#!/usr/bin/env tsx
/**
 * Check ImprovMX domain status and DNS records
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

async function checkStatus() {
  console.log('🔍 Checking ImprovMX status for weatherb.app\n');

  try {
    // Get domain info
    const domain = await improvmxRequest<any>(`/domains/${DOMAIN}`);
    console.log('📧 Domain Status:');
    console.log(`   Domain: ${domain.domain || DOMAIN}`);
    console.log(`   Notification Email: ${domain.notification_email || 'N/A'}`);
    console.log(`   Whitelabel: ${domain.whitelabel || false}`);
    
    // Check verification status
    const domainData = domain.domain || domain;
    if (domain.verification !== undefined) {
      const verified = domain.verification?.verified || domain.verified;
      console.log(`   Verification Status: ${verified ? '✅ Verified' : '❌ Not Verified'}`);
      if (domain.verification?.code) {
        console.log(`   Verification Code: ${domain.verification.code}`);
      }
    } else {
      // Try alternative response format
      console.log(`   Verification Status: ${domain.verified ? '✅ Verified' : '❓ Unknown (check dashboard)'}`);
    }
    
    console.log('\n   Full domain object:', JSON.stringify(domain, null, 2));

    // Get aliases
    console.log('\n📬 Aliases:');
    const aliasesResponse = await improvmxRequest<any>(`/domains/${DOMAIN}/aliases`);
    const aliases = aliasesResponse.aliases || (Array.isArray(aliasesResponse) ? aliasesResponse : []);
    
    if (aliases.length === 0) {
      console.log('   No aliases found');
    } else {
      aliases.forEach((alias: any) => {
        console.log(`   - ${alias.alias}@${DOMAIN} → ${alias.forward || 'N/A'}`);
      });
    }

    // Check DNS records
    console.log('\n🌐 DNS Records Check:');
    const { execSync } = require('child_process');
    
    try {
      const mxRecords = execSync(`dig MX ${DOMAIN} +short`, { encoding: 'utf-8' }).trim();
      if (mxRecords) {
        console.log('   MX Records:');
        mxRecords.split('\n').forEach((record: string) => {
          if (record) console.log(`     ${record}`);
        });
      } else {
        console.log('   ⚠️  No MX records found (DNS may not have propagated yet)');
      }
    } catch (e) {
      console.log('   ⚠️  Could not check MX records');
    }

    try {
      const txtRecords = execSync(`dig TXT ${DOMAIN} +short | grep -i spf`, { encoding: 'utf-8' }).trim();
      if (txtRecords) {
        console.log('   TXT Record (SPF):');
        console.log(`     ${txtRecords}`);
      } else {
        console.log('   ⚠️  No SPF TXT record found');
      }
    } catch (e) {
      console.log('   ⚠️  Could not check TXT records');
    }

    console.log('\n💡 Tips:');
    console.log('   - DNS propagation can take 5-60 minutes');
    console.log('   - Try checking from different DNS servers: dig @8.8.8.8 MX weatherb.app');
    console.log('   - ImprovMX dashboard: https://app.improvmx.com/domains');
    
  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
  }
}

checkStatus().catch(console.error);
