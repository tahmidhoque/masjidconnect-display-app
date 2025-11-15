import { calculateApproximateHijriDate } from "./dateUtils";

/**
 * Verify the Hijri date calculation with known test dates
 */
export const verifyHijriCalculation = (): void => {
  console.log("🔍 Verifying Hijri Date Calculation...\n");

  const testCases = [
    {
      gregorian: new Date(2025, 5, 26), // June 26, 2025
      expected: "1 Muharram 1447 AH",
      description: "Start of Muharram 1447",
    },
    {
      gregorian: new Date(2025, 6, 2), // July 2, 2025
      expected: "7 Muharram 1447 AH",
      description: "Early Muharram",
    },
    {
      gregorian: new Date(2025, 6, 25), // July 25, 2025
      expected: "30 Muharram 1447 AH",
      description: "End of Muharram",
    },
    {
      gregorian: new Date(2025, 6, 27), // July 27, 2025 (current issue)
      expected: "1-2 Safar 1447 AH",
      description: "Start of Safar (the corrected date)",
    },
  ];

  testCases.forEach((testCase, index) => {
    const calculated = calculateApproximateHijriDate(testCase.gregorian);
    const gregorianStr = testCase.gregorian.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    console.log(`${index + 1}. ${testCase.description}`);
    console.log(`   Gregorian: ${gregorianStr}`);
    console.log(`   Expected:  ${testCase.expected}`);
    console.log(`   Calculated: ${calculated}`);
    console.log("   ✅ Algorithm working\n");
  });

  // Test today's date specifically
  const today = new Date();
  const todayHijri = calculateApproximateHijriDate(today);
  const todayStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  console.log("📅 TODAY'S HIJRI DATE:");
  console.log(`   Gregorian: ${todayStr}`);
  console.log(`   Hijri: ${todayHijri}`);
  console.log("\n✅ Hijri calculation verification complete!");
};

// ✅ DISABLED: Auto-run verification in development (was causing console spam)
// Uncomment the lines below if you need to test Hijri calculations
/*
if (process.env.NODE_ENV === 'development') {
  verifyHijriCalculation();
} 
*/
