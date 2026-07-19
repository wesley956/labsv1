import { notFound } from "next/navigation";
import { PublicBooking } from "@/components/public-booking";
import { createClient } from "@/lib/supabase/server";
import "./public-booking.css";

export default async function PublicBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !business) notFound();

  return <PublicBooking slug={business.slug} />;
}
