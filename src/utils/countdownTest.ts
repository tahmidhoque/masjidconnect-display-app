/**
 * Countdown Test Utility
 * 
 * Provides testing functionality to verify countdown timers
 * work correctly without skipping seconds
 */

interface CountdownTestResult {
  totalTicks: number;
  skippedSeconds: number;
  averageInterval: number;
  accuracy: number;
  isAccurate: boolean;
}

/**
 * Test countdown accuracy by monitoring timer intervals
 */
export const testCountdownAccuracy = (
  durationSeconds: number = 60
): Promise<CountdownTestResult> => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const intervals: number[] = [];
    let lastTick = startTime;
    let tickCount = 0;
    let skippedCount = 0;

    const testTimer = setInterval(() => {
      const now = Date.now();
      const interval = now - lastTick;
      intervals.push(interval);
      
      // Check if this tick was significantly delayed (>1100ms = skipped second)
      if (interval > 1100) {
        skippedCount++;
        console.warn(`⚠️ Potential skipped second detected: ${interval}ms interval`);
      }
      
      lastTick = now;
      tickCount++;
      
      // Log every 10 seconds
      if (tickCount % 10 === 0) {
        console.log(`⏱️ Countdown test: ${tickCount} ticks completed`);
      }
      
      // End test after specified duration
      if (tickCount >= durationSeconds) {
        clearInterval(testTimer);
        
        const totalTime = now - startTime;
        const averageInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const accuracy = ((durationSeconds * 1000) / totalTime) * 100;
        
        const result: CountdownTestResult = {
          totalTicks: tickCount,
          skippedSeconds: skippedCount,
          averageInterval,
          accuracy,
          isAccurate: skippedCount === 0 && accuracy > 98,
        };
        
        console.log('📊 Countdown Test Results:', result);
        resolve(result);
      }
    }, 1000);
  });
};

/**
 * Test multiple concurrent timers for interference
 */
export const testTimerInterference = (
  timerCount: number = 3,
  durationSeconds: number = 30
): Promise<CountdownTestResult[]> => {
  console.log(`🔄 Testing ${timerCount} concurrent timers for ${durationSeconds} seconds...`);
  
  const promises: Promise<CountdownTestResult>[] = [];
  
  for (let i = 0; i < timerCount; i++) {
    const promise = new Promise<CountdownTestResult>((resolve) => {
      const startTime = Date.now();
      const intervals: number[] = [];
      let lastTick = startTime;
      let tickCount = 0;
      let skippedCount = 0;
      
      const testTimer = setInterval(() => {
        const now = Date.now();
        const interval = now - lastTick;
        intervals.push(interval);
        
        if (interval > 1100) {
          skippedCount++;
        }
        
        lastTick = now;
        tickCount++;
        
        if (tickCount >= durationSeconds) {
          clearInterval(testTimer);
          
          const totalTime = now - startTime;
          const averageInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          const accuracy = ((durationSeconds * 1000) / totalTime) * 100;
          
          resolve({
            totalTicks: tickCount,
            skippedSeconds: skippedCount,
            averageInterval,
            accuracy,
            isAccurate: skippedCount === 0 && accuracy > 98,
          });
        }
      }, 1000);
    });
    
    promises.push(promise);
  }
  
  return Promise.all(promises);
};

/**
 * Generate countdown test report
 */
export const generateCountdownReport = (results: CountdownTestResult[]): void => {
  console.group('📋 Countdown Test Report');
  
  const totalSkipped = results.reduce((sum, r) => sum + r.skippedSeconds, 0);
  const averageAccuracy = results.reduce((sum, r) => sum + r.accuracy, 0) / results.length;
  const allAccurate = results.every(r => r.isAccurate);
  
  console.log('🎯 Overall Results:');
  console.log(`   ✅ All timers accurate: ${allAccurate ? 'YES' : 'NO'}`);
  console.log(`   ⚡ Total skipped seconds: ${totalSkipped}`);
  console.log(`   📊 Average accuracy: ${averageAccuracy.toFixed(2)}%`);
  
  results.forEach((result, index) => {
    console.log(`\n🕐 Timer ${index + 1}:`);
    console.log(`   Ticks: ${result.totalTicks}`);
    console.log(`   Skipped: ${result.skippedSeconds}`);
    console.log(`   Avg interval: ${result.averageInterval.toFixed(2)}ms`);
    console.log(`   Accuracy: ${result.accuracy.toFixed(2)}%`);
    console.log(`   Status: ${result.isAccurate ? '✅ GOOD' : '❌ POOR'}`);
  });
  
  console.groupEnd();
};

/**
 * Run comprehensive countdown testing
 */
export const runCountdownTests = async (): Promise<void> => {
  console.log('🧪 Starting comprehensive countdown tests...\n');
  
  // Test 1: Single timer accuracy
  console.log('Test 1: Single timer accuracy (60 seconds)');
  const singleResult = await testCountdownAccuracy(60);
  
  // Test 2: Multiple timer interference
  console.log('\nTest 2: Multiple timer interference (3 timers, 30 seconds)');
  const multipleResults = await testTimerInterference(3, 30);
  
  // Test 3: High load scenario
  console.log('\nTest 3: High load scenario (5 timers, 20 seconds)');
  const highLoadResults = await testTimerInterference(5, 20);
  
  // Generate comprehensive report
  console.log('\n' + '='.repeat(50));
  generateCountdownReport([singleResult, ...multipleResults, ...highLoadResults]);
  console.log('='.repeat(50));
  
  console.log('\n✨ Countdown testing complete!');
};

// Auto-run tests in development mode
if (process.env.NODE_ENV === 'development') {
  // Add a delay to avoid interfering with app startup
  setTimeout(() => {
    console.log('🎯 Timer accuracy testing available!');
    console.log('💡 Run runCountdownTests() in console to test timer accuracy');
    console.log('💡 Run testClockAccuracy() to specifically test the main clock');
    
    // Make functions available globally for console testing
    (window as any).testCountdownAccuracy = testCountdownAccuracy;
    (window as any).testTimerInterference = testTimerInterference;
    (window as any).runCountdownTests = runCountdownTests;
    (window as any).testClockAccuracy = () => testCountdownAccuracy(120); // 2 minute test
  }, 5000);
} 