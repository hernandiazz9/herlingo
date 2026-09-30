import type { Metadata } from "next";
import { Onboarding } from "@/components/path/Onboarding";

export const metadata: Metadata = { title: "Bienvenida" };

/** First launch: welcome + placement test. */
export default function WelcomePage() {
  return <Onboarding />;
}
