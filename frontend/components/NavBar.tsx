
export default function NavBar() {
    return (
        <nav className="max-w-4xl flex justify-between mx-auto text-black font-semibold py-4 px-2">
            <div>
                <a href="#" className="text-xl">CryptoTracker</a>
            </div>
            <div className="hidden md:flex items-center gap-4">
                <a href="#">Cryptocurrency</a>
                <a href="#">News</a>
                <a href="#" className="pointer">About</a>
            </div>
        </nav>
    );
}