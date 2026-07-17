import Link from "next/link";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link className="brand" href={href}>
      <span className="brand-mark">C</span>
      <span>cruz agenda</span>
    </Link>
  );
}
