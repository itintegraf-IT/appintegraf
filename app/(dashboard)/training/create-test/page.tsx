import { redirect } from "next/navigation";

/** Původní stránka vytvoření testu – nahrazena administrací modulu. */
export default function CreateTestPage() {
  redirect("/training/manage/tests/new");
}
