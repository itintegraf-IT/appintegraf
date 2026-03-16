import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    username?: string;
    roleId?: number;
    departmentId?: number;
  }

  interface Session {
    user: User & {
      id: string;
      username?: string;
      roleId?: number;
      departmentId?: number;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    username?: string;
    roleId?: number;
    departmentId?: number;
  }
}
