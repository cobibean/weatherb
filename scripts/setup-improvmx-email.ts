#!/usr/bin/env tsx
/**
 * ImprovMX Email Forwarding Automation Script
 * 
 * This script automates the setup of ImprovMX email forwarding for weatherb.app
 * Since your domain uses Vercel DNS, ImprovMX is the perfect free solution!
 * 
 * It will:
 * 1. Add domain to ImprovMX (if not already added)
 * 2. Create email aliases that forward to your personal email
 * 3. Provide DNS records you need to add to Vercel
 * 
 * Requirements:
 * - ImprovMX account (free at https://improvmx.com)
 * - ImprovMX API key
 * - Access to Vercel DNS settings (to add MX records)
 * 
 * Usage:
 *   pnpm tsx scripts/setup-improvmx-email.ts
 * 
 * Environment variables needed:
 *   IMPROVMX_API_KEY - Your ImprovMX API key (get from https://improvmx.com/api)
 *   FORWARD_TO_EMAIL - Your personal email where all emails will forward
 */

import { config } from 'dotenv';

// Load environment variables
config({ path: '.env' });

const IMPROVMX_API_BASE = 'https://api.improvmx.com/v3';
const DOMAIN = 'weatherb.app';

interface ImprovMXResponse<T> {
  success?: boolean;
  code?: number;
  error?: string;
  data?: T;
}

interface Domain {
  domain: string;
  notification_email: string;
  whitelabel: boolean;
  dkim_public_key?: string;
  verification?: {
    verified: boolean;
    code?: string;
  };
}

interface Alias {
  alias: string;
  forward: string[];
  id?: number;
}

interface DNSRecord {
  type: string;
  host: string;
  value: string;
  priority?: number;
}

/**
 * Make authenticated request to ImprovMX API
 */
async function improvmxRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = process.env.IMPROVMX_API_KEY;
  if (!apiKey) {
    throw new Error('IMPROVMX_API_KEY environment variable is required');
  }

  // ImprovMX uses Basic Auth with username "api" and password as API key
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

  if (!response.ok || (data as ImprovMXResponse<T>).error) {
    const error = (data as ImprovMXResponse<T>).error || response.statusText;
    const errorDetails = JSON.stringify(data, null, 2);
    throw new Error(`ImprovMX API error: ${error}\nResponse: ${errorDetails}`);
  }

  return data as T;
}

/**
 * Add domain to ImprovMX
 */
