import { Resend } from 'resend';
import { render } from '@react-email/render';
import { TestResultsEmail, type TestResultsData } from '../emails/test-results';
import { WeeklySummaryEmail, type WeeklySummaryData } from '../emails/weekly-summary';

export type { TestResultsData, WeeklySummaryData };

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Email configuration from env
const EMAIL_FROM = process.env.EMAIL_FROM || 'WeatherB <noreply@weatherb.com>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email using Resend
 */
async function sendEmail(options: EmailOptions) {
  try {
    // Don't send emails if no API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.log('[Email] Skipping email send (no API key):', {
        to: options.to,
        subject: options.subject
      });
      return { success: true, mock: true };
    }

    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      ...(options.text !== undefined ? { text: options.text } : {}),
    });

    if (error) {
      console.error('[Email] Failed to send:', error);
      return { success: false, error };
    }

    console.log('[Email] Sent successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.error('[Email] Unexpected error:', error);
    return { success: false, error };
  }
}

/**
 * Send test results email to admin after test window completes
 */
export async function sendTestResultsEmail(data: TestResultsData) {
  try {
    // Render the email template
    const html = await render(TestResultsEmail(data));

    const subject = `WeatherB Test Results: ${data.cityName}`;

    // Send to admin email(s)
    const recipients = ADMIN_EMAIL.split(',').filter(Boolean);

    if (recipients.length === 0) {
      console.warn('[Email] No admin email configured, skipping test results email');
      return { success: false, error: 'No admin email configured' };
    }

    return await sendEmail({
      to: recipients,
      subject,
      html,
    });
  } catch (error) {
    console.error('[Email] Failed to send test results:', error);
    return { success: false, error };
  }
}

/**
 * Send weekly summary email to admin
 */
export async function sendWeeklySummaryEmail(data: WeeklySummaryData) {
  try {
    // Render the email template
    const html = await render(WeeklySummaryEmail(data));

    const dateRange = `${data.startDate} - ${data.endDate}`;
    const subject = `WeatherB Weekly Insights: ${dateRange}`;

    // Send to admin email(s)
    const recipients = ADMIN_EMAIL.split(',').filter(Boolean);

    if (recipients.length === 0) {
      console.warn('[Email] No admin email configured, skipping weekly summary email');
      return { success: false, error: 'No admin email configured' };
    }

    return await sendEmail({
      to: recipients,
      subject,
      html,
    });
  } catch (error) {
    console.error('[Email] Failed to send weekly summary:', error);
    return { success: false, error };
  }
}

/**
 * Format temperature for display (converts from tenths to decimal)
 */
export function formatTemperature(tenths: number): string {
  return `${(tenths / 10).toFixed(1)}°F`;
}

/**
 * Format FLR amount for display
 */
export function formatFLR(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${num.toFixed(2)} FLR`;
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}