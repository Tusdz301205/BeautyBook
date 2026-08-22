const mode = process.argv[2] ?? "demo";
if (!(["small", "demo", "realistic"] as const).includes(mode as "small" | "demo" | "realistic")) {
  throw new Error(`Seed mode không hợp lệ: ${mode}. Dùng small, demo hoặc realistic.`);
}
process.env.SEED_SIZE = mode;
async function run() {
  await import("./seed.js");
}
void run();
