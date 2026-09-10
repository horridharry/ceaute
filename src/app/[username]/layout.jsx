import { BookingNav } from "./components/BookingNav";
export default async function UsernameLayout({
  params: { username },
  children,
}) {
  const decodedUsername = decodeURIComponent(username).slice(1);

  return (
    <>
      <BookingNav username={decodedUsername} />
      <div>{children}</div>
    </>
  );
}
