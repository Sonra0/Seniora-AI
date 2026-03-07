import Navbar from "@/components/Navbar";

export default function ElderlyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
