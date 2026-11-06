import { FlowdeskApp } from "../../components/flowdesk-app";
export const dynamic = "force-dynamic";
export default function Page() {
  return <FlowdeskApp demoMode={process.env.APP_MODE === "demo"} />;
}
