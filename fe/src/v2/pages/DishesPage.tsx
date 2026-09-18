import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dices,
  ImagePlus,
  Lightbulb,
  MapPin,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Soup,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { dishApi, getMonthRangeIso, transactionApi } from "services/api";
import { useLocale } from "contexts/LocaleContext";
import { useTheme } from "contexts/ThemeContext";
import { useToast } from "contexts/ToastContext";
import { preferenceOptions } from "features/dishes/constants";
import { cn } from "lib/utils";
import {
  Button,
  Card,
  CardHeader,
  Chip,
  EmptyState,
  FieldLabel,
  Money,
  Notice,
  PageHeader,
  SkeletonRows,
  TextInput,
} from "../components/primitives";
import { ConfirmDialog, Panel } from "../components/overlays";
import { useLedger } from "../LedgerContext";
import {
  currentMonth,
  formatAmountInput,
  formatMoney,
  monthLabel,
  parseAmountInput,
} from "../lib/format";
import { useT } from "../lib/i18n";
import { getIdToken } from "../lib/session";
import { toAmount, type Transaction } from "../lib/types";

interface Dish {
  _id: string;
  name: string;
  price?: number | null;
  description?: string;
  imageUrls?: string[];
  preferences?: string[];
  address?: string;
}

interface DishForm {
  name: string;
  price: number;
  address: string;
  description: string;
  preferences: string[];
  existingImages: string[];
  newImages: File[];
}

const EMPTY_FORM: DishForm = {
  name: "",
  price: 0,
  address: "",
  description: "",
  preferences: [],
  existingImages: [],
  newImages: [],
};

// The food category every dish expense is filed under.
const FOOD_CATEGORY = "Ăn uống";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase()
    .trim();

/**
 * The dish's photo, or a soft coloured stand-in so a dish without one still
 * has a face. The stand-in is dimmed in dark mode, where a pastel block would
 * be the brightest thing on the screen.
 */
const DishCover: React.FC<{ dish: Dish; className?: string; iconClassName?: string }> = ({
  dish,
  className,
  iconClassName = "h-6 w-6",
}) => {
  const { appearance } = useTheme();
  const dark = appearance.mode === "dark";
  const image = dish.imageUrls?.[0];
  const hue = Array.from(dish.name).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;

  return image ? (
    <img alt="" className={cn("h-full w-full object-cover", className)} src={image} />
  ) : (
    <div
      className={cn("flex h-full w-full items-center justify-center", className)}
      style={{
        background: dark
          ? `linear-gradient(135deg, hsl(${hue} 32% 22%), hsl(${(hue + 40) % 360} 32% 17%))`
          : `linear-gradient(135deg, hsl(${hue} 70% 93%), hsl(${(hue + 40) % 360} 70% 87%))`,
      }}
    >
      <Soup
        className={iconClassName}
        style={{ color: dark ? `hsl(${hue} 55% 72%)` : `hsl(${hue} 45% 42%)` }}
      />
    </div>
  );
};

/** A taste as a small grey pill, the same on the cards and in the picker. */
const TastePill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="rounded-full bg-ledger-canvas px-2.5 py-0.5 text-[12.5px] font-medium text-ledger-ink-2">
    {children}
  </span>
);

const iconButtonClasses =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-ledger-line-strong bg-ledger-paper transition-colors";

/**
 * Saved dishes and places, tied back to spending: every dish can be recorded
 * as an expense in one tap, and the side card shows what eating out actually
 * cost this month, taken from real transactions rather than estimates.
 */
