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
  subject: 'Welcome to Routely',
  text: `Hello ${user.name},\n\nYour Routely account has been created successfully.\n\nYou can now log in, browse available trips and book your ticket.\n\nThank you for travelling with Routely.`
});

const sendPasswordResetEmail = (user, resetUrl) => sendEmail({
  to: user.email,
  subject: 'Reset your Routely password',
  text: `Hello ${user.name},\n\nUse this link to reset your Routely password: ${resetUrl}\n\nThis link expires in 15 minutes. If you did not request a password reset, you can ignore this email.`
});

const sendBookingConfirmation = async (tickets, totalAmount) => {
  const firstTicket = tickets[0];
  if (!firstTicket?.user?.email) return;
  const route = firstTicket.trip?.route;
  const travelTime = firstTicket.trip?.departureTime
    ? new Date(firstTicket.trip.departureTime).toLocaleString()
    : 'as scheduled';
  const references = tickets.map((ticket) => ticket.ticketReference).join(', ');
  await sendEmail({
    to: firstTicket.user.email,
    subject: 'Your Routely tickets are confirmed',
    text: `Hello ${firstTicket.user.name},\n\nPayment is confirmed for ${route?.origin || 'your origin'} to ${route?.destination || 'your destination'} on ${travelTime}.\nTicket references: ${references}\nAmount paid: ₦${Number(totalAmount).toLocaleString()}.\n\nThank you for travelling with Routely.`
  });
};

const sendRefundNotification = (user, ticket) => sendEmail({
  to: user.email,
  subject: 'Routely refund initiated',
  text: `Hello ${user.name},\n\nA refund has been initiated for ticket ${ticket.ticketReference}, amount ₦${Number(ticket.amount).toLocaleString()}. Your bank or card provider may take additional time to post it.`
});

const sendTripReminder = (user, ticket) => {
  const origin = ticket.trip?.route?.origin || 'your origin';
  const destination = ticket.trip?.route?.destination || 'your destination';
  const departure = ticket.trip?.departureTime ? new Date(ticket.trip.departureTime).toLocaleString() : 'as scheduled';
  return sendEmail({
    to: user.email,
    subject: 'Your Routely trip is coming up',
    text: `Hello ${user.name},\n\nA reminder that your trip from ${origin} to ${destination} departs at ${departure}.\nTicket reference: ${ticket.ticketReference}\n\nWe look forward to seeing you on board.`
  });
};

const sendAccountDeletionConfirmation = (user) => sendEmail({
  to: user.email,
  subject: 'We received your Routely account deletion request',
  text: `Hello ${user.name},\n\nWe received your request to delete your Routely account. We are processing the request now; your personal account details will be anonymised and any refund that cannot be completed will be recorded for follow-up. If you did not request this, please use the support contact shown on the Routely website.`
});

module.exports = { sendWelcomeEmail, sendPasswordResetEmail, sendBookingConfirmation, sendRefundNotification, sendTripReminder, sendAccountDeletionConfirmation };