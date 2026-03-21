import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL as string);

redis.on("error", (err) => console.error("Redis error:", err));
redis.on("connect", () => console.log("Redis connected"));

export default redis;