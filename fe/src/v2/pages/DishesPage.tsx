import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dices,
  ImagePlus,
  MapPin,
  Pencil,
  Plus,
  ReceiptText,
  Soup,
  Trash2,
  X,
} from "lucide-react";
import { dishApi, getMonthRangeIso, transactionApi } from "services/api";
import { useLocale } from "contexts/LocaleContext";
import { useToast } from "contexts/ToastContext";
import { preferenceOptions } from "features/dishes/constants";
import { cn } from "lib/utils";
import {
  Button,
  Chip,
  EmptyState,
  Eyebrow,
  FieldLabel,
  Money,
  PageHeader,
  Section,
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

/** A soft coloured stand-in, so a dish without a photo still has a face. */
const DishCover: React.FC<{ dish: Dish; className?: string }> = ({ dish, className }) => {
  const image = dish.imageUrls?.[0];
  const hue = Array.from(dish.name).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;

  return image ? (
    <img alt="" className={cn("h-full w-full object-cover", className)} src={image} />
  ) : (
    <div
      className={cn("flex h-full w-full items-center justify-center", className)}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 92%), hsl(${(hue + 40) % 360} 70% 86%))` }}
    >
      <Soup className="h-9 w-9" style={{ color: `hsl(${hue} 45% 45%)` }} />
    </div>
  );
};

/**
 * Saved dishes and places, tied back to spending: every dish can be recorded
 * as an expense in one tap, and the side pane shows what eating out actually
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

  const visibleDishes = useMemo(
    () =>
      tastes.length
        ? dishes.filter((dish) => tastes.some((taste) => dish.preferences?.includes(taste)))
        : dishes,
    [dishes, tastes],
  );

  const eatingOut = useMemo(() => {
    const total = foodTransactions.reduce((sum, item) => sum + toAmount(item.amount), 0);
    // How often each saved dish shows up in this month's food notes. Only
    // dishes that actually appear are listed; nothing is guessed.
    const counts = dishes
      .map((dish) => {
        const needle = normalize(dish.name);
        const matches = foodTransactions.filter((item) => normalize(item.note || "").includes(needle));
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

  const summary = (
    <div>
      <Eyebrow>{t(`Ăn uống · ${monthLabel(month, year, true).toLowerCase()}`, `Food · ${monthLabel(month, year, false)}`)}</Eyebrow>
      <p className="mt-1.5 text-[34px] font-semibold leading-none tracking-[-0.03em]">
        <Money amount={eatingOut.total} />
      </p>
      <p className="mt-2 text-[13px] text-ledger-ink-2">
        {eatingOut.count
          ? t(
              `${eatingOut.count} lần · trung bình ${formatMoney(Math.round(eatingOut.total / eatingOut.count / 1000) * 1000)}`,
              `${eatingOut.count} times · about ${formatMoney(Math.round(eatingOut.total / eatingOut.count / 1000) * 1000)} each`,
            )
          : t("Chưa ghi khoản ăn uống nào tháng này.", "No food spending recorded this month.")}
      </p>
    </div>
  );

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

      <div className="ledger-scroll-x -mx-1 flex gap-2 border-b border-ledger-line px-1 py-4">
        <Chip onClick={() => setTastes([])} selected={!tastes.length}>
          {t("Tất cả", "All")}
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

      <div className="grid gap-x-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 py-6">
          {/* On a phone the month's food spending comes first, as one line. */}
          <div className="mb-6 border-b border-ledger-line pb-6 lg:hidden">{summary}</div>

          {loading ? (
            <SkeletonRows rows={4} />
          ) : !dishes.length ? (
            <EmptyState
              action={<Button icon={Plus} onClick={openCreate}>{t("Thêm món đầu tiên", "Add your first dish")}</Button>}
              description={t(
                "Lưu món và quán bạn hay ăn, kèm giá. Lần sau ghi chi chỉ cần một chạm.",
                "Save the dishes you often eat, with their price. Recording them later takes one tap.",
              )}
              icon={Soup}
              title={t("Chưa có món nào", "No dishes yet")}
            />
          ) : !visibleDishes.length ? (
            <EmptyState
              action={<Button onClick={() => setTastes([])} variant="outline">{t("Bỏ lọc", "Clear filter")}</Button>}
              icon={Soup}
              title={t("Không có món hợp khẩu vị này", "Nothing matches that taste")}
            />
          ) : (
            <>
            {/* Phones get compact rows: a list of big covers turned six dishes
                into a long scroll, and people pick a dish by its name. */}
            <div className="sm:hidden">
              {visibleDishes.map((dish) => (
                <div className="flex items-center gap-3 border-b border-ledger-line py-3 last:border-b-0" key={dish._id}>
                  <button
                    aria-label={t(`Sửa ${dish.name}`, `Edit ${dish.name}`)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => openEdit(dish)}
                    type="button"
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[10px]">
                      <DishCover dish={dish} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[14.5px] font-medium text-ledger-ink">{dish.name}</p>
                      <p className="truncate text-[12.5px] text-ledger-muted">
                        {[dish.price ? formatMoney(toAmount(dish.price)) : "", dish.address]
                          .filter(Boolean)
                          .join(" · ") ||
                          (dish.preferences || []).map(tasteLabel).join(", ")}
                      </p>
                    </div>
                  </button>
                  <Button className="shrink-0" icon={ReceiptText} onClick={() => recordDish(dish)} size="sm" variant="soft">
                    {t("Ghi chi", "Record")}
                  </Button>
                </div>
              ))}
            </div>
            <div className="hidden grid-cols-2 gap-x-6 gap-y-8 sm:grid xl:grid-cols-3">
              {visibleDishes.map((dish) => (
                <article className="group min-w-0" key={dish._id}>
                  <div className="relative aspect-[16/10] max-w-full overflow-hidden rounded-[12px] bg-ledger-canvas">
                    <DishCover dish={dish} />
                    <div className="absolute right-2 top-2 flex gap-1 lg:opacity-0 lg:transition-opacity lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
                      <button
                        aria-label={t("Sửa", "Edit")}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm"
                        onClick={() => openEdit(dish)}
                        type="button"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        aria-label={t("Xoá", "Delete")}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-rose-600 shadow-sm"
                        onClick={() => setPendingDelete(dish)}
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-semibold text-ledger-ink">{dish.name}</h3>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-ledger-muted">
                        {dish.price ? <Money amount={toAmount(dish.price)} tone="muted" /> : null}
                        {dish.price && dish.address ? " · " : null}
                        {dish.address ? (
                          <span className="inline-flex min-w-0 items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{dish.address}</span>
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <Button className="shrink-0" icon={ReceiptText} onClick={() => recordDish(dish)} size="sm" variant="soft">
                      {t("Ghi chi", "Record")}
                    </Button>
                  </div>
                  {dish.preferences?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {dish.preferences.map((taste) => (
                        <span className="rounded-full bg-ledger-canvas px-2 py-0.5 text-[11.5px] text-ledger-ink-2" key={taste}>
                          {tasteLabel(taste)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
            </>
          )}
        </div>

        <aside className="hidden min-w-0 lg:block lg:border-l lg:border-ledger-line lg:pl-8">
          <Section bare title={t("Ăn ngoài tháng này", "Eating out this month")}>
            {summary}
            {eatingOut.counts.length ? (
              <div className="mt-5">
                <Eyebrow>{t("Món ghi nhiều nhất", "Most recorded")}</Eyebrow>
                <div className="mt-1">
                  {eatingOut.counts.map((row) => (
                    <div className="flex items-center justify-between gap-3 border-b border-ledger-line py-2.5 last:border-b-0" key={row.dish._id}>
                      <span className="truncate text-[13.5px] text-ledger-ink">{row.dish.name}</span>
                      <span className="shrink-0 text-[12.5px] text-ledger-muted">
                        {t(`${row.count} lần`, `${row.count}×`)} · <Money amount={row.spent} tone="muted" />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <p className="mt-5 rounded-[12px] bg-ledger-accent-wash px-3.5 py-3 text-[13px] leading-snug text-ledger-ink">
              {t(
                "Bấm “Ghi chi” trên một món để ghi khoản chi với sẵn tên món và giá.",
                "Press “Record” on a dish to log it with its name and price filled in.",
              )}
            </p>
          </Section>
        </aside>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <FieldLabel>{t("Khẩu vị", "Taste")}</FieldLabel>
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
            <FieldLabel>{t("Ảnh", "Photos")}</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {form.existingImages.map((url) => (
                <div className="relative h-20 w-20 overflow-hidden rounded-[10px]" key={url}>
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
                <div className="relative h-20 w-20 overflow-hidden rounded-[10px]" key={`${file.name}-${index}`}>
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
                className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-ledger-line-strong text-[11.5px] text-ledger-muted hover:text-ledger-ink"
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
          {formError ? <p className="text-[13px] text-ledger-out">{formError}</p> : null}
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
            <div className="aspect-[16/10] max-w-full overflow-hidden rounded-[14px]">
              <DishCover dish={picked} />
            </div>
            <h3 className="mt-4 text-[22px] font-semibold tracking-[-0.02em] text-ledger-ink">{picked.name}</h3>
            <p className="mt-1 text-[13.5px] text-ledger-ink-2">
              {[picked.price ? formatMoney(toAmount(picked.price)) : "", picked.address].filter(Boolean).join(" · ")}
            </p>
            {picked.description ? <p className="mt-3 text-[14px] text-ledger-ink-2">{picked.description}</p> : null}
            <p className="mt-4 text-[12.5px] text-ledger-muted">
              {tastes.length
                ? t("Chọn trong các món hợp khẩu vị đang lọc.", "Picked from the dishes matching your filter.")
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
