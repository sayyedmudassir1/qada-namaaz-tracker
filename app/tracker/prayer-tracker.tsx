
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const supabaseClient = createClient();

const PRAYERS = [
    { key: "fajr", label: "Fajr", arabic: "الفجر" },
    { key: "zohar", label: "Zohar", arabic: "الظهر" },
    { key: "asr", label: "Asr", arabic: "العصر" },
    { key: "magrib", label: "Magrib", arabic: "المغرب" },
    { key: "isha", label: "Isha", arabic: "العشاء" },
    { key: "witr", label: "Witr", arabic: "الوتر" },
] as const;

type PrayerKey = (typeof PRAYERS)[number]["key"];
type ViewMode = "monthly" | "yearly" | "qada";

type DailyCheck = {
    id?: number;
    user_id: string;
    day_date: string;
} & Record<PrayerKey, boolean>;

type QadaRecord = {
    id?: number;
    user_id: string;
} & Record<PrayerKey, number>;

type DailyRows = Record<string, DailyCheck>;

const MONTHS = Array.from({ length: 12 }, (_, i) =>
    new Date(2024, i, 1).toLocaleString("en-US", { month: "long" })
);

const YEARS = Array.from(
    { length: 101 },
    (_, i) => new Date().getFullYear() - 80 + i
);

const cx = (...classes: (string | false | undefined)[]) =>
    classes.filter(Boolean).join(" ");

const dateKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const dayDate = (year: number, month: number, day: number) =>
    dateKey(new Date(year, month, day));

const dayCount = (year: number, month: number) =>
    new Date(year, month + 1, 0).getDate();

const emptyDay = (userId: string, date: string): DailyCheck =>
    ({
        user_id: userId,
        day_date: date,
        ...Object.fromEntries(PRAYERS.map(({ key }) => [key, false])),
    }) as DailyCheck;

const emptyQada = (userId: string): QadaRecord =>
    ({
        user_id: userId,
        ...Object.fromEntries(PRAYERS.map(({ key }) => [key, 0])),
    }) as QadaRecord;

const countPrayers = (row?: DailyCheck) =>
    row ? PRAYERS.filter(({ key }) => row[key]).length : 0;

