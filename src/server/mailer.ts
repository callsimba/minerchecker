import nodemailer from "nodemailer";

function must(v: string | undefined, name: string) {
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function getMailer() {
  const host = must(process.env.SMTP_HOST, "SMTP_HOST");
  const port = Number(must(process.env.SMTP_PORT, "SMTP_PORT"));
  const secure = String(process.env.SMTP_SECURE ?? "true") === "true";

  const user = must(process.env.SMTP_USER, "SMTP_USER");
  const pass = must(process.env.SMTP_PASS, "SMTP_PASS");

  return nodemailer.createTransport({
    host,
    port,
    secure, // true for 465
    auth: { user, pass },
  });
}
