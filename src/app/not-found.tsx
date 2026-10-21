import Link from "next/link";
import { AuthLayout } from "@/layouts/AuthLayout";

export default function NotFound() {
  return (
    <AuthLayout title="Page not found" description="The link may be old, or the page may have moved.">
      <Link href="/" className="bl-btn bl-btn-primary bl-btn-touch bl-btn-block" style={{ textDecoration: "none" }}>
        Go to your dashboard
      </Link>
    </AuthLayout>
  );
}
