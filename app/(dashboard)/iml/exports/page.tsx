import { redirect } from "next/navigation";

/** Export je sloučený pod Import / Export. */
export default function ImlExportsRedirectPage() {
  redirect("/iml/imports#export");
}
