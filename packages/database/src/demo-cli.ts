import { maintainDemo } from "./demo-maintenance";
const [action, confirmation] = process.argv.slice(2);
if (
  !["provision", "reset"].includes(action) ||
  confirmation !== "--confirm=flowdesk-demo-v1"
) {
  console.error("Usage: demo provision|reset --confirm=flowdesk-demo-v1");
  process.exitCode = 1;
} else {
  maintainDemo(
    process.env,
    action as "provision" | "reset",
    confirmation.slice("--confirm=".length),
  )
    .then((message) => console.log(message))
    .catch(() => {
      console.error(
        "Demo maintenance refused or failed. Check the dedicated target, marker, credentials and migrations. No credentials are logged.",
      );
      process.exitCode = 1;
    });
}
