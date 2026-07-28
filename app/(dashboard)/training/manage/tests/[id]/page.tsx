import { notFound } from "next/navigation";
import { TestEditClient } from "./TestEditClient";

export default async function ManageTestEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (id === "new") {
    return <TestEditClient testId={null} />;
  }

  const parsed = parseInt(id, 10);
  if (isNaN(parsed)) notFound();

  return <TestEditClient testId={parsed} />;
}
