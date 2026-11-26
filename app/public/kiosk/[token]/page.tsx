import { PublicKioskPlayer } from "./PublicKioskPlayer";

export default async function PublicKioskPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const token = (await params).token;
  return <PublicKioskPlayer token={token} />;
}
