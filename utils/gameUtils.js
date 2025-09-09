// Example: crash multiplier random generator
const generateCrashMultiplier = () => {
  // Random between 1.0x and 10.0x for demo
  return Math.random() * 9 + 1;
};

module.exports = { generateCrashMultiplier };