async function addDomain(notificationEmail: string): Promise<Domain> {
  console.log(`📧 Adding domain ${DOMAIN} to ImprovMX...`);

  try {
    // First try to get the domain (in case it already exists)
    try {
      const existing = await improvmxRequest<Domain>(`/domains/${DOMAIN}`);
      console.log('ℹ️  Domain already exists in ImprovMX');
      return existing;
    } catch (getError) {
      // Domain doesn't exist, create it
      const domain = await improvmxRequest<Domain>(`/domains`, {
        method: 'POST',
        body: JSON.stringify({
          domain: DOMAIN,
        }),
      });

      console.log('✅ Domain added to ImprovMX');
      return domain as Domain;
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Get DNS records needed for ImprovMX
 * Note: ImprovMX API doesn't have a direct DNS endpoint, so we'll provide standard records
 */
async function getDNSRecords(): Promise<DNSRecord[]> {
  console.log('🔍 Getting DNS records needed for ImprovMX...');

  // Standard ImprovMX DNS records
  // These are the records you need to add to Vercel DNS
  const records: DNSRecord[] = [
    {
      type: 'MX',
      host: '@',
      value: 'mx1.improvmx.com',
      priority: 10,
    },
    {
      type: 'MX',
      host: '@',
      value: 'mx2.improvmx.com',
      priority: 20,
    },
    {
      type: 'TXT',
      host: '@',
      value: 'v=spf1 include:spf.improvmx.com ~all',
    },
  ];

  console.log('✅ DNS records prepared');
  return records;
}

/**
 * Create an email alias
 */
async function createAlias(alias: string, forwardTo: string[]): Promise<Alias> {
  console.log(`📬 Creating alias: ${alias}@${DOMAIN}...`);

  // ImprovMX API expects forward as a string (comma-separated) or single string
  const forwardString = forwardTo.join(',');

  try {
    const result = await improvmxRequest<any>(`/domains/${DOMAIN}/aliases`, {
      method: 'POST',
      body: JSON.stringify({
        alias,
        forward: forwardString,
      }),
    });

    // Response format: { success: true, alias: { ... } }
    const aliasData = result.alias || result;
    console.log(`✅ Alias created: ${alias}@${DOMAIN} → ${forwardString}`);
    return aliasData as Alias;
  } catch (error) {
    // Alias might already exist, try to get existing aliases and update
    if (error instanceof Error) {
      if (error.message.includes('already') || error.message.includes('409')) {
        console.log(`ℹ️  Alias ${alias} already exists, fetching existing aliases...`);
        // Get existing aliases to find the ID
        const aliasesResponse = await improvmxRequest<any>(`/domains/${DOMAIN}/aliases`);
        const aliases = aliasesResponse.aliases || aliasesResponse;
        const existing = Array.isArray(aliases) 
          ? aliases.find((a: any) => a.alias === alias)
          : null;
        
        if (existing && existing.id) {
          const result = await improvmxRequest<any>(
            `/domains/${DOMAIN}/aliases/${existing.id}`,
            {
              method: 'PUT',
              body: JSON.stringify({
                alias,
                forward: forwardString,
              }),
            }
          );
          const aliasData = result.alias || result;
          console.log(`✅ Alias updated: ${alias}@${DOMAIN} → ${forwardString}`);
          return aliasData as Alias;
        } else {
          console.log(`⚠️  Alias ${alias} exists but couldn't update. Skipping...`);
          return existing as Alias;
        }
      }
    }
    throw error;
  }
}

/**
 * Main setup function
 */
async function setupEmailForwarding() {
  console.log('🚀 Starting ImprovMX email forwarding setup for weatherb.app\n');

  const apiKey = process.env.IMPROVMX_API_KEY;
  const forwardToEmail = process.env.FORWARD_TO_EMAIL;

  if (!apiKey) {
    throw new Error('IMPROVMX_API_KEY environment variable is required');
  }
  if (!forwardToEmail) {
    throw new Error('FORWARD_TO_EMAIL environment variable is required (your personal email)');
  }

  try {
    // Step 1: Add domain to ImprovMX
    const domain = await addDomain(forwardToEmail);
    console.log('');

    // Step 2: Get DNS records needed
    const dnsRecords = await getDNSRecords();
    console.log('');

    // Step 3: Display DNS records that need to be added to Vercel
    console.log('📋 DNS Records to add to Vercel:\n');
    console.log('   Go to: Vercel Dashboard → Your Project → Settings → Domains → weatherb.app → DNS\n');
    
    dnsRecords.forEach(record => {
      if (record.type === 'MX') {
        console.log(`   MX Record:`);
        console.log(`     Name: @ (or leave blank for root domain)`);
        console.log(`     Value: ${record.value}`);
        console.log(`     Priority: ${record.priority || 10}`);
      } else if (record.type === 'TXT') {
        console.log(`   TXT Record:`);
        console.log(`     Name: ${record.host || '@'}`);
        console.log(`     Value: ${record.value}`);
      } else {
        console.log(`   ${record.type} Record:`);
        console.log(`     Name: ${record.host || '@'}`);
        console.log(`     Value: ${record.value}`);
      }
      console.log('');
    });

    console.log('⚠️  IMPORTANT: Add these DNS records to Vercel before creating aliases!\n');
    console.log('   After adding DNS records, wait 5-10 minutes for propagation, then run this script again.\n');

    // Check if domain is verified (if verification info exists)
    const domainData = domain as any;
    const isVerified = domainData.verification?.verified !== false;
    
    if (!isVerified && domainData.verification) {
      console.log('⏳ Domain verification pending...');
      console.log(`   Verification code: ${domainData.verification.code || 'Check ImprovMX dashboard'}`);
      console.log('   Add the TXT record above to verify domain ownership.');
      console.log('   You can still create aliases now - they will work once DNS is configured.\n');
    } else {
      console.log('✅ Domain is ready for email forwarding\n');
    }

    // Step 4: List existing aliases first
    console.log('📋 Checking existing aliases...');
    let existingAliases: any[] = [];
    try {
      const aliasesResponse = await improvmxRequest<any>(`/domains/${DOMAIN}/aliases`);
      existingAliases = aliasesResponse.aliases || (Array.isArray(aliasesResponse) ? aliasesResponse : []);
      console.log(`   Found ${existingAliases.length} existing alias(es)\n`);
    } catch (error) {
      console.log('   No existing aliases found\n');
    }

    // Step 5: Create email aliases
    const emailAddresses = [
      { alias: 'hello', forward: [forwardToEmail] },
      { alias: 'contact', forward: [forwardToEmail] },
      { alias: 'admin', forward: [forwardToEmail] },
      { alias: 'noreply', forward: [forwardToEmail] },
      { alias: 'support', forward: [forwardToEmail] },
    ];

    console.log('📧 Creating email aliases...\n');

    for (const { alias, forward } of emailAddresses) {
      const exists = existingAliases.some((a: any) => a.alias === alias);
      if (exists) {
        console.log(`ℹ️  Alias ${alias}@${DOMAIN} already exists, updating...`);
        const existing = existingAliases.find((a: any) => a.alias === alias);
        if (existing && existing.id) {
          try {
            await improvmxRequest<any>(
              `/domains/${DOMAIN}/aliases/${existing.id}`,
              {
                method: 'PUT',
                body: JSON.stringify({
                  alias,
                  forward: forward.join(','),
                }),
              }
            );
            console.log(`✅ Alias updated: ${alias}@${DOMAIN} → ${forward.join(', ')}`);
          } catch (error) {
            console.log(`⚠️  Could not update ${alias}, skipping...`);
          }
        }
      } else {
        await createAlias(alias, forward);
      }
    }

    // Step 6: Create catch-all alias (forwards everything else)
    console.log('\n📮 Creating catch-all alias...');
    const catchAllExists = existingAliases.some((a: any) => a.alias === '*');
    if (!catchAllExists) {
      await createAlias('*', [forwardToEmail]);
    } else {
      console.log('ℹ️  Catch-all alias already exists, updating...');
      const existing = existingAliases.find((a: any) => a.alias === '*');
      if (existing && existing.id) {
        try {
          await improvmxRequest<any>(
            `/domains/${DOMAIN}/aliases/${existing.id}`,
            {
              method: 'PUT',
              body: JSON.stringify({
                alias: '*',
                forward: forwardToEmail,
              }),
            }
          );
          console.log(`✅ Catch-all alias updated: *@${DOMAIN} → ${forwardToEmail}`);
        } catch (error) {
          console.log(`⚠️  Could not update catch-all alias`);
        }
      }
    }

    console.log('\n✨ Email forwarding setup complete!');
    console.log('\n📧 Email addresses configured:');
    emailAddresses.forEach(({ alias }) => console.log(`   - ${alias}@${DOMAIN}`));
    console.log(`   - *@${DOMAIN} (catch-all)`);
    console.log(`\n📬 All emails forward to: ${forwardToEmail}`);
    console.log('\n⏳ Note: After adding DNS records, it may take 5-10 minutes for emails to start working!');
    
  } catch (error) {
    console.error('\n❌ Error setting up email forwarding:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      if (error.message.includes('DNS')) {
        console.error('\n💡 Tip: Make sure you\'ve added the DNS records to Vercel first!');
      }
    }
    process.exit(1);
  }
}

// Run the setup
setupEmailForwarding().catch(console.error);
