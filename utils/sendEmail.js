const nodemailer = require('nodemailer');

/**
 * Send a transactional email via Gmail.
 * @param {{ to: string, subject: string, text: string }} options
 * @returns {Promise<void>}  Resolves on success, rejects with transport error on failure.
 */
async function sendEmail({ to, subject, text }) {
  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transport.sendMail({
    from: process.env.GMAIL_USER,
    to,
    subject,
    text,
  });
}

module.exports = sendEmail;
