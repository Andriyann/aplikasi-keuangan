export const metadata = {
  title: "MyUang",
  description: "Keuangan pribadi, dari transaksi harian hingga portofolio.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
