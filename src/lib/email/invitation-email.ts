import "server-only";
import nodemailer from "nodemailer";

export async function sendInvitationEmail(input: {
  email: string;
  companyName: string;
  inviterName: string;
  token: string;
}) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  if (!host || !Number.isInteger(port)) {
    throw new Error("Invitation email delivery is not configured.");
  }
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");
  if (!siteUrl) throw new Error("The public application URL is not configured.");
  const acceptUrl = new URL("/invitations/accept", siteUrl);
  const isLocalOrigin = ["localhost", "127.0.0.1"].includes(acceptUrl.hostname);
  if (process.env.NODE_ENV === "production" && !isLocalOrigin && acceptUrl.protocol !== "https:") {
    throw new Error("The hosted application URL must use HTTPS.");
  }
  acceptUrl.searchParams.set("token", input.token);
  const transport = nodemailer.createTransport({ host, port, secure: false });
  await transport.sendMail({
    from: "LeadPilot AI <no-reply@leadpilot.local>",
    to: input.email,
    subject: `Join ${input.companyName} on LeadPilot AI`,
    text: `${input.inviterName} invited you to ${input.companyName}. Accept this single-use invitation: ${acceptUrl}`,
    html: `<p><strong>${escapeHtml(input.inviterName)}</strong> invited you to <strong>${escapeHtml(input.companyName)}</strong>.</p><p><a href="${acceptUrl.toString()}">Accept invitation</a></p><p>This link expires in 72 hours and can only be used once.</p>`,
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
}
