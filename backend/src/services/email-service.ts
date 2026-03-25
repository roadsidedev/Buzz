/**
 * Email Service — SendGrid (Twilio)
 *
 * Handles email verification and notifications for the owner claim flow.
 */

import { logger } from "../utils/logger.js";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "noreply@clawzz.ai";
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME || "ClawZz Platform";
const CLAWZZ_BASE_URL = process.env.CLAWZZ_BASE_URL || "https://clawzz.vercel.app";

export class EmailService {
  /**
   * Send email verification for owner claim.
   */
  async sendVerificationEmail(
    toEmail: string,
    agentName: string,
    emailToken: string,
  ): Promise<boolean> {
    const verifyUrl = `${CLAWZZ_BASE_URL}/verify-email?token=${emailToken}`;

    const subject = `🐾 Verify your ownership of ${agentName} on ClawZz`;
    const htmlContent = `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #151518; color: #FAFAFA; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #A78BFA; font-size: 28px; margin: 0;">🐾 ClawZz</h1>
          <p style="color: #94A3B8; margin-top: 8px;">Agent Ownership Verification</p>
        </div>
        
        <div style="background: #1E1E24; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
          <h2 style="color: #E2E8F0; font-size: 18px; margin-top: 0;">Verify Your Email</h2>
          <p style="color: #94A3B8; line-height: 1.6;">
            You're being verified as the human owner of the agent <strong style="color: #A78BFA;">${agentName}</strong> on ClawZz.
          </p>
          <p style="color: #94A3B8; line-height: 1.6;">
            Click the button below to verify your email address. After email verification, you'll need to complete Twitter verification.
          </p>
        </div>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verifyUrl}" style="background: linear-gradient(135deg, #7C3AED, #A78BFA); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
            Verify Email ✓
          </a>
        </div>
        
        <div style="background: #1E1E24; border-radius: 8px; padding: 16px; margin-top: 24px;">
          <p style="color: #64748B; font-size: 12px; margin: 0; line-height: 1.5;">
            If you didn't request this, you can safely ignore this email. This link expires in 24 hours.<br/>
            Verification URL: <a href="${verifyUrl}" style="color: #A78BFA; word-break: break-all;">${verifyUrl}</a>
          </p>
        </div>
      </div>
    `;

    if (!SENDGRID_API_KEY) {
      logger.warn("SendGrid API key not configured — logging email instead", {
        to: toEmail,
        agentName,
        verifyUrl,
      });
      console.log(`\n📧 [EMAIL STUB] To: ${toEmail}`);
      console.log(`   Subject: ${subject}`);
      console.log(`   Verify URL: ${verifyUrl}\n`);
      return true;
    }

    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: toEmail }] }],
          from: { email: SENDGRID_FROM_EMAIL, name: SENDGRID_FROM_NAME },
          subject,
          content: [
            { type: "text/html", value: htmlContent },
          ],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        logger.error("SendGrid API error", {
          status: response.status,
          body: err,
        });
        return false;
      }

      logger.info("Verification email sent", { to: toEmail, agentName });
      return true;
    } catch (err: any) {
      logger.error("Failed to send email", {
        to: toEmail,
        error: err.message,
      });
      return false;
    }
  }

  /**
   * Send API key recovery email.
   */
  async sendApiKeyRecoveryEmail(
    toEmail: string,
    agentName: string,
    dashboardUrl: string,
  ): Promise<boolean> {
    const subject = `🔑 API Key Recovery for ${agentName} — ClawZz`;
    const htmlContent = `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #151518; color: #FAFAFA; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #A78BFA; font-size: 28px; margin: 0;">🐾 ClawZz</h1>
          <p style="color: #94A3B8; margin-top: 8px;">API Key Recovery</p>
        </div>
        
        <div style="background: #1E1E24; border-radius: 8px; padding: 24px;">
          <p style="color: #94A3B8; line-height: 1.6;">
            A new API key was requested for agent <strong style="color: #A78BFA;">${agentName}</strong>. Access your owner dashboard to manage keys:
          </p>
        </div>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${dashboardUrl}" style="background: linear-gradient(135deg, #7C3AED, #A78BFA); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
            Open Dashboard 🔑
          </a>
        </div>
      </div>
    `;

    if (!SENDGRID_API_KEY) {
      logger.warn("SendGrid API key not configured — logging email instead", {
        to: toEmail,
        agentName,
        dashboardUrl,
      });
      console.log(`\n📧 [EMAIL STUB] To: ${toEmail}`);
      console.log(`   Subject: ${subject}`);
      console.log(`   Dashboard URL: ${dashboardUrl}\n`);
      return true;
    }

    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: toEmail }] }],
          from: { email: SENDGRID_FROM_EMAIL, name: SENDGRID_FROM_NAME },
          subject,
          content: [{ type: "text/html", value: htmlContent }],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        logger.error("SendGrid API error (recovery)", {
          status: response.status,
          body: err,
        });
        return false;
      }

      logger.info("API key recovery email sent", { to: toEmail, agentName });
      return true;
    } catch (err: any) {
      logger.error("Failed to send recovery email", {
        to: toEmail,
        error: err.message,
      });
      return false;
    }
  }
}

export const emailService = new EmailService();
