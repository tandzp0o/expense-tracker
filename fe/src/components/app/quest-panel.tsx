import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { useQuests } from "../../contexts/QuestContext";
import { useLocale } from "../../contexts/LocaleContext";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "../ui/card";
import { cn } from "../../lib/utils";

/**
 * Progress panel for the getting-started quests. Everything is derived from the
 * profile stats, so it always reflects what the account actually contains.
 */
export const QuestPanel: React.FC<{ className?: string }> = ({ className }) => {
    const { isVietnamese } = useLocale();
    const { quests, points, totalPoints, percent, level } = useQuests();
    const allDone = points >= totalPoints && totalPoints > 0;

    return (
        <Card className={className}>
            <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <CardTitle>
                            {isVietnamese
                                ? "Nhiệm vụ khởi đầu"
                                : "Getting started quests"}
                        </CardTitle>
                        <CardDescription>
                            {allDone
                                ? isVietnamese
                                    ? "Bạn đã hoàn thành mọi nhiệm vụ hướng dẫn. Chúc mừng!"
                                    : "You have completed every guided quest. Nicely done!"
                                : isVietnamese
                                  ? "Mỗi nhiệm vụ hoàn thành được 1 điểm. Đây chỉ là gợi ý, bạn không bắt buộc phải làm hết."
                                  : "Each completed quest is worth one point. These are suggestions, not requirements."}
                        </CardDescription>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-semibold leading-none text-primary">
                            {points}
                            <span className="text-base text-muted-foreground">
                                /{totalPoints}
                            </span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {isVietnamese ? `Cấp ${level}` : `Level ${level}`}
                        </p>
                    </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                        className={cn(
                            "h-full rounded-full transition-[width] duration-500",
                            allDone ? "bg-amber-500" : "bg-primary",
                        )}
                        style={{ width: `${percent}%` }}
                    />
                </div>
            </CardHeader>
            <CardContent className="space-y-2">
                {quests.map((quest) => {
                    const QuestIcon = quest.icon;
                    const showProgress = quest.target > 1 && !quest.done;

                    return (
                        <Link
                            className={cn(
                                "flex items-center gap-3 rounded-[var(--app-radius-md)] border px-3 py-3 transition-colors",
                                quest.done
                                    ? "border-emerald-500/30 bg-emerald-500/[0.07]"
                                    : "border-border/70 bg-background hover:bg-muted/60",
                            )}
                            key={quest.id}
                            to={quest.to}
                        >
                            <span
                                className={cn(
                                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                                    quest.done
                                        ? "bg-emerald-500 text-white"
                                        : "bg-muted text-muted-foreground",
                                )}
                            >
                                {quest.done ? (
                                    <Check className="h-4 w-4" />
                                ) : (
                                    <QuestIcon className="h-4 w-4" />
                                )}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span
                                    className={cn(
                                        "block text-sm font-medium",
                                        quest.done
                                            ? "text-muted-foreground line-through"
                                            : "text-foreground",
                                    )}
                                >
                                    {quest.title}
                                </span>
                                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                                    {quest.description}
                                </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                                {showProgress ? (
                                    <span className="text-xs font-medium text-muted-foreground">
                                        {quest.current}/{quest.target}
                                    </span>
                                ) : null}
                                {quest.done ? (
                                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                        +1
                                    </span>
                                ) : (
                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                )}
                            </span>
                        </Link>
                    );
                })}
            </CardContent>
        </Card>
    );
};

export default QuestPanel;
