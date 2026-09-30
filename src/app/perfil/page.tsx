import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { getTab } from "@/lib/navigation";
import { ProfileView } from "./ProfileView";

const tab = getTab("profile");

export const metadata: Metadata = { title: tab.title };

export default function ProfilePage() {
  return (
    <>
      <PageHeader title={tab.title} subtitle="Tu racha, tu experiencia y tus ajustes." />
      <ProfileView />
    </>
  );
}
