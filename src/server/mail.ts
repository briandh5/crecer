import nodemailer, { type Transporter } from "nodemailer";

/**
 * Envío de correo por SMTP (Gmail con contraseña de aplicación, Brevo, Resend, el que prefieras).
 * Variables: SMTP_HOST, SMTP_PORT (465 por defecto), SMTP_USER, SMTP_PASS, MAIL_FROM (opcional), SMTP_SECURE (opcional).
 */
export const isMailConfigured = () => !!process.env.SMTP_HOST;

const g = globalThis as unknown as { __crecerMail?: Transporter };

function transport(): Transporter {
  if (!g.__crecerMail) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465;
    g.__crecerMail = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return g.__crecerMail;
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendMail(mail: Mail): Promise<void> {
  const from = process.env.MAIL_FROM ?? (process.env.SMTP_USER ? `Crecer <${process.env.SMTP_USER}>` : "Crecer <no-responder@crecer.app>");
  await transport().sendMail({ from, ...mail });
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Correo de «restablecer contraseña». */
export function resetEmail(opts: { to: string; username: string; link: string; minutes: number }): Mail {
  const { to, username, link, minutes } = opts;
  const text = [
    `Hola @${username},`,
    "",
    "Recibimos una solicitud para restablecer la contraseña de tu cuenta de Crecer.",
    `Abre este enlace para elegir una nueva (vale ${minutes} minutos y solo se puede usar una vez):`,
    "",
    link,
    "",
    "Si no la pediste tú, ignora este mensaje: tu contraseña actual sigue funcionando.",
  ].join("\n");
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#FDFBF7;font-family:Arial,Helvetica,sans-serif;color:#26301F">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
  <p style="font-size:24px;font-weight:bold;color:#2D5A27;margin:0 0 24px">Crecer</p>
  <p style="font-size:16px;line-height:1.5">Hola <strong>@${esc(username)}</strong>,</p>
  <p style="font-size:16px;line-height:1.5">Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
  <p style="margin:28px 0"><a href="${esc(link)}" style="background:#2D5A27;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 24px;border-radius:14px;display:inline-block">Elegir una contraseña nueva</a></p>
  <p style="font-size:14px;line-height:1.5;color:#4C5A43">El enlace vale ${minutes} minutos y solo se puede usar una vez. Si el botón no funciona, copia esta dirección en tu navegador:<br><span style="word-break:break-all">${esc(link)}</span></p>
  <p style="font-size:14px;line-height:1.5;color:#4C5A43">Si no la pediste tú, ignora este mensaje: tu contraseña actual sigue funcionando.</p>
</div></body></html>`;
  return { to, subject: "Restablece tu contraseña de Crecer", text, html };
}
