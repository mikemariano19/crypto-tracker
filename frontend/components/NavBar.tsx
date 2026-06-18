
export default function NavBar() {
    return (
        <nav className="max-w-4xl flex justify-between mx-auto text-black font-semibold p-4 rounded-lg">
            <div>
                <span className="text-2xl">CryptoTracker</span>
            </div>
            <div className="hidden md:flex items-center gap-4">
                <span>Cryptocurrency</span>
                <span>News</span>
                <span>About</span>
            </div>
        </nav>
    );
}