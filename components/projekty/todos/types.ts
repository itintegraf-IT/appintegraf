import type { PersonalTodo } from "@prisma/client";

/**
 * Sdílené tvary osobních úkolů. Dřív žily v PersonalTodoView, který zanikl
 * sloučením do stránky „Moje práce" — typy ale používá archiv i promote modal.
 */

export type ArchivedTodo = PersonalTodo & {
  promotedToCard:
    | {
        id: string;
        number: string;
        title: string;
        list: { board: { id: string; name: string } };
      }
    | null;
};

/** Board + jeho sloupce pro výběr cíle při povýšení úkolu na kartu. */
export type BoardLite = {
  id: string;
  name: string;
  lists: { id: string; name: string; position: number }[];
};
