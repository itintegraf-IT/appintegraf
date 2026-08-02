import { redirect } from "next/navigation";

// Sloučeno do /projekty/moje-prace (vlna 5A). Route zůstává kvůli záložkám
// a starším odkazům — nesmí skončit 404.
export default function MyCardsPage() {
  redirect("/projekty/moje-prace");
}
