const { Resend } = require('resend');

const sendEmail = async ({ to, subject, text }) => {
  if (!process.env.RESEND_API_KEY) throw new Error('Email service is not configured');

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
    to,
    subject,
    text
  });
  if (error) throw new Error('Email provider rejected the message');
};

const sendWelcomeEmail = (user) => sendEmail({
  to: user.email,
  subject: 'Welcome to Public Transport Ticketing System',
  text: `Hello ${user.name},\n\nYour account has been created successfully.\n\nYou can now log in, browse available trips and book your ticket.\n\nThank you for using Public Transport Ticketing System.`
});

const sendPasswordResetEmail = (user, resetUrl) => sendEmail({
  to: user.email,
  subject: 'Reset your Public Transport Ticketing System password',
  text: `Hello ${user.name},\n\nUse this link to reset your password: ${resetUrl}\n\nThis link expires in 15 minutes. If you did not request a password reset, you can ignore this email.`
});

module.exports = { sendWelcomeEmail, sendPasswordResetEmail };