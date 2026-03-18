import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { JOB_TYPES } from "@/lib/vyroba/config/fix-settings";
import GenerovaniForm from "./GenerovaniForm";

type Props = {
  params: Promise<{ job: string }>;
};

export default async function VyrobaGenerovaniPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  const canRead = await hasModuleAccess(userId, "vyroba", "read");
  const canWrite = await hasModuleAccess(userId, "vyroba", "write");

  if (!canRead) redirect("/");

  const { job } = await params;
  if (!JOB_TYPES.includes(job as (typeof JOB_TYPES)[number])) {
    redirect("/vyroba");
  }

  return <GenerovaniForm job={job} canWrite={canWrite} />;
}
