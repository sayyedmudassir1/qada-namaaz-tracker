"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const prayers = [
    { key: "fajr", label: "Fajr", arabic: "الفجر" },
    { key: "zohar", label: "Zohar", arabic: "الظهر" },
    { key: "asr", label: "Asr", arabic: "العصر" },
    { key: "magrib", label: "Magrib", arabic: "المغرب" },
    { key: "isha", label: "Isha", arabic: "العشاء" },
    { key: "witr", label: "Witr", arabic: "الوتر" },
] as const;

type PrayerKey = (typeof prayers)[number]["key"];
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

type DailyRowMap = Record<string, DailyCheck>;

const MONTHS = Array.from({ length: 12 }, (_, index) =>
    new Date(2024, index, 1).toLocaleDateString("en-US", {
        month: "long",
    }),
);

const YEAR_OPTIONS = Array.from(
    { length: 101 },
    (_, index) => new Date().getFullYear() - 80 + index,
);

function localDate(year: number, month: number, day: number) {
    return [
        year,
        String(month + 1).padStart(2, "0"),
        String(day).padStart(2, "0"),
    ].join("-");
}

function getToday() {
    const now = new Date();
    return localDate(now.getFullYear(), now.getMonth(), now.getDate());
}

function emptyDay(userId: string, date: string): DailyCheck {
    return {
        user_id: userId,
        day_date: date,
        fajr: false,
        zohar: false,
        asr: false,
        magrib: false,
        isha: false,
        witr: false,
    };
}

function emptyQada(userId: string): QadaRecord {
    return {
        user_id: userId,
        fajr: 0,
        zohar: 0,
        asr: 0,
        magrib: 0,
        isha: 0,
        witr: 0,
    };
}

function completedCount(row?: DailyCheck) {
    if (!row) return 0;
    return prayers.reduce(
        (total, prayer) => total + (row[prayer.key] ? 1 : 0),
        0,
    );
}

function getErrorMessage(error: unknown) {
    return error instanceof Error
        ? error.message
        : "An unexpected error occurred.";
}

function ProgressBar({
    value,
    color = "emerald",
}: {
    value: number;
    color?: "emerald" | "rose";
}) {
    const safeValue = Math.max(0, Math.min(100, value));

    return (
        <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-label="Completion rate"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={safeValue}
        >
            <div
                className={`h-full rounded-full transition-[width] duration-300 ${color === "rose"
                    ? "bg-rose-500"
                    : "bg-linear-to-r from-emerald-500 to-teal-500"
                    }`}
                style={{ width: `${safeValue}%` }}
            />
        </div>
    );
}

function LoadingState({ message }: { message: string }) {
    return (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 py-12 text-center">
            <div
                className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600"
                aria-hidden="true"
            />
            <p className="text-sm font-medium text-slate-500">{message}</p>
        </div>
    );
}

function SectionHeading({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        </div>
    );
}

function StatCard({
    label,
    value,
    description,
    tone = "emerald",
}: {
    label: string;
    value: string;
    description: string;
    tone?: "emerald" | "rose";
}) {
    return (
        <div
            className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${tone === "rose"
                ? "border-rose-100 bg-rose-50/70"
                : "border-emerald-100 bg-emerald-50/70"
                }`}
        >
            <p
                className={`text-xs font-bold uppercase tracking-wider ${tone === "rose" ? "text-rose-700" : "text-emerald-700"
                    }`}
            >
                {label}
            </p>
            <p className="mt-2 wrap-break-word text-lg font-bold text-slate-900 sm:text-xl">
                {value}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
        </div>
    );
}

function PrayerToggle({
    prayer,
    checked,
    disabled,
    onChange,
}: {
    prayer: (typeof prayers)[number];
    checked: boolean;
    disabled: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <label
            className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors sm:min-h-11 ${checked
                ? "border-emerald-200 bg-emerald-50"
                : "border-slate-200 bg-white hover:border-emerald-200"
                } ${disabled ? "cursor-wait opacity-60" : "cursor-pointer"}`}
        >
            <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange(event.target.checked)}
                aria-label={`${prayer.label} prayer`}
                className="h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 accent-emerald-600 focus:ring-emerald-500"
            />
            <span className="min-w-0 flex-1 text-sm font-semibold text-slate-800">
                {prayer.label}
            </span>
            <span
                lang="ar"
                dir="rtl"
                className="shrink-0 text-sm text-emerald-700"
            >
                {prayer.arabic}
            </span>
        </label>
    );
}

