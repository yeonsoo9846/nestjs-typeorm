import Link from 'next/link';

export default function Home() {
  return (
    <ul>
      <li>
        <Link href="/">Home</Link>
      </li>
      <li>
        <Link href="/login">login</Link>
      </li>
      <li>
        <Link href="/join">join</Link>
      </li>
    </ul>
  );
}
