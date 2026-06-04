"use client";

import { NewMaketyWorkForm } from "../NewMaketyWorkForm";

type UserOpt = {
  id: number;
  first_name: string;
  last_name: string;
};

type Props = {
  vyrobaUsers: UserOpt[];
};

export function NewMaketaForm({ vyrobaUsers }: Props) {
  return <NewMaketyWorkForm workType="maketa" assigneeUsers={vyrobaUsers} />;
}