const DishesPage: React.FC = () => {
  const t = useT();
  const { isVietnamese, timezoneOffsetMinutes } = useLocale();
  const { toast } = useToast();
  const { openQuickAdd, dataVersion } = useLedger();
  const { month, year } = currentMonth(timezoneOffsetMinutes);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dishes, setDishes] = useState<Dish[]>([]);
  const [foodTransactions, setFoodTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tastes, setTastes] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Dish | null>(null);
  const [form, setForm] = useState<DishForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Dish | null>(null);
  const [picked, setPicked] = useState<Dish | null>(null);

  const fetchDishes = async () => {
    const token = await getIdToken();
    const data = await dishApi.getDishes(undefined, token);
    setDishes(Array.isArray(data) ? data : data?.data || []);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await getIdToken();
        const { startDate, endDate } = getMonthRangeIso(month, year, timezoneOffsetMinutes);
        const [dishResult, spendResult] = await Promise.allSettled([
          dishApi.getDishes(undefined, token),
          transactionApi.getTransactions(
            { category: FOOD_CATEGORY, type: "EXPENSE", status: "COMPLETED", startDate, endDate, page: 1, limit: 200 },
            token,
          ),
        ]);
        if (!active) {
          return;
        }
        if (dishResult.status === "fulfilled") {
          const data = dishResult.value;
          setDishes(Array.isArray(data) ? data : data?.data || []);
        }
        setFoodTransactions(
          spendResult.status === "fulfilled" ? spendResult.value?.data?.transactions || [] : [],
        );
      } catch (error: any) {
        toast({ title: t("Không tải được món ăn", "Could not load dishes"), description: error.message, variant: "destructive" });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [dataVersion, month, t, timezoneOffsetMinutes, toast, year]);

  // The search only narrows what is on screen; it never touches the saved
  // dishes. It matches without accents, so "bun bo" finds "Bún bò".
  const needle = normalize(query);
  const filtering = tastes.length > 0 || needle.length > 0;
  const visibleDishes = useMemo(
    () =>
      dishes.filter(
        (dish) =>
          (!tastes.length || tastes.some((taste) => dish.preferences?.includes(taste))) &&
          (!needle ||
            normalize(dish.name).includes(needle) ||
            normalize(dish.address || "").includes(needle)),
      ),
    [dishes, needle, tastes],
  );

  const eatingOut = useMemo(() => {
    const total = foodTransactions.reduce((sum, item) => sum + toAmount(item.amount), 0);
    // How often each saved dish shows up in this month's food notes. Only
    // dishes that actually appear are listed; nothing is guessed.
    const counts = dishes
      .map((dish) => {
        const name = normalize(dish.name);
        const matches = foodTransactions.filter((item) => normalize(item.note || "").includes(name));
        return {
          dish,
          count: matches.length,
          spent: matches.reduce((sum, item) => sum + toAmount(item.amount), 0),
        };
      })
      .filter((row) => row.count > 0)
      .sort((left, right) => right.count - left.count)
      .slice(0, 3);
    return { total, count: foodTransactions.length, counts };
  }, [dishes, foodTransactions]);

  const tasteLabel = (value: string) => {
    const option = preferenceOptions.find((item) => item.value === value);
    return option ? (isVietnamese ? option.vi : option.en) : value;
  };

  const recordDish = (dish: Dish) =>
    openQuickAdd({
      mode: "EXPENSE",
      category: FOOD_CATEGORY,
      amount: toAmount(dish.price) || undefined,
      note: dish.name,
    });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (dish: Dish) => {
    setEditing(dish);
    setForm({
      name: dish.name,
      price: toAmount(dish.price),
      address: dish.address || "",
      description: dish.description || "",
      preferences: dish.preferences || [],
      existingImages: dish.imageUrls || [],
      newImages: [],
    });
    setFormError("");
    setFormOpen(true);
  };

  const pickRandom = () => {
    if (!visibleDishes.length) {
      return;
    }
    // Avoid offering the same dish twice in a row when there is a choice.
    const pool =
      visibleDishes.length > 1 && picked
        ? visibleDishes.filter((dish) => dish._id !== picked._id)
        : visibleDishes;
    setPicked(pool[Math.floor(Math.random() * pool.length)]);
  };

  const clearFilters = () => {
    setTastes([]);
    setQuery("");
  };

  const save = async () => {
    if (!form.name.trim()) {
      setFormError(t("Hãy đặt tên cho món.", "Give the dish a name."));
      return;
    }
    setSaving(true);
    try {
      const token = await getIdToken();
      const formData = new FormData();
      formData.append("name", form.name.trim());
      formData.append("description", form.description);
      formData.append("price", form.price ? String(form.price) : "");
      formData.append("preferences", JSON.stringify(form.preferences));
      formData.append("address", form.address);
      formData.append("existingImages", JSON.stringify(form.existingImages));
      form.newImages.forEach((image) => formData.append("images", image));

      if (editing) {
        await dishApi.updateDish(editing._id, formData, token);
      } else {
        await dishApi.createDish(formData, token);
      }
      toast({ title: editing ? t("Đã lưu món", "Dish saved") : t("Đã thêm món", "Dish added"), variant: "success" });
      setFormOpen(false);
      await fetchDishes();
    } catch (error: any) {
      setFormError(error.message || t("Chưa lưu được món.", "Could not save the dish."));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    setSaving(true);
    try {
      await dishApi.deleteDish(pendingDelete._id, await getIdToken());
      toast({ title: t("Đã xoá món", "Dish deleted"), variant: "success" });
      setPendingDelete(null);
      setFormOpen(false);
      await fetchDishes();
    } catch (error: any) {
      toast({ title: t("Chưa xoá được", "Could not delete"), description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const average = eatingOut.count
    ? Math.round(eatingOut.total / eatingOut.count / 1000) * 1000
    : 0;

  /* ------------------------------------------------------------ Pieces */

  const toolbar = (
    <Card className="p-3 sm:p-4" flush>
      {/* Search and tastes share a row only where the chips fit on one line;
          otherwise the chips get a row of their own rather than wrapping
          beside the field. */}
      <div className="flex flex-col gap-3 min-[1760px]:flex-row min-[1760px]:items-center min-[1760px]:gap-4">
        <div className="relative md:max-w-[440px] min-[1760px]:w-[320px] min-[1760px]:shrink-0">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ledger-muted" />
          <TextInput
            aria-label={t("Tìm món", "Search dishes")}
            className="border-ledger-line-strong pl-10 pr-10"
            enterKeyHint="search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Tìm theo tên món hoặc địa chỉ", "Search by name or address")}
            value={query}
          />
          {query ? (
            <button
              aria-label={t("Xoá tìm kiếm", "Clear search")}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-ledger-muted hover:bg-ledger-canvas hover:text-ledger-ink"
              onClick={() => setQuery("")}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {/* The taste chips scroll sideways on a phone instead of wrapping. */}
        <div className="ledger-scroll-x -mx-3 flex min-w-0 flex-1 gap-2 px-3 sm:-mx-4 sm:px-4 md:mx-0 md:flex-wrap md:px-0">
          <Chip onClick={() => setTastes([])} selected={!tastes.length}>
            {t("Mọi khẩu vị", "All tastes")}
          </Chip>
          {preferenceOptions.map((option) => (
            <Chip
              key={option.value}
              onClick={() =>
                setTastes((current) =>
                  current.includes(option.value)
                    ? current.filter((item) => item !== option.value)
                    : [...current, option.value],
                )
              }
              selected={tastes.includes(option.value)}
            >
              {isVietnamese ? option.vi : option.en}
            </Chip>
          ))}
        </div>
      </div>
      {!loading && dishes.length > 0 && filtering ? (
        <p className="mt-3 border-t border-ledger-line px-1 pt-3 text-[13px] text-ledger-ink-2">
          {t(
            `Đang hiện ${visibleDishes.length} trong ${dishes.length} món.`,
            `Showing ${visibleDishes.length} of ${dishes.length} dishes.`,
          )}{" "}
          <button className="font-medium text-ledger-accent hover:underline" onClick={clearFilters} type="button">
            {t("Bỏ lọc", "Clear filters")}
          </button>
        </p>
      ) : null}
    </Card>
  );

  const countLabel = filtering
    ? t(`${visibleDishes.length}/${dishes.length} món`, `${visibleDishes.length} of ${dishes.length}`)
    : String(dishes.length);

  const dishActions = (dish: Dish) => (
    <div className="flex items-center gap-2">
      <Button
        className="flex-1"
        icon={ReceiptText}
        onClick={() => recordDish(dish)}
        size="sm"
        variant="soft"
      >
        {t("Ghi chi", "Record")}
      </Button>
      <button
        aria-label={t(`Sửa ${dish.name}`, `Edit ${dish.name}`)}
        className={cn(iconButtonClasses, "text-ledger-ink-2 hover:bg-ledger-canvas hover:text-ledger-ink")}
        onClick={() => openEdit(dish)}
        title={t("Sửa", "Edit")}
        type="button"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        aria-label={t(`Xoá ${dish.name}`, `Delete ${dish.name}`)}
        className={cn(iconButtonClasses, "text-ledger-muted hover:border-ledger-out hover:bg-ledger-out-wash hover:text-ledger-out")}
        onClick={() => setPendingDelete(dish)}
        title={t("Xoá", "Delete")}
        type="button"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  /** A dish on a wide screen: its face and name, what it costs, where, how it tastes. */
  const dishCard = (dish: Dish) => (
    <Card as="div" className="flex flex-col p-4 xl:p-5" flush key={dish._id}>
      <div className="flex items-start gap-3.5">
        <button
          aria-label={t(`Sửa ${dish.name}`, `Edit ${dish.name}`)}
          className="h-16 w-16 shrink-0 overflow-hidden rounded-[14px]"
          onClick={() => openEdit(dish)}
          type="button"
        >
          <DishCover dish={dish} />
        </button>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="break-words text-[16px] font-semibold leading-snug tracking-[-0.01em] text-ledger-ink">
            {dish.name}
          </h3>
          <p className="mt-1 text-[15px] font-semibold">
            {dish.price ? (
              <Money amount={toAmount(dish.price)} />
            ) : (
              <span className="text-[13px] font-normal text-ledger-muted">{t("Chưa có giá", "No price")}</span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-3 flex-1 space-y-2.5">
        {dish.address ? (
          <p className="flex items-start gap-1.5 text-[13px] leading-snug text-ledger-ink-2">
            <MapPin className="mt-[1px] h-3.5 w-3.5 shrink-0 text-ledger-muted" />
            <span className="min-w-0 break-words">{dish.address}</span>
          </p>
        ) : null}
        {dish.preferences?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {dish.preferences.map((taste) => (
              <TastePill key={taste}>{tasteLabel(taste)}</TastePill>
            ))}
          </div>
        ) : null}
        {dish.description ? (
          <p className="line-clamp-2 text-[13px] leading-snug text-ledger-muted">{dish.description}</p>
        ) : null}
      </div>

      <div className="mt-4 border-t border-ledger-line pt-3.5">{dishActions(dish)}</div>
    </Card>
  );

  /** The same dish as a phone row: tap it to edit, "Ghi chi" to record it. */
  const dishRow = (dish: Dish) => (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0" key={dish._id}>
      <button
        aria-label={t(`Sửa ${dish.name}`, `Edit ${dish.name}`)}
        className="-mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-[12px] px-2 py-1 text-left hover:bg-ledger-hover"
        onClick={() => openEdit(dish)}
        type="button"
      >
        <div className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[12px]">
          <DishCover dish={dish} iconClassName="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="break-words text-[15px] font-semibold leading-snug text-ledger-ink">{dish.name}</p>
          <p className="mt-0.5 text-[13.5px] font-medium">
            {dish.price ? (
              <Money amount={toAmount(dish.price)} className="text-ledger-ink-2" tone="muted" />
            ) : (
              <span className="font-normal text-ledger-muted">{t("Chưa có giá", "No price")}</span>
            )}
          </p>
          {dish.address || dish.preferences?.length ? (
            <p className="truncate text-[12.5px] text-ledger-muted">
              {dish.address || (dish.preferences || []).map(tasteLabel).join(", ")}
            </p>
          ) : null}
        </div>
      </button>
      <Button icon={ReceiptText} onClick={() => recordDish(dish)} size="sm" variant="soft">
        {t("Ghi chi", "Record")}
      </Button>
    </div>
  );

  const summaryCard = (
    <Card>
      <CardHeader
        icon={UtensilsCrossed}
        subtitle={t(
          `Nhóm Ăn uống · ${monthLabel(month, year, true)}`,
          `Food category · ${monthLabel(month, year, false)}`,
        )}
        title={t("Ăn ngoài tháng này", "Eating out this month")}
        tone="spend"
      />
      {/* Under the dishes on a tablet the card is full width, so the total
          and the most recorded dishes sit side by side instead of the names
          running 700px away from their amounts. */}
      <div className="md:grid md:grid-cols-2 md:gap-x-10 xl:block">
        <div>
          <p className="text-[30px] font-semibold leading-none tracking-[-0.03em] text-ledger-ink 2xl:text-[34px]">
            {loading ? <span className="text-ledger-line-strong">—</span> : <Money amount={eatingOut.total} />}
          </p>
          <p className="mt-2.5 text-[13.5px] text-ledger-ink-2">
            {eatingOut.count
              ? t(
                  `${eatingOut.count} lần · trung bình ${formatMoney(average)} mỗi lần`,
                  `${eatingOut.count} times · about ${formatMoney(average)} each`,
                )
              : t("Chưa ghi khoản ăn uống nào tháng này.", "No food spending recorded this month.")}
          </p>
        </div>

        {eatingOut.counts.length ? (
          <div className="mt-5 border-t border-ledger-line pt-4 md:mt-0 md:border-t-0 md:pt-0 xl:mt-5 xl:border-t xl:pt-4">
            <p className="text-[13px] font-semibold text-ledger-ink-2">
              {t("Món ghi nhiều nhất", "Most recorded")}
            </p>
            <div className="mt-1 divide-y divide-ledger-line">
              {eatingOut.counts.map((row) => (
                <div className="flex items-center gap-3 py-2.5 last:pb-0" key={row.dish._id}>
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-[10px]">
                    <DishCover dish={row.dish} iconClassName="h-4 w-4" />
                  </div>
                  <span className="min-w-0 flex-1 break-words text-[14px] font-medium text-ledger-ink">
                    {row.dish.name}
                  </span>
                  <span className="shrink-0 text-right text-[12.5px] leading-snug text-ledger-muted">
                    <span className="block text-[13.5px] font-medium">
                      <Money amount={row.spent} />
                    </span>
                    {t(`${row.count} lần`, `${row.count}×`)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <Notice className="mt-5" icon={Lightbulb} tone="blue">
        {t(
          "Bấm “Ghi chi” trên một món để ghi khoản chi với sẵn tên món và giá.",
          "Press “Record” on a dish to log it with its name and price filled in.",
        )}
      </Notice>
    </Card>
  );

  let collection: React.ReactNode;
  if (loading) {
    collection = (
      <Card>
        <SkeletonRows rows={4} />
      </Card>
    );
  } else if (!dishes.length) {
    collection = (
      <Card>
        <EmptyState
          action={<Button icon={Plus} onClick={openCreate}>{t("Thêm món đầu tiên", "Add your first dish")}</Button>}
          description={t(
            "Lưu món và quán bạn hay ăn, kèm giá. Lần sau ghi chi chỉ cần một chạm.",
            "Save the dishes you often eat, with their price. Recording them later takes one tap.",
          )}
          icon={Soup}
          title={t("Chưa có món nào", "No dishes yet")}
        />
      </Card>
    );
  } else if (!visibleDishes.length) {
    collection = (
      <Card>
        <EmptyState
          action={<Button onClick={clearFilters} variant="outline">{t("Bỏ lọc", "Clear filters")}</Button>}
          description={t("Thử bỏ bớt khẩu vị hoặc đổi từ khoá.", "Try fewer tastes or another search.")}
          icon={Search}
          title={t("Không có món nào khớp", "Nothing matches")}
        />
      </Card>
    );
  } else {
    collection = (
      <>
        {/* Phones get one card of compact rows: separate cards with covers
            turned six dishes into a long scroll, and people pick by name. */}
        <Card className="md:hidden">
          <CardHeader icon={Soup} meta={countLabel} title={t("Món đã lưu", "Saved dishes")} tone="spend" />
          <div className="divide-y divide-ledger-line">{visibleDishes.map(dishRow)}</div>
        </Card>
        <div className="hidden gap-3 sm:gap-4 md:grid md:grid-cols-2 xl:gap-5 min-[1360px]:grid-cols-3 min-[1760px]:grid-cols-4">
          {visibleDishes.map(dishCard)}
        </div>
      </>
    );
  }

  return (
    <div>
      <PageHeader
        actions={
          <>
            <Button disabled={!visibleDishes.length} icon={Dices} onClick={pickRandom} variant="outline">
              {t("Chọn ngẫu nhiên", "Pick for me")}
            </Button>
            <Button icon={Plus} onClick={openCreate}>
              {t("Thêm món", "Add dish")}
            </Button>
          </>
        }
        subtitle={t(
          "Lưu quán quen để khỏi phải nghĩ hôm nay ăn gì",
          "Save the places you like so lunch is one less decision",
        )}
        title={t("Món ăn", "Dishes")}
      />

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start xl:gap-5 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-3 sm:space-y-4 xl:space-y-5">
          {toolbar}
          {collection}
        </div>

        {/* The month's food spending: beside the dishes on a wide screen,
            after them on a phone, where the dishes are the reason to come. */}
        <aside className="min-w-0 xl:sticky xl:top-6">{summaryCard}</aside>
      </div>

      <Panel
        footer={
          <div className="flex items-center gap-2">
            {editing ? (
              <Button icon={Trash2} onClick={() => setPendingDelete(editing)} variant="ghost">
                {t("Xoá", "Delete")}
              </Button>
            ) : null}
            <div className="ml-auto flex gap-2">
              <Button onClick={() => setFormOpen(false)} variant="ghost">{t("Huỷ", "Cancel")}</Button>
              <Button disabled={saving} onClick={() => void save()}>
                {saving ? t("Đang lưu...", "Saving...") : editing ? t("Lưu thay đổi", "Save changes") : t("Thêm món", "Add dish")}
              </Button>
            </div>
          </div>
        }
        onClose={() => setFormOpen(false)}
        open={formOpen}
        title={editing ? t("Sửa món", "Edit dish") : t("Món mới", "New dish")}
      >
        <div className="flex flex-col gap-5">
          <div>
            <FieldLabel htmlFor="dish-name">{t("Tên món", "Name")}</FieldLabel>
            <TextInput
              id="dish-name"
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder={t("Ví dụ: Bún bò Huế", "e.g. Bún bò Huế")}
              value={form.name}
            />
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-4">
            <div>
              <FieldLabel htmlFor="dish-price" hint={t("không bắt buộc", "optional")}>{t("Giá", "Price")}</FieldLabel>
              <div className="relative">
                <TextInput
                  className="ledger-num pr-9"
                  id="dish-price"
                  inputMode="numeric"
                  onChange={(event) => setForm((current) => ({ ...current, price: parseAmountInput(event.target.value) }))}
                  placeholder="0"
                  value={formatAmountInput(form.price)}
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ledger-muted">₫</span>
              </div>
            </div>
            <div>
              <FieldLabel htmlFor="dish-address" hint={t("không bắt buộc", "optional")}>{t("Địa chỉ", "Address")}</FieldLabel>
              <TextInput
                id="dish-address"
                onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                placeholder={t("Ví dụ: 23 Nguyễn Huệ", "e.g. 23 Nguyen Hue")}
                value={form.address}
              />
            </div>
          </div>
          <div>
            <FieldLabel hint={t("chọn nhiều", "pick any")}>{t("Khẩu vị", "Taste")}</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {preferenceOptions.map((option) => (
                <Chip
                  key={option.value}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      preferences: current.preferences.includes(option.value)
                        ? current.preferences.filter((item) => item !== option.value)
                        : [...current.preferences, option.value],
                    }))
                  }
                  selected={form.preferences.includes(option.value)}
                >
                  {isVietnamese ? option.vi : option.en}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel hint={t("không bắt buộc", "optional")}>{t("Ảnh", "Photos")}</FieldLabel>
            <div className="flex flex-wrap gap-2.5">
              {form.existingImages.map((url) => (
                <div className="relative h-20 w-20 overflow-hidden rounded-[12px]" key={url}>
                  <img alt="" className="h-full w-full object-cover" src={url} />
                  <button
                    aria-label={t("Bỏ ảnh", "Remove photo")}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                    onClick={() => setForm((current) => ({ ...current, existingImages: current.existingImages.filter((item) => item !== url) }))}
                    type="button"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {form.newImages.map((file, index) => (
                <div className="relative h-20 w-20 overflow-hidden rounded-[12px]" key={`${file.name}-${index}`}>
                  <img alt="" className="h-full w-full object-cover" src={URL.createObjectURL(file)} />
                  <button
                    aria-label={t("Bỏ ảnh", "Remove photo")}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                    onClick={() => setForm((current) => ({ ...current, newImages: current.newImages.filter((_, i) => i !== index) }))}
                    type="button"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-[12px] border border-dashed border-ledger-line-strong text-[12px] font-medium text-ledger-ink-2 transition-colors hover:border-ledger-accent hover:text-ledger-accent"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <ImagePlus className="h-5 w-5" />
                {t("Thêm ảnh", "Add")}
              </button>
              <input
                accept="image/*"
                className="hidden"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files || []);
                  setForm((current) => ({ ...current, newImages: [...current.newImages, ...files] }));
                  event.target.value = "";
                }}
                ref={fileInputRef}
                type="file"
              />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="dish-note" hint={t("không bắt buộc", "optional")}>{t("Ghi chú", "Notes")}</FieldLabel>
            <textarea
              className="min-h-[88px] w-full rounded-[10px] border border-ledger-line bg-ledger-paper px-3.5 py-2.5 text-[14px] text-ledger-ink outline-none placeholder:text-ledger-muted focus:border-ledger-accent"
              id="dish-note"
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder={t("Ví dụ: gọi thêm chả, đông vào buổi trưa", "e.g. busy at lunch")}
              value={form.description}
            />
          </div>
          {formError ? (
            <Notice icon={X} tone="rose">
              {formError}
            </Notice>
          ) : null}
        </div>
      </Panel>

      <Panel
        footer={
          <div className="flex items-center gap-2">
            <Button icon={Dices} onClick={pickRandom} variant="outline">{t("Chọn món khác", "Another one")}</Button>
            <Button
              className="ml-auto"
              icon={ReceiptText}
              onClick={() => {
                if (picked) {
                  recordDish(picked);
                }
                setPicked(null);
              }}
            >
              {t("Ghi khoản chi này", "Record it")}
            </Button>
          </div>
        }
        onClose={() => setPicked(null)}
        open={Boolean(picked)}
        title={t("Hôm nay ăn gì", "What to eat today")}
        width={440}
      >
        {picked ? (
          <div>
            {/* A real photo gets room; the stand-in only needs a band. */}
            <div
              className={cn(
                "overflow-hidden rounded-[16px]",
                picked.imageUrls?.[0] ? "aspect-[16/10]" : "h-28",
              )}
            >
              <DishCover dish={picked} iconClassName="h-9 w-9" />
            </div>
            <h3 className="mt-4 break-words text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ledger-ink">
              {picked.name}
            </h3>
            <p className="mt-1.5 text-[18px] font-semibold">
              {picked.price ? (
                <Money amount={toAmount(picked.price)} />
              ) : (
                <span className="text-[14px] font-normal text-ledger-muted">{t("Chưa có giá", "No price")}</span>
              )}
            </p>
            {picked.address ? (
              <p className="mt-3 flex items-start gap-1.5 text-[14px] text-ledger-ink-2">
                <MapPin className="mt-[3px] h-4 w-4 shrink-0 text-ledger-muted" />
                <span className="min-w-0 break-words">{picked.address}</span>
              </p>
            ) : null}
            {picked.preferences?.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {picked.preferences.map((taste) => (
                  <TastePill key={taste}>{tasteLabel(taste)}</TastePill>
                ))}
              </div>
            ) : null}
            {picked.description ? (
              <p className="mt-4 rounded-[12px] bg-ledger-canvas px-3.5 py-3 text-[14px] leading-relaxed text-ledger-ink-2">
                {picked.description}
              </p>
            ) : null}
            <p className="mt-5 text-[12.5px] text-ledger-muted">
              {filtering
                ? t("Chọn trong các món đang hiện theo bộ lọc.", "Picked from the dishes matching your filters.")
                : t("Chọn trong tất cả món đã lưu.", "Picked from all your saved dishes.")}
            </p>
          </div>
        ) : null}
      </Panel>

      <ConfirmDialog
        busy={saving}
        cancelLabel={t("Giữ lại", "Keep")}
        confirmLabel={t("Xoá món", "Delete")}
        description={t("Món và ảnh của nó sẽ bị xoá. Các giao dịch đã ghi không bị ảnh hưởng.", "The dish and its photos are removed. Recorded transactions stay as they are.")}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        open={Boolean(pendingDelete)}
        title={t(`Xoá "${pendingDelete?.name || ""}"?`, `Delete "${pendingDelete?.name || ""}"?`)}
      />
    </div>
  );
};

export default DishesPage;