function Progress({ value, rose = false }: {
    value: number;
    rose?: boolean;
}) {
    const percentage = Math.max(0, Math.min(100, value));

    return (
        <div
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
        >
            <div
                className={cx(
                    "h-full rounded-full transition-[width]",
                    rose ? "bg-rose-500" : "bg-emerald-500"
                )}
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
}

function Loading({ message }: { message: string }) {
    return (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
            <p className="text-sm text-slate-500">{message}</p>
        </div>
    );
}

function Heading({ title, description }: {
    title: string;
    description: string;
}) {
    return (
        <div>
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                {title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
                {description}
            </p>
        </div>
    );
}

function Stat({ label, value, description, rose = false }: {
    label: string;
    value: string;
    description: string;
    rose?: boolean;
}) {
    return (
        <div className={cx(
            "min-w-0 rounded-2xl border p-4 sm:p-5",
            rose ? "border-rose-100 bg-rose-50/70" : "border-emerald-100 bg-emerald-50/70"
        )}>
            <p className={cx(
                "text-xs font-bold uppercase tracking-wider",
                rose ? "text-rose-700" : "text-emerald-700"
            )}>
                {label}
            </p>
            <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
        </div>
    );
}

export default function PrayerTracker() {
    const router = useRouter();
    const [supabase] = useState(() => supabaseClient);

    const [userId, setUserId] = useState("");
    const [month, setMonth] = useState<Date | null>(null);
    const [today, setToday] = useState(dateKey(new Date()));
    const [view, setView] = useState<ViewMode>("monthly");

    const [rows, setRows] = useState<DailyRows>({});
    const [yearRows, setYearRows] = useState<DailyRows>({});
    const [qada, setQada] = useState<QadaRecord | null>(null);

    const [authLoading, setAuthLoading] = useState(true);
    const [loading, setLoading] = useState(true);
    const [yearLoading, setYearLoading] = useState(false);
    const [qadaLoading, setQadaLoading] = useState(false);

    const [saving, setSaving] = useState<Record<string, boolean>>({});
    const [bulkLoading, setBulkLoading] = useState(false);
    const [qadaSaving, setQadaSaving] = useState(false);
    const [error, setError] = useState("");

    const year = month?.getFullYear() ?? new Date().getFullYear();
    const monthIndex = month?.getMonth() ?? new Date().getMonth();
    const days = dayCount(year, monthIndex);

    // Authenticate the user.
    useEffect(() => {
        let active = true;

        async function authenticate() {
            const { data, error } = await supabase.auth.getUser();

            if (!active) return;

            if (error || !data.user) {
                router.replace("/login");
                return;
            }

            setUserId(data.user.id);
            setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
            setAuthLoading(false);
        }

        const refreshToday = () => setToday(dateKey(new Date()));

        window.addEventListener("focus", refreshToday);
        void authenticate();

        return () => {
            active = false;
            window.removeEventListener("focus", refreshToday);
        };
    }, [router, supabase]);

    // Load monthly records.
    useEffect(() => {
        if (!userId || !month) return;

        let active = true;
        setLoading(true);
        setError("");

        async function load() {
            const { data, error } = await supabase
                .from("daily_checks")
                .select("*")
                .eq("user_id", userId)
                .gte("day_date", dayDate(year, monthIndex, 1))
                .lte("day_date", dayDate(year, monthIndex, days))
                .order("day_date");

            if (!active) return;

            if (error) {
                setError(error.message);
            } else {
                setRows(Object.fromEntries(
                    (data as DailyCheck[]).map(row => [row.day_date, row])
                ));
            }

            setLoading(false);
        }

        void load();
        return () => { active = false; };
    }, [supabase, userId, year, monthIndex, days, month]);

    // Load yearly records.
    useEffect(() => {
        if (!userId || view !== "yearly") return;

        let active = true;
        setYearLoading(true);

        async function load() {
            const { data, error } = await supabase
                .from("daily_checks")
                .select("*")
                .eq("user_id", userId)
                .gte("day_date", `${year}-01-01`)
                .lte("day_date", `${year}-12-31`)
                .order("day_date");

            if (!active) return;

            if (error) {
                setError(error.message);
            } else {
                setYearRows(Object.fromEntries(
                    (data as DailyCheck[]).map(row => [row.day_date, row])
                ));
            }

            setYearLoading(false);
        }

        void load();
        return () => { active = false; };
    }, [supabase, userId, year, view]);

    // Load or create the Qada record.
    useEffect(() => {
        if (!userId || view !== "qada") return;

        let active = true;
        setQadaLoading(true);

        async function load() {
            const { data, error } = await supabase
                .from("qada_backlog")
                .select("*")
                .eq("user_id", userId)
                .maybeSingle();

            if (!active) return;

            if (error) {
                setError(error.message);
                setQadaLoading(false);
                return;
            }

            if (data) {
                setQada(data as QadaRecord);
                setQadaLoading(false);
                return;
            }

            const { data: inserted, error: insertError } = await supabase
                .from("qada_backlog")
                .upsert(emptyQada(userId), { onConflict: "user_id" })
                .select()
                .single();

            if (!active) return;

            if (insertError) setError(insertError.message);
            else setQada(inserted as QadaRecord);

            setQadaLoading(false);
        }

        void load();
        return () => { active = false; };
    }, [supabase, userId, view]);

    // Update an individual prayer.

    async function togglePrayer(
        date: string,
        prayer: PrayerKey,
        checked: boolean
    ) {
        if (!userId || saving[date] || bulkLoading) return;

        const previous = rows[date];

        const updated: DailyCheck = {
            ...(previous ?? emptyDay(userId, date)),
            [prayer]: checked,
        };

        // Update the UI immediately.
        setRows(current => ({ ...current, [date]: updated }));
        setSaving(current => ({ ...current, [date]: true }));
        setError("");

        // Exclude database-generated columns from the payload.
        const {
            id: _id,
            day: _day,
            ...recordToSave
        } = updated as DailyCheck & { day?: number };

        const { error } = await supabase
            .from("daily_checks")
            .upsert(recordToSave, {
                onConflict: "user_id,day_date",
            });

        if (error) {
            setRows(current => {
                const next = { ...current };

                if (previous) {
                    next[date] = previous;
                } else {
                    delete next[date];
                }

                return next;
            });

            setError(`Could not save ${date}: ${error.message}`);
        }

        setSaving(current => {
            const next = { ...current };
            delete next[date];
            return next;
        });
    }


    // Mark or clear all prayers in the selected month.
    async function updateMonth(completed: boolean) {
        if (!userId || bulkLoading) return;

        setBulkLoading(true);
        setError("");

        const previous = rows;
        const updated: DailyRows = {};

        for (let day = 1; day <= days; day++) {
            const date = dayDate(year, monthIndex, day);

            updated[date] = {
                ...(rows[date] ?? emptyDay(userId, date)),
                ...Object.fromEntries(
                    PRAYERS.map(({ key }) => [key, completed])
                ),
            } as DailyCheck;
        }

        setRows(current => ({ ...current, ...updated }));



        const recordsToSave = Object.values(updated).map(
            (row) => {
                const {
                    id: _id,
                    day: _day,
                    ...record
                } = row as DailyCheck & { day?: number };

                return record;
            }
        );

        const { error } = await supabase
            .from("daily_checks")
            .upsert(recordsToSave, {
                onConflict: "user_id,day_date",
            });

        if (error) {
            setRows(previous);
            setError(`Could not update month: ${error.message}`);
        }

        setBulkLoading(false);

    }

    // Update the Qada count.
    async function updateQada(prayer: PrayerKey, delta: number) {
        if (!userId || !qada || qadaSaving) return;

        const previous = qada;
        const updated = {
            ...qada,
            [prayer]: Math.max(0, qada[prayer] + delta),
        };

        setQada(updated);
        setQadaSaving(true);
        setError("");

        const { error } = await supabase
            .from("qada_backlog")
            .upsert(updated, { onConflict: "user_id" });

        if (error) {
            setQada(previous);
            setError(`Could not update Qada count: ${error.message}`);
        }

        setQadaSaving(false);
    }

    // Sign out.
    async function signOut() {
        setError("");

        const { error } = await supabase.auth.signOut();

        if (error) {
            setError(error.message);
            return;
        }

        router.replace("/login");
        router.refresh();
    }

    // Calculate monthly and yearly statistics.
    function getStats(
        source: DailyRows,
        selectedYear: number,
        selectedMonth?: number
    ) {
        const now = new Date();
        const currentDate = dateKey(now);
        const firstMonth = selectedMonth ?? 0;
        const lastMonth = selectedMonth ?? 11;

        return Array.from(
            { length: lastMonth - firstMonth + 1 },
            (_, index) => {
                const m = firstMonth + index;
                const totalDays = dayCount(selectedYear, m);
                const lastDate = dayDate(selectedYear, m, totalDays);

                const elapsedDays = lastDate < currentDate
                    ? totalDays
                    : selectedYear === now.getFullYear() && m === now.getMonth()
                        ? now.getDate()
                        : lastDate >= currentDate ? 0 : totalDays;

                const counts = PRAYERS.map(({ key }) => {
                    let count = 0;

                    for (let d = 1; d <= elapsedDays; d++) {
                        if (source[dayDate(selectedYear, m, d)]?.[key]) count++;
                    }

                    return count;
                });

                const checked = counts.reduce((sum, count) => sum + count, 0);
                const possible = elapsedDays * PRAYERS.length;

                return {
                    month: m,
                    name: MONTHS[m],
                    checked,
                    possible,
                    percentage: possible
                        ? Math.round(checked / possible * 100)
                        : 0,
                    counts,
                    elapsedDays,
                };
            }
        );
    }

    const monthly = getStats(rows, year, monthIndex)[0];
    const yearly = getStats(yearRows, year);
    const totalQada = qada
        ? PRAYERS.reduce((sum, { key }) => sum + qada[key], 0)
        : 0;


    if (authLoading || !month) {
        return (
            <main className="mx-auto max-w-6xl px-4 py-10">
                <Loading message="Preparing your prayer tracker..." />
            </main>
        );
    }

    return (
        <main className="mx-auto min-h-screen max-w-6xl px-3 py-5 font-sans text-slate-800 sm:px-6 sm:py-8">
            {/* Header */}
            <header className="mb-6 space-y-5 border-b border-emerald-100 pb-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase text-emerald-800">
                            Spiritual Companion
                        </span>

                        <h1 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl">
                            Prayer Tracker
                        </h1>

                        <p className="mt-2 text-sm text-slate-500">
                            Track your daily prayers and makeup prayers.
                        </p>
                    </div>

                    <button
                        onClick={() => void signOut()}
                        className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 font-semibold text-rose-700"
                    >
                        Sign out
                    </button>
                </div>

                {/* Navigation */}
                <nav className="grid gap-2 rounded-2xl bg-slate-100 p-1.5 sm:grid-cols-3">
                    {([
                        ["monthly", "Monthly View"],
                        ["yearly", "Yearly Summary"],
                        ["qada", "Qada Backlog"],
                    ] as const).map(([mode, label]) => (
                        <button
                            key={mode}
                            onClick={() => setView(mode)}
                            aria-current={view === mode ? "page" : undefined}
                            className={cx(
                                "min-h-11 rounded-xl px-3 py-2.5 text-sm font-semibold",
                                view === mode
                                    ? "bg-white text-emerald-800 shadow-sm"
                                    : "text-slate-600 hover:bg-white/60"
                            )}
                        >
                            {label}

                            {mode === "qada" && totalQada > 0 && (
                                <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs">
                                    {totalQada}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>
            </header>

            {/* Main content */}
            <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-3xl sm:p-6 lg:p-8">
                {error && (
                    <div
                        role="alert"
                        className="mb-5 flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
                    >
                        <p className="flex-1 break-words">{error}</p>

                        <button
                            onClick={() => setError("")}
                            aria-label="Dismiss error"
                        >
                            ×
                        </button>
                    </div>
                )}

                {/* MONTHLY VIEW */}
                {view === "monthly" && (
                    <div className="space-y-6">
                        {/* Month selector */}
                        <div className="rounded-2xl border bg-slate-50 p-3 sm:p-4">
                            <div className="flex items-center justify-between gap-3">
                                <button
                                    aria-label="Previous month"
                                    onClick={() =>
                                        setMonth(new Date(year, monthIndex - 1, 1))
                                    }
                                    className="h-11 w-11 rounded-xl border bg-white text-xl"
                                >
                                    ‹
                                </button>

                                <h2 className="text-center text-lg font-bold">
                                    {MONTHS[monthIndex]} {year}
                                </h2>

                                <button
                                    aria-label="Next month"
                                    onClick={() =>
                                        setMonth(new Date(year, monthIndex + 1, 1))
                                    }
                                    className="h-11 w-11 rounded-xl border bg-white text-xl"
                                >
                                    ›
                                </button>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
                                <button
                                    onClick={() => {
                                        const now = new Date();
                                        setMonth(
                                            new Date(now.getFullYear(), now.getMonth(), 1)
                                        );
                                    }}
                                    className="min-h-11 rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white"
                                >
                                    Today
                                </button>

                                <select
                                    aria-label="Select month"
                                    value={monthIndex}
                                    onChange={e =>
                                        setMonth(new Date(year, Number(e.target.value), 1))
                                    }
                                    className="min-h-11 min-w-0 rounded-xl border bg-white px-3"
                                >
                                    {MONTHS.map((name, i) => (
                                        <option key={name} value={i}>
                                            {name}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    aria-label="Select year"
                                    value={year}
                                    onChange={e =>
                                        setMonth(
                                            new Date(Number(e.target.value), monthIndex, 1)
                                        )
                                    }
                                    className="col-span-2 min-h-11 rounded-xl border bg-white px-3 sm:col-span-1"
                                >
                                    {[...new Set([...YEARS, year])]
                                        .sort((a, b) => a - b)
                                        .map(y => (
                                            <option key={y} value={y}>
                                                {y}
                                            </option>
                                        ))}
                                </select>
                            </div>
                        </div>

                        {loading ? (
                            <Loading message="Loading prayer records..." />
                        ) : (
                            <>
                                {/* Prayer statistics */}
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Stat
                                        label="Area of focus"
                                        value={
                                            PRAYERS[
                                                monthly.counts.indexOf(Math.min(...monthly.counts))
                                            ].label
                                        }
                                        description={`${monthly.elapsedDays
                                            ? Math.round(
                                                (1 -
                                                    Math.min(...monthly.counts) /
                                                    monthly.elapsedDays) *
                                                100
                                            )
                                            : 0
                                            }% not recorded as completed.`}
                                        rose
                                    />

                                    <Stat
                                        label="Strongest habit"
                                        value={
                                            PRAYERS[
                                                monthly.counts.indexOf(Math.max(...monthly.counts))
                                            ].label
                                        }
                                        description="Your most frequently completed prayer."
                                    />
                                </div>

                                {/* Monthly progress */}
                                <div className="space-y-4 rounded-2xl border bg-slate-50/70 p-4 sm:p-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h3 className="font-bold">Monthly completion</h3>
                                            <p className="mt-1 text-xs text-slate-500">
                                                Based on elapsed days.
                                            </p>
                                        </div>

                                        <span className="text-2xl font-extrabold text-emerald-700">
                                            {monthly.percentage}%
                                        </span>
                                    </div>

                                    <Progress value={monthly.percentage} />

                                    <p className="text-xs text-slate-500">
                                        {monthly.checked} of {monthly.possible} prayers across{" "}
                                        {monthly.elapsedDays} days.
                                    </p>

                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <button
                                            disabled={bulkLoading}
                                            onClick={() => void updateMonth(true)}
                                            className="min-h-11 rounded-xl bg-emerald-600 px-3 py-2 font-bold text-white disabled:opacity-50"
                                        >
                                            {bulkLoading ? "Saving..." : "Mark entire month done"}
                                        </button>

                                        <button
                                            disabled={bulkLoading}
                                            onClick={() => void updateMonth(false)}
                                            className="min-h-11 rounded-xl border bg-white px-3 py-2 font-bold text-rose-700 disabled:opacity-50"
                                        >
                                            Clear entire month
                                        </button>
                                    </div>
                                </div>

                                {/* Daily prayer checklist */}
                                <div className="overflow-x-auto rounded-2xl border">
                                    <table className="w-full min-w-[680px] text-center">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="sticky left-0 bg-slate-50 px-3 py-4 text-left text-xs">
                                                    Day
                                                </th>

                                                {PRAYERS.map(prayer => (
                                                    <th
                                                        key={prayer.key}
                                                        className="px-3 py-4 text-xs"
                                                    >
                                                        {prayer.label}

                                                        <span
                                                            lang="ar"
                                                            dir="rtl"
                                                            className="mt-1 block text-sm font-normal text-emerald-700"
                                                        >
                                                            {prayer.arabic}
                                                        </span>
                                                    </th>
                                                ))}

                                                <th className="px-3 py-4 text-xs">
                                                    Progress
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-slate-100">
                                            {Array.from(
                                                { length: days },
                                                (_, i) => i + 1
                                            ).map(day => {
                                                const date = dayDate(year, monthIndex, day);
                                                const row =
                                                    rows[date] ?? emptyDay(userId, date);
                                                const count = countPrayers(row);
                                                const isToday = date === today;

                                                return (
                                                    <tr
                                                        key={date}
                                                        className={
                                                            isToday
                                                                ? "bg-emerald-50/60"
                                                                : "bg-white"
                                                        }
                                                    >
                                                        <th className="sticky left-0 bg-inherit px-3 py-3 text-left text-sm">
                                                            {day}{" "}

                                                            {isToday && (
                                                                <span className="text-xs text-emerald-700">
                                                                    Today
                                                                </span>
                                                            )}
                                                        </th>

                                                        {PRAYERS.map(({ key, label }) => (
                                                            <td key={key} className="px-3 py-3">
                                                                <input
                                                                    type="checkbox"
                                                                    aria-label={`${label}, ${date}`}
                                                                    checked={row[key]}
                                                                    disabled={
                                                                        Boolean(saving[date]) || bulkLoading
                                                                    }
                                                                    onChange={e =>
                                                                        void togglePrayer(
                                                                            date,
                                                                            key,
                                                                            e.target.checked
                                                                        )
                                                                    }
                                                                    className="h-5 w-5 accent-emerald-600"
                                                                />
                                                            </td>
                                                        ))}

                                                        <td className="px-3 py-3">
                                                            <span
                                                                className={cx(
                                                                    "rounded-full px-2.5 py-1 text-xs font-bold",
                                                                    count === PRAYERS.length
                                                                        ? "bg-emerald-100 text-emerald-800"
                                                                        : count
                                                                            ? "bg-amber-100 text-amber-800"
                                                                            : "bg-slate-100 text-slate-600"
                                                                )}
                                                            >
                                                                {count}/{PRAYERS.length}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                )}


                {/* YEARLY SUMMARY */}
                {view === "yearly" && (
                    <div className="space-y-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <Heading
                                title={`Yearly overview · ${year}`}
                                description="Review prayer completion throughout the year."
                            />

                            <select
                                aria-label="Select summary year"
                                value={year}
                                onChange={e =>
                                    setMonth(new Date(Number(e.target.value), monthIndex, 1))
                                }
                                className="min-h-11 rounded-xl border bg-white px-3"
                            >
                                {[...new Set([...YEARS, year])]
                                    .sort((a, b) => a - b)
                                    .map(y => (
                                        <option key={y} value={y}>
                                            {y}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        {yearLoading ? (
                            <Loading message="Loading yearly summary..." />
                        ) : (
                            <div className="grid gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {yearly.map(item => (
                                    <article
                                        key={item.month}
                                        className="rounded-2xl border p-4 sm:p-5"
                                    >
                                        <div className="mb-4 flex items-center justify-between gap-2">
                                            <h3 className="font-bold">{item.name}</h3>

                                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                                                {item.percentage}%
                                            </span>
                                        </div>

                                        <Progress value={item.percentage} />

                                        <p className="mt-3 text-xs text-slate-500">
                                            {item.checked} of {item.possible} prayers completed
                                        </p>

                                        <button
                                            onClick={() => {
                                                setMonth(new Date(year, item.month, 1));
                                                setView("monthly");
                                            }}
                                            className="mt-4 min-h-10 w-full rounded-xl border px-3 py-2 text-xs font-bold"
                                        >
                                            View month
                                        </button>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* QADA BACKLOG */}
                {view === "qada" && (
                    <div className="space-y-5">
                        <div className="flex flex-col gap-4 rounded-2xl border bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <Heading
                                title="Qada prayer backlog"
                                description="Track missed prayers and reduce the count as you make them up."
                            />

                            <div className="rounded-xl border bg-white p-4">
                                <p className="text-xs font-bold uppercase text-slate-400">
                                    Total remaining
                                </p>

                                <p className="mt-1 text-2xl font-extrabold text-emerald-800">
                                    {totalQada} <span className="text-sm">prayers</span>
                                </p>
                            </div>
                        </div>

                        {qadaLoading || !qada ? (
                            <Loading message="Loading Qada backlog..." />
                        ) : (
                            <div className="grid gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
                                {PRAYERS.map(({ key, label, arabic }) => (
                                    <article
                                        key={key}
                                        className="flex flex-col justify-between gap-5 rounded-2xl border p-4 sm:p-5"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <h3 className="font-bold">{label}</h3>

                                                <p
                                                    lang="ar"
                                                    dir="rtl"
                                                    className="mt-1 text-sm text-emerald-700"
                                                >
                                                    {arabic}
                                                </p>
                                            </div>

                                            <span className="flex h-12 min-w-12 items-center justify-center rounded-xl bg-emerald-50 px-3 text-xl font-extrabold text-emerald-800">
                                                {qada[key]}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 border-t pt-4">
                                            <button
                                                disabled={qadaSaving || qada[key] === 0}
                                                onClick={() => void updateQada(key, -1)}
                                                className="min-h-11 rounded-xl border bg-slate-50 px-2 py-2 text-xs font-bold disabled:opacity-40"
                                            >
                                                −1 Made up
                                            </button>

                                            <button
                                                disabled={qadaSaving}
                                                onClick={() => void updateQada(key, 1)}
                                                className="min-h-11 rounded-xl bg-emerald-600 px-2 py-2 text-xs font-bold text-white disabled:opacity-40"
                                            >
                                                +1 Missed
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* FOOTER */}
            <footer className="py-8 text-center text-xs leading-5 text-slate-400">
                Your prayer records are synced to your account.

                <span className="mt-1 block">
                    May your consistency grow one prayer at a time.
                </span>
            </footer>
        </main>
    );
}
