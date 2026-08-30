import GlobalStats from "@/components/coin/GlobalStats";
import NavBar from "@/components/NavBar";

export default function HeaderDefault() {
  return (
    <div className="w-full mx-auto max-w-5xl">
        <GlobalStats />
        <NavBar />
    </div>
  );
}