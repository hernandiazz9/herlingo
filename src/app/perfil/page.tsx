import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/ComingSoon";
import { PageHeader } from "@/components/shell/PageHeader";
import { getTab } from "@/lib/navigation";

const tab = getTab("profile");

export const metadata: Metadata = { title: tab.title };

export default function ProfilePage() {
  return (
    <>
      <PageHeader title={tab.title} subtitle="Tu racha, tu experiencia y tus ajustes." />
      <ComingSoon>Aquí verás tus puntos de experiencia (XP), los días seguidos que llevas y los ajustes.</ComingSoon>
    </>
  );
}
