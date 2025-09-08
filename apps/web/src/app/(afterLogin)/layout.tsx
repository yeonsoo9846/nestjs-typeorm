import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import React from 'react';

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  if (!cookieStore.get('accessToken')?.value) {
    redirect('/login');
  }
  return <>{children}</>;
}
