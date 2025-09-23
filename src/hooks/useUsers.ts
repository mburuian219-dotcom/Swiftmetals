import { useEffect, useState } from "react";

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all users
  const getUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data: User[] = await res.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Add new user
  const addUser = async (user: Omit<User, "id">) => {
    try {
      setLoading(true);
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      });
      if (!res.ok) throw new Error("Failed to add user");
      const newUser: User = await res.json();
      setUsers((prev) => [...prev, newUser]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Update existing user
  const updateUser = async (id: number, updated: Partial<Omit<User, "id">>) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error("Failed to update user");
      const updatedUser: User = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === id ? updatedUser : u)));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete user
  const deleteUser = async (id: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete user");
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getUsers();
  }, []);

  return {
    users,
    loading,
    error,
    refetch: getUsers,
    addUser,
    updateUser,
    deleteUser,
  };
};
