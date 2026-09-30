import type { Metadata } from "next";
import { Onboarding } from "@/components/path/Onboarding";

export const metadata: Metadata = { title: "Prueba de nivel" };

/** Placement test again (from /perfil). */
export default function PlacementPage() {
  return <Onboarding retake />;
}
