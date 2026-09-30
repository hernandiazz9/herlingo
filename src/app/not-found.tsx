import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <PageHeader title="Aquí no hay nada" subtitle="Esta página no existe." />
      <Card>
        <Link href="/" className="font-bold text-sea underline underline-offset-4">
          Volver a tu ruta
        </Link>
      </Card>
    </>
  );
}
