import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main-content" className="standalone">
      <span className="wordmark">
        flowdesk<span>•</span>
      </span>
      <h1>That page isn’t here.</h1>
      <p>Return to your workspace to continue.</p>
      <Link className="button" href="/">
        Open workspace
      </Link>
    </main>
  );
}
