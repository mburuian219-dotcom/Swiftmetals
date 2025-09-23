import { useEffect, useState } from 'react';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export const useCustomers = (useMock: boolean = false) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mockData: Customer[] = [
    { id: '1', name: 'Jane Doe', email: 'jane@example.com', phone: '0712345678' },
    { id: '2', name: 'John Smith', email: 'john@example.com', phone: '0723456789' },
  ];

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      if (useMock) {
        // fallback when backend is down
        await new Promise(r => setTimeout(r, 500));
        setCustomers(mockData);
      } else {
        const res = await fetch('/api/customers');
        if (!res.ok) throw new Error('Failed to fetch customers');
        const data = await res.json();
        setCustomers(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  return { customers, loading, error, refetch: fetchCustomers };
};
