import { differenceInMonths } from 'date-fns';

export function calculateUpdatedValue(originalValue: number, dueDate: Date): number {
  const now = new Date();
  if (dueDate > now) {
    return originalValue; // Not overdue yet
  }
  
  // Basic calculation: 1% per month simple interest for the MVP
  const monthsOverdue = differenceInMonths(now, dueDate);
  if (monthsOverdue <= 0) return originalValue;

  const interestRate = 0.01; // 1% per month
  const interest = originalValue * interestRate * monthsOverdue;
  
  return originalValue + interest;
}
