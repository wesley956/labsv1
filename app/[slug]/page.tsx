import { PublicBooking } from "@/components/public-booking";
import "./public-booking.css";

export default async function PublicBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicBooking slug={slug} />;
}
