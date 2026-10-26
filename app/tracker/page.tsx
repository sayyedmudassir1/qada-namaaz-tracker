
import { Suspense } from "react";
import TrackerContent from "./tracker-content";

export default function TrackerPage() {
    return (
        <Suspense
            fallback={
                <main className="min-h-screen bg-[#f4f7f4] text-[#20352a] font-sans">
                    <div className="mx-auto w-[min(1100px,100%)] px-5 py-7 max-sm:px-2.5 max-sm:py-4">
                        Loading your prayer tracker...
                    </div>
                </main>
            }
        >
            <TrackerContent />
        </Suspense>
    );
}