export default function PrayerTracker() {
    const router = useRouter();
    const [supabase] = useState(() => createClient());

    const [userId, setUserId] = useState("");
    const [month, setMonth] = useState<Date | null>(null);
    const [today, setToday] = useState("");
    const [viewMode, setViewMode] = useState<ViewMode>("monthly");

    const [rows, setRows] = useState<DailyRowMap>({});
    const [yearlyRows, setYearlyRows] = useState<DailyRowMap>({});
    const [qadaData, setQadaData] = useState<QadaRecord | null>(null);

    const [authLoading, setAuthLoading] = useState(true);
    const [loading, setLoading] = useState(true);
    const [yearlyLoading, setYearlyLoading] = useState(false);
    const [qadaLoading, setQadaLoading] = useState(false);

    const [saving, setSaving] = useState<Record<string, boolean>>({});
    const [bulkActionLoading, setBulkActionLoading] = useState(false);
    const [qadaSaving, setQadaSaving] = useState(false);
    const [error, setError] = useState("");

    const monthRequestRef = useRef(0);
    const yearRequestRef = useRef(0);
    const qadaRequestRef = useRef(0);
    const rowMutationRef = useRef<Record<string, number>>({});
    const qadaMutationRef = useRef(0);
    const bulkMutationRef = useRef(0);

    useEffect(() => {
        const now = new Date();

        setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
        setToday(getToday());

        const refreshToday = () => setToday(getToday());
        window.addEventListener("focus", refreshToday);

        return () => {
            window.removeEventListener("focus", refreshToday);
        };
    }, []);

    const year = month?.getFullYear() ?? new Date().getFullYear();
    const monthIndex = month?.getMonth() ?? new Date().getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    useEffect(() => {
        let active = true;

        async function authenticate() {
            setAuthLoading(true);

            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (!active) return;

            if (authError || !user) {
                router.replace("/login");
                return;
            }

            setUserId(user.id);
            setAuthLoading(false);
        }

        void authenticate();

        return () => {
            active = false;
        };
    }, [router, supabase]);

    const loadMonth = useCallback(async () => {
        if (!month || !userId) return;

        const requestId = ++monthRequestRef.current;
        const start = localDate(year, monthIndex, 1);
        const end = localDate(year, monthIndex, daysInMonth);

        setLoading(true);
        setError("");

        const { data, error: queryError } = await supabase
            .from("daily_checks")
            .select("*")
            .eq("user_id", userId)
            .gte("day_date", start)
            .lte("day_date", end)
            .order("day_date");

        if (requestId !== monthRequestRef.current) return;

        if (queryError) {
            setError(queryError.message);
            setLoading(false);
            return;
        }

        const nextRows: DailyRowMap = {};
        for (const row of (data ?? []) as DailyCheck[]) {
            nextRows[row.day_date] = row;
        }

        setRows(nextRows);
        setLoading(false);
    }, [supabase, userId, month, year, monthIndex, daysInMonth]);

    const loadYear = useCallback(async () => {
        if (!userId) return;

        const requestId = ++yearRequestRef.current;
        setYearlyLoading(true);

        const { data, error: queryError } = await supabase
            .from("daily_checks")
            .select("*")
            .eq("user_id", userId)
            .gte("day_date", `${year}-01-01`)
            .lte("day_date", `${year}-12-31`)
            .order("day_date");

        if (requestId !== yearRequestRef.current) return;

        if (queryError) {
            setError(queryError.message);
        } else {
            const nextRows: DailyRowMap = {};
            for (const row of (data ?? []) as DailyCheck[]) {
                nextRows[row.day_date] = row;
            }
            setYearlyRows(nextRows);
        }

        setYearlyLoading(false);
    }, [supabase, userId, year]);

    const loadQada = useCallback(async () => {
        if (!userId) return;

        const requestId = ++qadaRequestRef.current;
        setQadaLoading(true);

        const { data, error: queryError } = await supabase
            .from("qada_backlog")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();

        if (requestId !== qadaRequestRef.current) return;

        if (queryError) {
            setError(queryError.message);
            setQadaLoading(false);
            return;
        }

        if (data) {
            setQadaData(data as QadaRecord);
            setQadaLoading(false);
            return;
        }

        const initialQada = emptyQada(userId);
        const { data: inserted, error: insertError } = await supabase
            .from("qada_backlog")
            .upsert(initialQada, { onConflict: "user_id" })
            .select()
            .single();

        if (requestId !== qadaRequestRef.current) return;

        if (insertError) {
            setError(insertError.message);
        } else if (inserted) {
            setQadaData(inserted as QadaRecord);
        }

        setQadaLoading(false);
    }, [supabase, userId]);

    useEffect(() => {
        if (!userId || !month) return;

        void loadMonth();
        return () => {
            monthRequestRef.current++;
        };
    }, [userId, month, loadMonth]);

    useEffect(() => {
        if (!userId || viewMode !== "yearly") return;

        void loadYear();
        return () => {
            yearRequestRef.current++;
        };
    }, [userId, viewMode, loadYear]);

    useEffect(() => {
        if (!userId || viewMode !== "qada") return;

        void loadQada();
        return () => {
            qadaRequestRef.current++;
        };
    }, [userId, viewMode, loadQada]);

    const togglePrayer = useCallback(
        async (date: string, prayer: PrayerKey, checked: boolean) => {
            if (!userId || saving[date] || bulkActionLoading) return;

            const previous = rows[date] ?? emptyDay(userId, date);
            const updated = { ...previous, [prayer]: checked };
            const mutationId = (rowMutationRef.current[date] ?? 0) + 1;

            rowMutationRef.current[date] = mutationId;
            setRows((current) => ({ ...current, [date]: updated }));
            setSaving((current) => ({ ...current, [date]: true }));
            setError("");

            const { error: saveError } = await supabase
                .from("daily_checks")
                .upsert(updated, { onConflict: "user_id,day_date" });

            if (rowMutationRef.current[date] !== mutationId) return;

            if (saveError) {
                setRows((current) => {
                    const restored = { ...current };

                    if (previous.id || Object.hasOwn(current, date)) {
                        restored[date] = previous;
                    } else {
                        delete restored[date];
                    }

                    return restored;
                });

                setError(`Could not save ${date}: ${saveError.message}`);
            }

            setSaving((current) => {
                const next = { ...current };
                delete next[date];
                return next;
            });
        },
        [userId, saving, bulkActionLoading, rows, supabase],
    );

    const handleBulkAction = useCallback(
        async (completedStatus: boolean) => {
            if (!userId || bulkActionLoading) return;

            const mutationId = ++bulkMutationRef.current;
            const previousRows = { ...rows };
            const updatedRows: DailyRowMap = {};
            const bulkPayload: DailyCheck[] = [];

            setBulkActionLoading(true);
            setError("");

            for (let day = 1; day <= daysInMonth; day++) {
                const date = localDate(year, monthIndex, day);
                const existing = rows[date] ?? emptyDay(userId, date);

                const updated: DailyCheck = {
                    ...existing,
                    fajr: completedStatus,
                    zohar: completedStatus,
                    asr: completedStatus,
                    magrib: completedStatus,
                    isha: completedStatus,
                    witr: completedStatus,
                };

                updatedRows[date] = updated;
                bulkPayload.push(updated);
            }

            for (const date of Object.keys(updatedRows)) {
                rowMutationRef.current[date] =
                    (rowMutationRef.current[date] ?? 0) + 1;
            }

            setSaving({});
            setRows((current) => ({ ...current, ...updatedRows }));

            const { error: saveError } = await supabase
                .from("daily_checks")
                .upsert(bulkPayload, { onConflict: "user_id,day_date" });

            if (bulkMutationRef.current !== mutationId) return;

            if (saveError) {
                setRows(previousRows);
                setError(`Could not update month: ${saveError.message}`);
            }

            setBulkActionLoading(false);
        },
        [
            userId,
            bulkActionLoading,
            rows,
            daysInMonth,
            year,
            monthIndex,
            supabase,
        ],
    );

    const updateQadaCount = useCallback(
        async (prayerKey: PrayerKey, delta: number) => {
            if (!userId || !qadaData || qadaSaving) return;

            const previous = qadaData;
            const updated = {
                ...previous,
                [prayerKey]: Math.max(0, previous[prayerKey] + delta),
            };

            const mutationId = ++qadaMutationRef.current;

            setQadaData(updated);
            setQadaSaving(true);
            setError("");

            const { error: saveError } = await supabase
                .from("qada_backlog")
                .upsert(updated, { onConflict: "user_id" });

            if (qadaMutationRef.current !== mutationId) return;

            if (saveError) {
                setQadaData(previous);
                setError(`Could not update Qada count: ${saveError.message}`);
            }

            setQadaSaving(false);
        },
        [userId, qadaData, qadaSaving, supabase],
    );

    const signOut = useCallback(async () => {
        setError("");

        const { error: signOutError } = await supabase.auth.signOut();

        if (signOutError) {
            setError(signOutError.message);
            return;
        }

        router.replace("/login");
        router.refresh();
    }, [supabase, router]);

    const totalQadaCount = useMemo(
        () =>
            qadaData
                ? prayers.reduce((total, prayer) => total + qadaData[prayer.key], 0)
                : 0,
        [qadaData],
    );

    const monthlyStats = useMemo(() => {
        const currentYear = Number(today.slice(0, 4));
        const currentMonth = Number(today.slice(5, 7)) - 1;
        const currentDay = Number(today.slice(8, 10));

        const daysToCount =
            year === currentYear && monthIndex === currentMonth
                ? currentDay
                : year < currentYear ||
                    (year === currentYear && monthIndex < currentMonth)
                    ? daysInMonth
                    : 0;

        let totalChecked = 0;

        for (let day = 1; day <= daysToCount; day++) {
            totalChecked += completedCount(rows[localDate(year, monthIndex, day)]);
        }

        const totalPossible = daysToCount * prayers.length;

        const prayerStats = prayers.map((prayer) => {
            let count = 0;

            for (let day = 1; day <= daysToCount; day++) {
                if (rows[localDate(year, monthIndex, day)]?.[prayer.key]) count++;
            }

            return {
                ...prayer,
                count,
                pct: daysToCount ? Math.round((count / daysToCount) * 100) : 0,
            };
        });

        const sorted = [...prayerStats].sort((a, b) => a.pct - b.pct);

        return {
            daysToCount,
            totalChecked,
            totalPossible,
            percentage: totalPossible
                ? Math.round((totalChecked / totalPossible) * 100)
                : 0,
            prayerStats,
            mostMissed: sorted[0],
            mostCompleted: sorted[sorted.length - 1],
        };
    }, [rows, year, monthIndex, daysInMonth, today]);

    const yearlyStats = useMemo(
        () =>
            Array.from({ length: 12 }, (_, monthNumber) => {
                const monthDays = new Date(year, monthNumber + 1, 0).getDate();
                const currentYear = Number(today.slice(0, 4));
                const currentMonth = Number(today.slice(5, 7)) - 1;
                const currentDay = Number(today.slice(8, 10));

                const daysToCount =
                    year < currentYear
                        ? monthDays
                        : year > currentYear
                            ? 0
                            : monthNumber < currentMonth
                                ? monthDays
                                : monthNumber === currentMonth
                                    ? currentDay
                                    : 0;

                let checked = 0;

                for (let day = 1; day <= daysToCount; day++) {
                    checked += completedCount(
                        yearlyRows[localDate(year, monthNumber, day)],
                    );
                }

                const possible = daysToCount * prayers.length;

                return {
                    monthNumber,
                    name: MONTHS[monthNumber],
                    checked,
                    possible,
                    percentage: possible ? Math.round((checked / possible) * 100) : 0,
                };
            }),
        [yearlyRows, year, today],
    );

    const changeMonth = (offset: number) => {
        setMonth(new Date(year, monthIndex + offset, 1));
    };

    if (authLoading || !month) {
        return (
            <main className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:px-6">
                <LoadingState message="Preparing your prayer tracker..." />
            </main>
        );
    }

    return (
        <main className="mx-auto min-h-screen w-full max-w-6xl px-3 py-5 font-sans text-slate-800 antialiased sm:px-6 sm:py-8 lg:px-8">
            <header className="mb-5 space-y-5 border-b border-emerald-100 pb-5 sm:mb-8 sm:pb-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-800 sm:text-xs">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Spiritual Companion
                        </span>

                        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                            Prayer Tracker
                        </h1>

                        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
                            Build consistent habits and keep track of your daily and makeup
                            prayers.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => void signOut()}
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 sm:w-auto"
                    >
                        Sign out
                    </button>
                </div>

                <nav
                    aria-label="Prayer tracker views"
                    className="grid grid-cols-1 gap-2 rounded-2xl bg-slate-100 p-1.5 sm:grid-cols-3 sm:gap-1"
                >
                    {(
                        [
                            ["monthly", "Monthly View"],
                            ["yearly", "Yearly Summary"],
                            ["qada", "Qada Backlog"],
                        ] as const
                    ).map(([mode, label]) => (
                        <button
                            key={mode}
                            type="button"
                            aria-current={viewMode === mode ? "page" : undefined}
                            onClick={() => setViewMode(mode)}
                            className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${viewMode === mode
                                ? "bg-white text-emerald-800 shadow-sm"
                                : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
                                }`}
                        >
                            {label}
                            {mode === "qada" && totalQadaCount > 0 && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                                    {totalQadaCount}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>
            </header>

            <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm shadow-emerald-950/3 sm:rounded-3xl sm:p-6 lg:p-8">
                {error && (
                    <div
                        role="alert"
                        className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800 sm:p-4"
                    >
                        <span className="shrink-0 font-bold" aria-hidden="true">
                            !
                        </span>
                        <p className="min-w-0 flex-1 wrap-break-word">{error}</p>
                        <button
                            type="button"
                            onClick={() => setError("")}
                            aria-label="Dismiss error"
                            className="shrink-0 rounded-md px-2 py-1 font-bold hover:bg-rose-100"
                        >
                            ×
                        </button>
                    </div>
                )}

                {viewMode === "monthly" && (
                    <div className="space-y-5 sm:space-y-6">
                        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
                            <div className="flex items-center justify-between gap-3">
                                <button
                                    type="button"
                                    aria-label="Previous month"
                                    onClick={() => changeMonth(-1)}
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                                >
                                    ‹
                                </button>

                                <div className="min-w-0 text-center">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                        Monthly tracker
                                    </p>
                                    <h2 className="mt-1 wrap-break-word text-lg font-bold text-slate-900 sm:text-xl">
                                        {month.toLocaleDateString("en-US", {
                                            month: "long",
                                            year: "numeric",
                                        })}
                                    </h2>
                                </div>

                                <button
                                    type="button"
                                    aria-label="Next month"
                                    onClick={() => changeMonth(1)}
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                                >
                                    ›
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const now = new Date();
                                        setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                                    }}
                                    className="min-h-11 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                                >
                                    Today
                                </button>

                                <select
                                    aria-label="Select month"
                                    value={monthIndex}
                                    onChange={(event) =>
                                        setMonth(new Date(year, Number(event.target.value), 1))
                                    }
                                    className="min-h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 sm:flex-1"
                                >
                                    {MONTHS.map((name, index) => (
                                        <option key={name} value={index}>
                                            {name}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    aria-label="Select year"
                                    value={year}
                                    onChange={(event) =>
                                        setMonth(
                                            new Date(Number(event.target.value), monthIndex, 1),
                                        )
                                    }
                                    className="col-span-2 min-h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 sm:col-span-1 sm:w-32"
                                >
                                    {YEAR_OPTIONS.map((optionYear) => (
                                        <option key={optionYear} value={optionYear}>
                                            {optionYear}
                                        </option>
                                    ))}
                                    {!YEAR_OPTIONS.includes(year) && (
                                        <option value={year}>{year}</option>
                                    )}
                                </select>
                            </div>
                        </div>

                        {loading ? (
                            <LoadingState message="Loading your prayer records..." />
                        ) : (
                            <>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <StatCard
                                        label="Area of focus"
                                        value={monthlyStats.mostMissed.label}
                                        description={`${100 - monthlyStats.mostMissed.pct}% not recorded as completed during the selected days.`}
                                        tone="rose"
                                    />
                                    <StatCard
                                        label="Strongest habit"
                                        value={monthlyStats.mostCompleted.label}
                                        description={`${monthlyStats.mostCompleted.pct}% completion consistency during the selected days.`}
                                    />
                                </div>

                                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-bold text-slate-800 sm:text-base">
                                                Monthly completion
                                            </h3>
                                            <p className="mt-1 text-xs leading-5 text-slate-500">
                                                Based on elapsed days in the selected month.
                                            </p>
                                        </div>
                                        <span className="shrink-0 text-2xl font-extrabold text-emerald-700">
                                            {monthlyStats.percentage}%
                                        </span>
                                    </div>

                                    <ProgressBar value={monthlyStats.percentage} />

                                    <p className="text-xs leading-5 text-slate-500">
                                        {monthlyStats.totalChecked} of {monthlyStats.totalPossible}{" "}
                                        prayers completed across {monthlyStats.daysToCount} days.
                                    </p>

                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            disabled={bulkActionLoading || !userId}
                                            onClick={() => void handleBulkAction(true)}
                                            className="min-h-11 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                                        >
                                            {bulkActionLoading
                                                ? "Saving changes..."
                                                : "Mark entire month done"}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={bulkActionLoading || !userId}
                                            onClick={() => void handleBulkAction(false)}
                                            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                                        >
                                            Clear entire month
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3 md:hidden">
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900">
                                            Daily prayers
                                        </h3>
                                        <p className="mt-1 text-xs leading-5 text-slate-500">
                                            Select each prayer as you complete it.
                                        </p>
                                    </div>

                                    {Array.from(
                                        { length: daysInMonth },
                                        (_, index) => index + 1,
                                    ).map((day) => {
                                        const date = localDate(year, monthIndex, day);
                                        const row = rows[date] ?? emptyDay(userId, date);
                                        const count = completedCount(row);
                                        const isToday = date === today;
                                        const isComplete = count === prayers.length;
                                        const dayDate = new Date(year, monthIndex, day);

                                        return (
                                            <article
                                                key={date}
                                                className={`min-w-0 rounded-2xl border p-3.5 transition-colors ${isToday
                                                    ? "border-emerald-300 bg-emerald-50/50"
                                                    : "border-slate-200 bg-white"
                                                    }`}
                                            >
                                                <div className="mb-3 flex items-center justify-between gap-3">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <span
                                                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${isToday
                                                                ? "bg-emerald-600 text-white"
                                                                : "bg-slate-100 text-slate-700"
                                                                }`}
                                                        >
                                                            {day}
                                                        </span>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-bold text-slate-900">
                                                                {dayDate.toLocaleDateString("en-US", {
                                                                    weekday: "long",
                                                                })}
                                                            </p>
                                                            <p className="text-xs text-slate-500">
                                                                {dayDate.toLocaleDateString("en-US", {
                                                                    month: "short",
                                                                    day: "numeric",
                                                                })}
                                                                {isToday ? " · Today" : ""}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span
                                                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${isComplete
                                                            ? "bg-emerald-100 text-emerald-800"
                                                            : count > 0
                                                                ? "bg-amber-100 text-amber-800"
                                                                : "bg-slate-100 text-slate-600"
                                                            }`}
                                                    >
                                                        {count}/6
                                                    </span>
                                                </div>

                                                <ProgressBar value={Math.round((count / 6) * 100)} />

                                                <div className="mt-3 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                                                    {prayers.map((prayer) => (
                                                        <PrayerToggle
                                                            key={prayer.key}
                                                            prayer={prayer}
                                                            checked={row[prayer.key]}
                                                            disabled={
                                                                !userId ||
                                                                Boolean(saving[date]) ||
                                                                bulkActionLoading
                                                            }
                                                            onChange={(checked) =>
                                                                void togglePrayer(date, prayer.key, checked)
                                                            }
                                                        />
                                                    ))}
                                                </div>

                                                {saving[date] && (
                                                    <p
                                                        className="mt-2 text-right text-xs text-slate-400"
                                                        role="status"
                                                    >
                                                        Saving...
                                                    </p>
                                                )}
                                            </article>
                                        );
                                    })}
                                </div>

                                <div className="hidden overflow-hidden rounded-2xl border border-slate-200 md:block">
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-190 border-collapse text-center">
                                            <thead>
                                                <tr className="border-b border-slate-200 bg-slate-50">
                                                    <th
                                                        scope="col"
                                                        className="sticky left-0 z-10 bg-slate-50 px-4 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-600"
                                                    >
                                                        Day
                                                    </th>
                                                    {prayers.map((prayer) => (
                                                        <th
                                                            key={prayer.key}
                                                            scope="col"
                                                            className="px-3 py-4 text-xs font-bold uppercase tracking-wider text-slate-700"
                                                        >
                                                            <span className="block">{prayer.label}</span>
                                                            <span
                                                                lang="ar"
                                                                dir="rtl"
                                                                className="mt-1 block text-sm font-normal text-emerald-700"
                                                            >
                                                                {prayer.arabic}
                                                            </span>
                                                        </th>
                                                    ))}
                                                    <th
                                                        scope="col"
                                                        className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-slate-600"
                                                    >
                                                        Progress
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody className="divide-y divide-slate-100">
                                                {Array.from(
                                                    { length: daysInMonth },
                                                    (_, index) => index + 1,
                                                ).map((day) => {
                                                    const date = localDate(year, monthIndex, day);
                                                    const row = rows[date] ?? emptyDay(userId, date);
                                                    const count = completedCount(row);
                                                    const isToday = date === today;

                                                    return (
                                                        <tr
                                                            key={date}
                                                            className={`transition-colors hover:bg-slate-50 ${isToday ? "bg-emerald-50/50" : "bg-white"
                                                                }`}
                                                        >
                                                            <th
                                                                scope="row"
                                                                className={`sticky left-0 z-10 px-4 py-3 text-left text-sm font-semibold ${isToday
                                                                    ? "bg-emerald-50 text-emerald-900"
                                                                    : "bg-white text-slate-800"
                                                                    }`}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <span
                                                                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${isToday
                                                                            ? "bg-emerald-600 text-white"
                                                                            : "bg-slate-100 text-slate-700"
                                                                            }`}
                                                                    >
                                                                        {day}
                                                                    </span>
                                                                    {isToday && (
                                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                                                                            Today
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </th>

                                                            {prayers.map((prayer) => (
                                                                <td key={prayer.key} className="px-3 py-3">
                                                                    <input
                                                                        type="checkbox"
                                                                        aria-label={`${prayer.label}, ${date}`}
                                                                        checked={row[prayer.key]}
                                                                        disabled={
                                                                            !userId ||
                                                                            Boolean(saving[date]) ||
                                                                            bulkActionLoading
                                                                        }
                                                                        onChange={(event) =>
                                                                            void togglePrayer(
                                                                                date,
                                                                                prayer.key,
                                                                                event.target.checked,
                                                                            )
                                                                        }
                                                                        className="h-5 w-5 cursor-pointer rounded border-slate-300 accent-emerald-600 focus:ring-emerald-500 disabled:cursor-wait disabled:opacity-50"
                                                                    />
                                                                </td>
                                                            ))}

                                                            <td className="px-4 py-3">
                                                                <span
                                                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${count === prayers.length
                                                                        ? "bg-emerald-100 text-emerald-800"
                                                                        : count > 0
                                                                            ? "bg-amber-100 text-amber-800"
                                                                            : "bg-slate-100 text-slate-600"
                                                                        }`}
                                                                >
                                                                    {count}/6
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {viewMode === "yearly" && (
                    <div className="space-y-5 sm:space-y-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <SectionHeading
                                title={`Yearly overview · ${year}`}
                                description="Review your prayer completion across the year."
                            />
                            <select
                                aria-label="Select summary year"
                                value={year}
                                onChange={(event) =>
                                    setMonth(
                                        new Date(Number(event.target.value), monthIndex, 1),
                                    )
                                }
                                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 sm:w-36"
                            >
                                {YEAR_OPTIONS.map((optionYear) => (
                                    <option key={optionYear} value={optionYear}>
                                        {optionYear}
                                    </option>
                                ))}
                                {!YEAR_OPTIONS.includes(year) && (
                                    <option value={year}>{year}</option>
                                )}
                            </select>
                        </div>

                        {yearlyLoading ? (
                            <LoadingState message="Loading your yearly summary..." />
                        ) : (
                            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
                                {yearlyStats.map((item) => (
                                    <article
                                        key={item.monthNumber}
                                        className="min-w-0 rounded-2xl border border-slate-200 bg-linear-to-b from-white to-slate-50/70 p-4 transition-shadow hover:shadow-md sm:p-5"
                                    >
                                        <div className="mb-4 flex items-center justify-between gap-2">
                                            <h3 className="min-w-0 font-bold text-slate-900">
                                                {item.name}
                                            </h3>
                                            <span className="shrink-0 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-800">
                                                {item.percentage}%
                                            </span>
                                        </div>

                                        <ProgressBar value={item.percentage} />

                                        <p className="mt-3 text-xs leading-5 text-slate-500">
                                            {item.checked} of {item.possible} prayers completed
                                        </p>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMonth(new Date(year, item.monthNumber, 1));
                                                setViewMode("monthly");
                                            }}
                                            className="mt-4 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-emerald-300 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                                        >
                                            View month
                                        </button>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {viewMode === "qada" && (
                    <div className="space-y-5 sm:space-y-6">
                        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                            <SectionHeading
                                title="Qada prayer backlog"
                                description="Keep track of missed prayers and update your counts as you make them up."
                            />

                            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:min-w-44">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                    Total remaining
                                </p>
                                <p className="mt-1 text-2xl font-extrabold text-emerald-800">
                                    {totalQadaCount}
                                    <span className="ml-1.5 text-sm font-semibold text-slate-500">
                                        prayers
                                    </span>
                                </p>
                            </div>
                        </div>

                        {qadaLoading || !qadaData ? (
                            <LoadingState message="Loading your Qada backlog..." />
                        ) : (
                            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                                {prayers.map((prayer) => {
                                    const count = qadaData[prayer.key];

                                    return (
                                        <article
                                            key={prayer.key}
                                            className="flex min-w-0 flex-col justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <h3 className="font-bold text-slate-900">
                                                        {prayer.label}
                                                    </h3>
                                                    <p
                                                        lang="ar"
                                                        dir="rtl"
                                                        className="mt-1 text-sm text-emerald-700"
                                                    >
                                                        {prayer.arabic}
                                                    </p>
                                                </div>
                                                <span className="flex h-12 min-w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 px-3 text-xl font-extrabold text-emerald-800">
                                                    {count}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
                                                <button
                                                    type="button"
                                                    disabled={qadaSaving || count <= 0}
                                                    onClick={() =>
                                                        void updateQadaCount(prayer.key, -1)
                                                    }
                                                    className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                                                >
                                                    −1 Made up
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={qadaSaving}
                                                    onClick={() =>
                                                        void updateQadaCount(prayer.key, 1)
                                                    }
                                                    className="min-h-11 rounded-xl bg-emerald-600 px-2 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                                                >
                                                    +1 Missed
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </section>

            <footer className="px-2 py-7 text-center text-xs leading-5 text-slate-400 sm:py-9">
                Your prayer records are synced to your account.
                <span className="mt-1 block">
                    May your consistency grow one prayer at a time.
                </span>
            </footer>
        </main>
    );
}
