import { GdprForm } from "./GdprForm";

export const dynamic = "force-dynamic";

export default function GdprPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">GDPR nástroje</h2>
        <p className="mt-1 text-sm text-gray-600">
          Export a mazání osobních dat. Pouze pro CRM administrátory. Všechny akce se logují do
          audit logu.
        </p>
      </div>
      <GdprForm />
    </div>
  );
}
