const { z } = require('zod');

const updateScheduleSchema = z.object({
  intervalType: z.enum(['daily', 'weekly', 'custom', 'minutes', 'hours'], {
    errorMap: () => ({ message: 'Interval type must be daily, weekly, custom, minutes, or hours' }),
  }),
  customIntervalMinutes: z
    .number()
    .min(1, 'Custom interval must be at least 1 minute')
    .max(525600, 'Custom interval cannot exceed 525600 minutes (1 year)')
    .optional(),
  customIntervalDays: z
    .number()
    .min(1)
    .max(365)
    .optional(),
  customIntervalHours: z
    .number()
    .min(0.01)
    .max(8760)
    .optional(),
  gracePeriodMinutes: z
    .number()
    .min(1, 'Grace period must be at least 1 minute')
    .max(10080, 'Grace period cannot exceed 10080 minutes (7 days)')
    .optional(),
  gracePeriodHours: z
    .number()
    .min(0.01)
    .max(168)
    .optional(),
  reminderOffsetsHours: z
    .array(z.number())
    .max(4)
    .optional(),
});

module.exports = {
  updateScheduleSchema,
};

