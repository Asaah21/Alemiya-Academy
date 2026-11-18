// Business rules A4 and A5 from the build plan.
// Staff enter only "days absent" for the week; everything else is calculated.

export function daysPresent(schoolDays: number, daysAbsent: number): number {
  if (!Number.isInteger(schoolDays) || schoolDays < 0) {
    throw new Error('School days must be a whole number, zero or more')
  }
  if (!Number.isInteger(daysAbsent) || daysAbsent < 0) {
    throw new Error('Days absent must be a whole number, zero or more')
  }
  if (daysAbsent > schoolDays) {
    throw new Error('Days absent cannot be more than school days')
  }
  return schoolDays - daysAbsent
}
