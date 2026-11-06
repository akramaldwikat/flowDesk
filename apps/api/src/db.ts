import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { createDatabase } from "@flowdesk/database";
import { config } from "./config";
@Injectable()
export class Database implements OnModuleDestroy, OnModuleInit {
  readonly client = createDatabase(config.DATABASE_URL);
  async onModuleInit() {
    await this.client.$connect();
  }
  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
