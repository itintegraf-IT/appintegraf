import { PublicSoftproofClient } from "./PublicSoftproofClient";

export default async function PublicSoftproofPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const token = (await params).token;
  return <PublicSoftproofClient token={token} />;
}
