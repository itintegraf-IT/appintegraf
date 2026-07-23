import { redirect } from "next/navigation";

// Vstupní bod modulu Projekty — přesměruje na seznam nástěnek.
export default function ProjektyIndexPage() {
  redirect("/projekty/boards");
}
