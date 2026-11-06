import { createApp } from "./app";
import { config } from "./config";
async function main() {
  const app = await createApp();
  await app.listen(config.API_PORT, config.API_BIND_HOST);
  console.log(
    `FlowDesk API listening on http://${config.API_BIND_HOST}:${config.API_PORT}`,
  );
}
main().catch(() => {
  console.error(
    "FlowDesk API could not start. Verify local configuration and database availability.",
  );
  process.exitCode = 1;
});
