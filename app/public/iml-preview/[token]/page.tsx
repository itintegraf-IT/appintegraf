import { PublicImlPreviewClient } from "./PublicImlPreviewClient";

export default async function PublicImlPreviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const token = (await params).token;
  return <PublicImlPreviewClient token={token} />;
}
