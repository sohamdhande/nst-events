export interface ParsedAcademicSignal {
  prefix: string;
  admissionYear: number;
}

/**
 * Safely parses the ADYPU institutional email convention to extract the academic signal.
 * Convention: [prefix][admission_year][unique_identifier]@adypu.edu.in
 * Example: e25b070564@adypu.edu.in -> prefix: "e", admissionYear: 2025
 * 
 * Must be strict. Rejects arbitrary formats, invalid domains, and ambiguous patterns.
 */
export function parseAdypuEmail(email: string): ParsedAcademicSignal | null {
  if (!email || typeof email !== 'string') return null;

  const normalizedEmail = email.trim().toLowerCase();

  // Strict regex for the documented ADYPU format.
  // 1. Exactly ONE lowercase alphabetical character for the program prefix (e.g., 'e', 'm').
  // 2. Exactly two digits for the cohort year (e.g., '25').
  // 3. One or more alphanumeric characters for the institutional identifier.
  // 4. Must end exactly with @adypu.edu.in
  const adypuRegex = /^([a-z])(\d{2})[a-z0-9]+@adypu\.edu\.in$/;

  const match = normalizedEmail.match(adypuRegex);
  if (!match) {
    return null;
  }

  const [, prefix, yearStr] = match;

  // For cohort years like '25' -> '2025', '26' -> '2026'
  const yearNum = parseInt(yearStr, 10);
  
  // Basic sanity check on year. Assuming 2000s.
  // You can adjust the baseline (e.g., 2000 + yearNum) based on actual institutional age.
  const admissionYear = 2000 + yearNum;

  return {
    prefix,
    admissionYear,
  };
}
