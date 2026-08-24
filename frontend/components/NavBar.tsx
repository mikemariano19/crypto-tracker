
export default function NavBar() {
    return (
        <nav className="max-w-5xl flex justify-between mx-auto font-semibold py-4 px-2 md:px-6 lg:px-2 xl:px-4">
            <div>
                <a href="http://localhost:3000/" className="text-xl">CryptoTracker</a>
            </div>
            <div className="hidden md:flex items-center gap-4">
                <a href="http://localhost:3000/">Cryptocurrency</a>
                <a href="#">News</a>
                <a href="#" className="pointer">About</a>
            </div>
        </nav>
    );
}