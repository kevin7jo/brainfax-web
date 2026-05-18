import nodemailer, { type Transporter } from 'nodemailer';

export const BFAX_HELP_FROM = 'bfax.help@brainfax.net';

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
};

export function readSmtpConfigFromEnv(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD?.trim();
  const portRaw = process.env.SMTP_PORT?.trim();

  if (!host || !user || !password) return null;

  const port = portRaw ? Number(portRaw) : 465;
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('SMTP_PORT must be a positive number.');
  }

  return { host, port, user, password };
}

let cachedTransport: Transporter | null = null;
let cachedKey: string | null = null;

export function getSmtpTransport(config: SmtpConfig): Transporter {
  const key = `${config.host}:${config.port}:${config.user}`;
  if (cachedTransport && cachedKey === key) return cachedTransport;

  cachedTransport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: true,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });
  cachedKey = key;

  return cachedTransport;
}
