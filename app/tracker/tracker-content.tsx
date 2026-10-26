
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import PrayerTracker from "./prayer-tracker";

export default async function TrackerContent() {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) {
        redirect("/login");
    }

    return (
        <main className="min-h-screen bg-[#f4f7f4] text-[#20352a] font-sans">
            <div className="mx-auto w-[min(1100px,100%)] px-5 py-7 max-sm:px-2.5 max-sm:py-4">
                <PrayerTracker />
            </div>
        </main>
    );
}
