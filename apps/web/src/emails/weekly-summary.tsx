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

export interface WeeklySummaryData {
  // Date range
  startDate: string;
  endDate: string;

  // Overall metrics
  totalMarkets: number;
  totalVolume: string; // in FLR
  totalPayouts: string; // in FLR
  uniqueBettors: number;
  averageVolume: string; // in FLR

  // Top performing cities
  topCities: Array<{
    name: string;
    markets: number;
    volume: string; // in FLR
  }>;

  // Approved cities this week
  approvedCities: Array<{
    name: string;
    approvedDate: string;
  }>;

  // AI insights (placeholder for Task 11)
  aiInsights?: string;

  // Market highlights
  marketHighlights: Array<{
    city: string;
    date: string;
    threshold: number; // in tenths
    actual: number; // in tenths
    volume: string; // in FLR
    outcome: 'YES' | 'NO';
  }>;

  // Links
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

const subheading = {
  fontSize: '20px',
  lineHeight: '1.3',
  fontWeight: '600',
  color: '#333',
  marginBottom: '16px',
  marginTop: '32px',
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

const metricCard = {
  backgroundColor: '#f9fafb',
  padding: '16px',
  borderRadius: '8px',
  textAlign: 'center' as const,
  marginBottom: '12px',
};

const metricValue = {
  fontSize: '28px',
  fontWeight: '700',
  color: '#1a1a1a',
  marginBottom: '4px',
};

const metricLabel = {
  fontSize: '14px',
  color: '#666',
};

const table = {
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

const button = {
  backgroundColor: '#2563eb',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px 20px',
};

const link = {
  color: '#2563eb',
  textDecoration: 'underline',
};

const insightBox = {
  backgroundColor: '#f0f9ff',
  border: '1px solid #bfdbfe',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '24px',
};

const badge = {
  backgroundColor: '#e0f2fe',
  color: '#0369a1',
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: '600',
  display: 'inline-block',
};

export function WeeklySummaryEmail(data: WeeklySummaryData) {
  const formatTemp = (tenths: number) => `${(tenths / 10).toFixed(1)}°F`;

  return (
    <Html>
      <Head />
      <Preview>Weekly insights for {data.startDate} - {data.endDate}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>
            WeatherB Weekly Insights
          </Heading>

          <Text style={paragraph}>
            <strong>{data.startDate} - {data.endDate}</strong>
          </Text>

          {/* Key Metrics */}
          <Section>
            <Row>
              <Column>
                <div style={metricCard}>
                  <Text style={metricValue}>{data.totalMarkets}</Text>
                  <Text style={metricLabel}>Total Markets</Text>
                </div>
              </Column>
              <Column>
                <div style={metricCard}>
                  <Text style={metricValue}>{data.totalVolume}</Text>
                  <Text style={metricLabel}>Total Volume (FLR)</Text>
                </div>
              </Column>
            </Row>
            <Row>
              <Column>
                <div style={metricCard}>
                  <Text style={metricValue}>{data.uniqueBettors}</Text>
                  <Text style={metricLabel}>Unique Bettors</Text>
                </div>
              </Column>
              <Column>
                <div style={metricCard}>
                  <Text style={metricValue}>{data.averageVolume}</Text>
                  <Text style={metricLabel}>Avg Volume (FLR)</Text>
                </div>
              </Column>
            </Row>
          </Section>

          {/* AI Insights (if available) */}
          {data.aiInsights && (
            <>
              <Heading style={subheading}>🤖 AI Insights</Heading>
              <Section style={insightBox}>
                <Text style={paragraph}>{data.aiInsights}</Text>
              </Section>
            </>
          )}

          {/* Top Performing Cities */}
          {data.topCities && data.topCities.length > 0 && (
            <>
              <Heading style={subheading}>Top Performing Cities</Heading>
              <Section style={section}>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={tableHeader}>City</th>
                      <th style={tableHeader}>Markets</th>
                      <th style={tableHeader}>Volume (FLR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topCities.map((city, i) => (
                      <tr key={i}>
                        <td style={tableCell}>
                          <strong>{city.name}</strong>
                        </td>
                        <td style={tableCell}>{city.markets}</td>
                        <td style={tableCell}>{city.volume}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            </>
          )}

          {/* Market Highlights */}
          {data.marketHighlights && data.marketHighlights.length > 0 && (
            <>
              <Heading style={subheading}>Notable Markets</Heading>
              <Section style={section}>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={tableHeader}>City</th>
                      <th style={tableHeader}>Date</th>
                      <th style={tableHeader}>Threshold</th>
                      <th style={tableHeader}>Actual</th>
                      <th style={tableHeader}>Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.marketHighlights.map((market, i) => (
                      <tr key={i}>
                        <td style={tableCell}>{market.city}</td>
                        <td style={tableCell}>{market.date}</td>
                        <td style={tableCell}>{formatTemp(market.threshold)}</td>
                        <td style={tableCell}>{formatTemp(market.actual)}</td>
                        <td style={tableCell}>{market.volume} FLR</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            </>
          )}

          {/* Newly Approved Cities */}
          {data.approvedCities && data.approvedCities.length > 0 && (
            <>
              <Heading style={subheading}>✨ Newly Approved Cities</Heading>
              <Section style={section}>
                {data.approvedCities.map((city, i) => (
                  <div key={i} style={{ marginBottom: '8px' }}>
                    <Text style={{ ...paragraph, marginBottom: '4px' }}>
                      <span style={badge}>NEW</span>{' '}
                      <strong>{city.name}</strong> - Approved {city.approvedDate}
                    </Text>
                  </div>
                ))}
              </Section>
            </>
          )}

          {/* Call to Action */}
          <Section style={{ marginTop: '32px', textAlign: 'center' }}>
            <Button href={data.dashboardUrl} style={button}>
              View Full Dashboard
            </Button>
          </Section>

          <Hr style={{ borderColor: '#e6e6e6', marginTop: '32px', marginBottom: '24px' }} />

          {/* Footer */}
          <Section>
            <Text style={{ ...paragraph, fontSize: '14px', textAlign: 'center', color: '#999' }}>
              You're receiving this because you're an admin of WeatherB.
              These insights are generated automatically every Monday.
            </Text>
            <Text style={{ ...paragraph, fontSize: '12px', textAlign: 'center', color: '#999' }}>
              <Link href={data.dashboardUrl} style={link}>
                Manage your preferences
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default WeeklySummaryEmail;