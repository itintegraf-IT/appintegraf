import { PublicItVendorForm } from "./PublicItVendorForm";

type Props = { params: Promise<{ token: string }> };

export default async function PublicItVendorRequestPage({ params }: Props) {
  const { token } = await params;
  return <PublicItVendorForm token={token} />;
}
