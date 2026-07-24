import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
  Utility function to merge Tailwind CSS classes with clsx
  @param inputs - Class values to merge
  @returns Merged class string
  @example
  // Basic usage
  cn('px-2 py-1', 'bg-blue-500') // => 'px-2 py-1 bg-blue-500'
 
  // With conditions
  cn('px-2', { 'bg-blue-500': true, 'bg-red-500': false })
  // => 'px-2 bg-blue-500'
 
  // With Tailwind conflicts resolution
  cn('px-2 py-1 p-3') // => 'p-3'
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
