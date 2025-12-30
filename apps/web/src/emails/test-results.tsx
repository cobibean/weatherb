import * as React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Row,
  Column,
} from '@react-email/components';

export interface TestResultsData {
  // City information
  cityName: string;
  latitude: number;
  longitude: number;

  // Test run information
  testRunId: string;
  startedAt: string;
  completedAt: string;
  status: 'COMPLETED' | 'FAILED';

  // Market metrics
  marketsCreated: number;
  marketsSettled: number;

  // Temperature data (array for each market)
  temperatureData: Array<{
    time: string;
    threshold: number; // in tenths
    actual: number; // in tenths
    outcome: 'YES' | 'NO';
  }>;

  // Financial metrics
  totalVolume: string; // in FLR
  totalPayouts: string; // in FLR
  netGasCost: string; // in FLR

  // Verification
  payoutVerified: boolean;
  verificationDetails?: string;

  // Error information (if failed)
  errorMessage?: string;

  // Admin links
  approveUrl: string;
  denyUrl: string;
  dashboardUrl: string;
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const heading = {
  fontSize: '32px',
  lineHeight: '1.3',
  fontWeight: '700',
  color: '#1a1a1a',
  marginBottom: '24px',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#555',
  marginBottom: '16px',
};

const section = {
  padding: '24px',
  border: '1px solid #e6e6e6',
  borderRadius: '8px',
  marginBottom: '24px',
};

const metricsRow = {
  marginBottom: '12px',
};

const label = {
  fontSize: '14px',
  color: '#666',
  marginBottom: '4px',
};

const value = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#1a1a1a',
};

const button = {
  backgroundColor: '#10b981',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px 20px',
  margin: '0 8px',
};

const denyButton = {
  ...button,
  backgroundColor: '#ef4444',
};

const link = {
  color: '#2563eb',
  textDecoration: 'underline',
};

const temperatureTable = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  marginTop: '16px',
};

const tableHeader = {
  padding: '8px',
  borderBottom: '2px solid #e6e6e6',
  fontSize: '14px',
  fontWeight: '600',
  textAlign: 'left' as const,
  color: '#666',
};

const tableCell = {
  padding: '8px',
  borderBottom: '1px solid #f0f0f0',
  fontSize: '14px',
  color: '#555',
};

const successBadge = {
  backgroundColor: '#d1fae5',
  color: '#065f46',
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: '600',
};

const failureBadge = {
  ...successBadge,
  backgroundColor: '#fee2e2',
  color: '#991b1b',
};

export function TestResultsEmail(data: TestResultsData) {
  const formatTemp = (tenths: number) => `${(tenths / 10).toFixed(1)}°F`;
  const isSuccess = data.status === 'COMPLETED';

  return (
    <Html>
      <Head />
      <Preview>Test results for {data.cityName} are ready for review</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>
            WeatherB Test Results: {data.cityName}
          </Heading>

          {/* Status Badge */}
          <Section>
            <div style={isSuccess ? successBadge : failureBadge}>
              {isSuccess ? '✓ Test Completed Successfully' : '✗ Test Failed'}
            </div>
          </Section>

          {/* Summary */}
          <Section>
            <Text style={paragraph}>
              The automated test window for <strong>{data.cityName}</strong> ({data.latitude}, {data.longitude}) has completed.
              The test ran from {data.startedAt} to {data.completedAt}.
            </Text>
          </Section>

          {/* Key Metrics */}
          <Section style={section}>
            <Text style={{ ...value, marginBottom: '16px' }}>Test Metrics</Text>

            <Row style={metricsRow}>
              <Column>
                <Text style={label}>Markets Created</Text>
                <Text style={value}>{data.marketsCreated}</Text>
              </Column>
              <Column>
                <Text style={label}>Markets Settled</Text>
                <Text style={value}>{data.marketsSettled}</Text>
              </Column>
            </Row>

            <Row style={metricsRow}>
              <Column>
                <Text style={label}>Total Volume</Text>
                <Text style={value}>{data.totalVolume} FLR</Text>
              </Column>
              <Column>
                <Text style={label}>Total Payouts</Text>
                <Text style={value}>{data.totalPayouts} FLR</Text>
              </Column>
            </Row>

            <Row style={metricsRow}>
              <Column>
                <Text style={label}>Gas Costs</Text>
                <Text style={value}>{data.netGasCost} FLR</Text>
              </Column>
              <Column>
                <Text style={label}>Payout Verified</Text>
                <Text style={value}>{data.payoutVerified ? '✓ Yes' : '✗ No'}</Text>
              </Column>
            </Row>
          </Section>

          {/* Temperature Results */}
          {data.temperatureData && data.temperatureData.length > 0 && (
            <Section style={section}>
              <Text style={{ ...value, marginBottom: '16px' }}>Temperature Results</Text>

              <table style={temperatureTable}>
                <thead>
                  <tr>
                    <th style={tableHeader}>Time</th>
                    <th style={tableHeader}>Threshold</th>
                    <th style={tableHeader}>Actual</th>
                    <th style={tableHeader}>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {data.temperatureData.map((temp, i) => (
                    <tr key={i}>
                      <td style={tableCell}>{temp.time}</td>
                      <td style={tableCell}>{formatTemp(temp.threshold)}</td>
                      <td style={tableCell}>{formatTemp(temp.actual)}</td>
                      <td style={tableCell}>
                        <span style={temp.outcome === 'YES' ? successBadge : failureBadge}>
                          {temp.outcome}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* Verification Details */}
          {data.verificationDetails && (
            <Section style={section}>
              <Text style={{ ...value, marginBottom: '16px' }}>Verification Details</Text>
              <Text style={paragraph}>{data.verificationDetails}</Text>
            </Section>
          )}

          {/* Error Message (if failed) */}
          {data.errorMessage && (
            <Section style={{ ...section, backgroundColor: '#fef2f2', borderColor: '#fecaca' }}>
              <Text style={{ ...value, marginBottom: '16px', color: '#991b1b' }}>Error Details</Text>
              <Text style={{ ...paragraph, color: '#991b1b' }}>{data.errorMessage}</Text>
            </Section>
          )}

          {/* Action Buttons */}
          <Section style={{ marginTop: '32px' }}>
            <Text style={{ ...value, marginBottom: '16px' }}>Admin Actions</Text>
            <Text style={paragraph}>
              Based on the test results, you can approve or deny this city for production use:
            </Text>

            <Row>
              <Column align="center">
                <Button href={data.approveUrl} style={button}>
                  Approve City
                </Button>
              </Column>
              <Column align="center">
                <Button href={data.denyUrl} style={denyButton}>
                  Deny City
                </Button>
              </Column>
            </Row>
          </Section>

          <Hr style={{ borderColor: '#e6e6e6', marginTop: '32px', marginBottom: '24px' }} />

          {/* Footer */}
          <Section>
            <Text style={{ ...paragraph, fontSize: '14px', textAlign: 'center' }}>
              View full details in the{' '}
              <Link href={data.dashboardUrl} style={link}>
                Admin Dashboard
              </Link>
            </Text>
            <Text style={{ ...paragraph, fontSize: '12px', color: '#999', textAlign: 'center' }}>
              This is an automated message from WeatherB. Test markets are not visible to the public.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default TestResultsEmail;