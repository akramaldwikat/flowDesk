import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
export * from "@prisma/client";
export * from "./demo-policy";
export function createDatabase(url: string, max = 3) {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: url,
      max,
      connectionTimeoutMillis: 60000,
      idleTimeoutMillis: 10000,
      allowExitOnIdle: true,
    }),
  });
}
