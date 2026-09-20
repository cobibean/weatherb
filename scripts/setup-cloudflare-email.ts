#!/usr/bin/env tsx
/**
 * Cloudflare Email Routing Automation Script
 * 
 * This script automates the setup of Cloudflare Email Routing for weatherb.app
 * It will:
 * 1. Enable Email Routing for the domain
 * 2. Create destination addresses (where emails forward to)
 * 3. Create routing rules (catch-all and specific addresses)
 * 
 * Requirements:
 * - Cloudflare API token with Email Routing permissions
 * - Zone ID for weatherb.app
 * - Account ID for your Cloudflare account
 * 
 * Usage:
 *   npm exec -- tsx scripts/setup-cloudflare-email.ts
 * 
 * Environment variables needed:
 *   CLOUDFLARE_API_TOKEN - Your Cloudflare API token
 *   CLOUDFLARE_ZONE_ID - Zone ID for weatherb.app
 *   CLOUDFLARE_ACCOUNT_ID - Your Cloudflare account ID
 *   FORWARD_TO_EMAIL - Your personal email where all emails will forward
 */

import { config } from 'dotenv';

// Load environment variables
config({ path: '.env' });

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

interface CloudflareResponse<T> {
  success: boolean;
  result: T;
  errors?: Array<{ code: number; message: string }>;
}

interface EmailRoutingDNS {
  name: string;
  type: string;
  ttl: number;
  content: string;
}

interface DestinationAddress {
  tag: string;
  email: string;
  verified: string;
  created: string;
  modified: string;
}

interface RoutingRule {
  tag: string;
  name: string;
  enabled: boolean;
  matchers: Array<{
    type: string;
    field: string;
    value: string;
  }>;
  actions: Array<{
    type: string;
    value: string[];
  }>;
}

/**
 * Make authenticated request to Cloudflare API
 */
async function cloudflareRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<CloudflareResponse<T>> {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!apiToken) {
    throw new Error('CLOUDFLARE_API_TOKEN environment variable is required');
  }

  const response = await fetch(`${CLOUDFLARE_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(
      `Cloudflare API error: ${data.errors?.map(e => e.message).join(', ') || 'Unknown error'}`
    );
  }

  return data;
}

/**
 * Enable Email Routing DNS records for the zone
 */
async function enableEmailRoutingDNS(zoneId: string): Promise<EmailRoutingDNS[]> {
  console.log('📧 Enabling Email Routing DNS records...');
  
  const response = await cloudflareRequest<EmailRoutingDNS[]>(
    `/zones/${zoneId}/email/routing/dns`,
    { method: 'POST' }
  );

  console.log('✅ Email Routing DNS enabled');
  console.log('   Records created:', response.result.map(r => `${r.type} ${r.name}`).join(', '));
  
  return response.result;
}

/**
 * Create a destination address (where emails forward to)
 */
async function createDestinationAddress(
  accountId: string,
  email: string
): Promise<DestinationAddress> {
  console.log(`📬 Creating destination address: ${email}...`);

  const response = await cloudflareRequest<DestinationAddress>(
    `/accounts/${accountId}/email/routing/addresses`,
    {
      method: 'POST',
      body: JSON.stringify({ email }),
    }
  );

  console.log(`✅ Destination address created: ${response.result.email}`);
  console.log(`   Tag: ${response.result.tag}`);
  
  return response.result;
}

/**
 * Create a routing rule
 */
async function createRoutingRule(
  zoneId: string,
  ruleName: string,
  matchers: Array<{ type: string; field: string; value: string }>,
  destinationTag: string
): Promise<RoutingRule> {
  console.log(`🔀 Creating routing rule: ${ruleName}...`);

  const response = await cloudflareRequest<RoutingRule>(
    `/zones/${zoneId}/email/routing/rules`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: ruleName,
        enabled: true,
        matchers,
        actions: [
          {
            type: 'forward',
            value: [destinationTag],
          },
        ],
      }),
    }
  );

  console.log(`✅ Routing rule created: ${response.result.name}`);
  
  return response.result;
}

/**
 * Main setup function
 */
async function setupEmailRouting() {
  console.log('🚀 Starting Cloudflare Email Routing setup for weatherb.app\n');

  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const forwardToEmail = process.env.FORWARD_TO_EMAIL;

  if (!zoneId) {
    throw new Error('CLOUDFLARE_ZONE_ID environment variable is required');
  }
  if (!accountId) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID environment variable is required');
  }
  if (!forwardToEmail) {
    throw new Error('FORWARD_TO_EMAIL environment variable is required (your personal email)');
  }

  try {
    // Step 1: Enable Email Routing DNS
    await enableEmailRoutingDNS(zoneId);
    console.log('');

    // Step 2: Create destination address (where emails forward to)
    const destination = await createDestinationAddress(accountId, forwardToEmail);
    console.log('');

    // Step 3: Create routing rules for specific addresses
    const emailAddresses = [
      'hello@weatherb.app',
      'contact@weatherb.app',
      'admin@weatherb.app',
      'noreply@weatherb.app',
      'support@weatherb.app',
    ];

    console.log('📋 Creating routing rules for specific addresses...\n');
    
    for (const address of emailAddresses) {
      const localPart = address.split('@')[0];
      
      await createRoutingRule(
        zoneId,
        `Forward ${address}`,
        [
          {
            type: 'literal',
            field: 'to',
            value: address,
          },
        ],
        destination.tag
      );
    }

    console.log('');

    // Step 4: Create catch-all rule (optional - forwards everything else)
    console.log('📮 Creating catch-all rule...');
    await createRoutingRule(
      zoneId,
      'Catch-all forward',
      [
        {
          type: 'literal',
          field: 'to',
          value: '*@weatherb.app',
        },
      ],
      destination.tag
    );

    console.log('\n✨ Email Routing setup complete!');
    console.log('\n📧 Email addresses configured:');
    emailAddresses.forEach(addr => console.log(`   - ${addr}`));
    console.log(`\n📬 All emails forward to: ${forwardToEmail}`);
    console.log('\n⏳ Note: DNS propagation may take a few minutes. Emails should start working soon!');
    
  } catch (error) {
    console.error('\n❌ Error setting up Email Routing:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    process.exit(1);
  }
}

// Run the setup
setupEmailRouting().catch(console.error);
