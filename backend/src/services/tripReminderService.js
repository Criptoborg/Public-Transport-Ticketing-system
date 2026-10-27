const Ticket = require('../models/Ticket');
const { sendTripReminder } = require('./emailService');

let interval;
let running = false;

const runReminderJob = async () => {
  if (running) return 0;
  running = true;
  const now = new Date();
  const reminderHorizon = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const staleClaim = new Date(now.getTime() - 10 * 60 * 1000);
  let sentCount = 0;
  try {
    const candidates = await Ticket.find({
      status: 'active',
      paymentStatus: 'paid',
      reminderSentAt: { $exists: false },
      $or: [{ reminderClaimedAt: { $exists: false } }, { reminderClaimedAt: { $lte: staleClaim } }]
    })
      .select('_id')
      .populate({ path: 'trip', match: { departureTime: { $gt: now, $lte: reminderHorizon } }, select: 'departureTime route' })
      .limit(500);

    for (const candidate of candidates) {
      if (!candidate.trip) continue;
      const claimed = await Ticket.findOneAndUpdate(
        {
          _id: candidate._id,
          status: 'active',
          paymentStatus: 'paid',
          reminderSentAt: { $exists: false },
          $or: [{ reminderClaimedAt: { $exists: false } }, { reminderClaimedAt: { $lte: staleClaim } }]
        },
        { $set: { reminderClaimedAt: now } },
        { new: true }
      );
      if (!claimed) continue;

      try {
        const ticket = await Ticket.findById(claimed._id)
          .populate('user', 'name email')
          .populate({ path: 'trip', populate: { path: 'route', select: 'origin destination' } });
        if (!ticket?.user?.email) throw new Error('Ticket owner email is unavailable');
        await sendTripReminder(ticket.user, ticket);
        await Ticket.updateOne(
          { _id: claimed._id, reminderClaimedAt: now, reminderSentAt: { $exists: false } },
          { $set: { reminderSentAt: new Date() }, $unset: { reminderClaimedAt: 1 } }
        );
        sentCount += 1;
      } catch (error) {
        await Ticket.updateOne({ _id: claimed._id, reminderClaimedAt: now }, { $unset: { reminderClaimedAt: 1 } });
        console.warn('Trip reminder email failed');
      }
    }
  } finally {
    running = false;
  }
  return sentCount;
};

const startReminderJob = () => {
  if (interval) return;
  const configuredMinutes = Number(process.env.TRIP_REMINDER_INTERVAL_MINUTES || 1);
  const intervalMinutes = Number.isFinite(configuredMinutes) && configuredMinutes >= 1 ? configuredMinutes : 1;
  interval = setInterval(() => {
    runReminderJob().catch(() => console.error('Trip reminder job failed'));
  }, intervalMinutes * 60 * 1000);
  interval.unref?.();
  runReminderJob().catch(() => console.error('Trip reminder job failed'));
};

const stopReminderJob = () => {
  clearInterval(interval);
  interval = undefined;
};

module.exports = { runReminderJob, startReminderJob, stopReminderJob };
