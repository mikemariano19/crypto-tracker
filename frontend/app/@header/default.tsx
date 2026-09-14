import GlobalStats from "@/components/coin/GlobalStats";
import NavBar from "@/components/coin/NavBar";

export default function HeaderDefault() {
  return (
    <div className="w-full mx-auto max-w-5xl">
        <GlobalStats />
        <NavBar />
    </div>
  );
}