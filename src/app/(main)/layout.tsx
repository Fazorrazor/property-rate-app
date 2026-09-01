import { BottomNavBar } from "@/components/ui/BottomNavBar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <BottomNavBar />
    </>
  );
}
