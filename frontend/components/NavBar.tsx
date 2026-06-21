
export default function NavBar() {
    return (
        <nav className="max-w-4xl flex justify-between mx-auto text-black font-semibold py-4 px-2">
            <div>
                <span className="text-xl">CryptoTracker</span>
            </div>
            <div className="hidden md:flex items-center gap-4">
                <span>Cryptocurrency</span>
                <span>News</span>
                <span>About</span>
            </div>
        </nav>
    );
}