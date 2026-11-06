import {
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from "@nestjs/common";
import { demoPolicy, type Prisma } from "@flowdesk/database";
import { config } from "./config";
export const isDemo = config.APP_MODE === "demo";
export async function demoLock(tx: Prisma.TransactionClient) {
  if (isDemo)
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${demoPolicy.lock},0))`;
}
export function demoForbidden() {
  if (isDemo)
    throw new ForbiddenException("This action is disabled in the shared demo.");
}
export async function demoSession(
  tx: Prisma.TransactionClient,
  identity: { userId: string; sessionId: string },
) {
  if (
    isDemo &&
    !(await tx.refreshSession.findFirst({
      where: {
        id: identity.sessionId,
        userId: identity.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    }))
  )
    throw new UnauthorizedException("The demo was reset. Sign in again.");
}
export async function demoBudget(tx: Prisma.TransactionClient, org: string) {
  const control = await tx.demoControl.findUnique({
    where: { id: demoPolicy.marker },
  });
  if (!control || control.organizationId !== org)
    throw new ForbiddenException("Demo is not provisioned.");
  const expired = Date.now() - control.windowStart.getTime() >= 3600000;
  if (!expired && control.mutations >= demoPolicy.mutationsPerHour)
    throw new HttpException(
      "Shared demo limit reached: 20 changes per hour. Try again later.",
      429,
    );
  await tx.demoControl.update({
    where: { id: control.id },
    data: {
      mutations: expired ? 1 : control.mutations + 1,
      ...(expired ? { windowStart: new Date() } : {}),
    },
  });
}
export async function demoRetention(tx: Prisma.TransactionClient, org: string) {
  await tx.auditEvent.deleteMany({
    where: {
      organizationId: org,
      createdAt: { lt: new Date(Date.now() - 7 * 86400000) },
    },
  });
  const excess = await tx.auditEvent.findMany({
    where: { organizationId: org },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: demoPolicy.auditEvents,
    select: { id: true },
  });
  if (excess.length)
    await tx.auditEvent.deleteMany({
      where: { id: { in: excess.map((x) => x.id) } },
    });
}
export async function demoSessionCapacity(tx: Prisma.TransactionClient) {
  if (!isDemo) return;
  await tx.refreshSession.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
  if ((await tx.refreshSession.count()) >= demoPolicy.sessionRows)
    throw new HttpException(
      "The shared demo session limit was reached. Try later or contact the owner.",
      429,
    );
}
