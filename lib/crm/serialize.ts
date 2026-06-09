import { crmUserDisplayName } from "./users";

export type CrmClientUser = {
  id: number;
  name: string;
  email: string;
  image: string | null;
};

export function toClientUser(u: {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}): CrmClientUser {
  return {
    id: u.id,
    name: crmUserDisplayName(u),
    email: u.email ?? "",
    image: null,
  };
}

export function mapOwnerForClient(
  owner: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  } | null
): CrmClientUser | null {
  if (!owner) return null;
  return toClientUser(owner);
}
