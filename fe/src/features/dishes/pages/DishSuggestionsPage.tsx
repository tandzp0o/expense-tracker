/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useState } from "react";
import {
    Dices,
    MapPin,
    Plus,
    UtensilsCrossed,
} from "lucide-react";
import { auth } from "lib/firebase/config";
import { dishApi } from "services/api";
import { formatCurrency, formatWholeNumberInput } from "utils/formatters";
import { useLocale } from "contexts/LocaleContext";
import { useToast } from "contexts/ToastContext";
import { PageHeader } from "components/app/page-header";
import { EmptyState } from "components/app/empty-state";
import { ImageCarousel } from "components/app/image-carousel";
import {
    MediaCoverCard,
    overlayBadgeClassName,
} from "components/app/media-cover-card";
import { Button } from "components/ui/button";
import { Badge } from "components/ui/badge";
import { Card, CardContent } from "components/ui/card";
import { Spinner } from "components/ui/spinner";
import { preferenceOptions } from "../constants";
import { DeleteDishModal } from "../modals/DeleteDishModal";
import { DishFormModal } from "../modals/DishFormModal";
import { RandomDishModal } from "../modals/RandomDishModal";

interface Dish {
    _id: string;
    name: string;
    price?: number | null;
    description?: string;
    imageUrls: string[];
    preferences: string[];
    address?: string;
}

const DishSuggestions: React.FC = () => {
    const { language, isVietnamese } = useLocale();
    const { toast } = useToast();
    const [dishes, setDishes] = useState<Dish[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedPreferences, setSelectedPreferences] = useState<string[]>(
        [],
    );
    const [editingDish, setEditingDish] = useState<Dish | null>(null);
    const [pendingDelete, setPendingDelete] = useState<Dish | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [randomDish, setRandomDish] = useState<Dish | null>(null);
    const [priceInput, setPriceInput] = useState("");
    const [formValues, setFormValues] = useState({
        name: "",
        price: 0,
        description: "",
        address: "",
        preferences: [] as string[],
        existingImages: [] as string[],
        newImages: [] as File[],
    });

    const baseCopy = isVietnamese
        ? {
              pageTitle: "Gợi ý món ăn",
              pageDescription:
                  "Các thẻ món ăn dùng dishes API và vẫn giữ upload nhiều ảnh cùng ảnh cũ khi chỉnh sửa.",
              randomPick: "Chọn ngẫu nhiên",
              newDish: "Thêm món",
              filterByTaste: "Lọc theo vị:",
              noDescription: "Chưa có mô tả.",
              contact: "Liên hệ",
              imageCount: (count: number) => `${count} ảnh`,
              noAddress: "Chưa có địa chỉ",
              edit: "Chỉnh sửa",
              addFirstDish: "Thêm món đầu tiên",
              noDishes: "Không tìm thấy món",
              noDishesDesc: "Không có món nào khớp với bộ lọc vị hiện tại.",
              formDescription:
                  "Form data vẫn giữ cả URL ảnh cũ và file ảnh mới được upload.",
              editDish: "Chỉnh sửa món",
              createDish: "Tạo món",
              dishName: "Tên món",
              price: "Giá",
              description: "Mô tả",
              address: "Địa chỉ",
              tasteTags: "Thẻ hương vị",
              images: "Hình ảnh",
              remove: "Xóa",
              cancel: "Hủy",
              saving: "Đang lưu...",
              updateDish: "Cập nhật món",
              dishNameRequired: "Cần nhập tên món",
              dishNameRequiredDesc: "Vui lòng nhập tên món.",
              dishUpdated: "Đã cập nhật món",
              dishCreated: "Đã tạo món",
              saveFailed: "Lưu thất bại",
              saveFailedDesc: "Không thể lưu món ăn.",
              dishDeleted: "Đã xóa món",
              deleteFailed: "Xóa thất bại",
              deleteFailedDesc: "Không thể xóa món ăn.",
              noDishAvailable: "Không có món phù hợp",
              noDishAvailableDesc:
                  "Hãy chỉnh bộ lọc vị hoặc thêm nhiều món hơn.",
              randomDishTitle: "Gợi ý món ngẫu nhiên",
              randomDishDesc:
                  "Chọn ngẫu nhiên chỉ dùng danh sách món đang được lọc hiện tại.",
              keep: "Giữ lại",
              delete: "Xóa",
              deleteDish: "Xóa món",
              deleteDishDesc: (name: string) => `Xóa món "${name}"?`,
              loadFailed: "Không thể tải món ăn",
              retry: "Vui lòng thử lại.",
          }
        : {
              pageTitle: "Dish suggestions",
              pageDescription:
                  "Dish cards use the dishes API and keep multi-image upload with existing image retention on edit.",
              randomPick: "Random pick",
              newDish: "New dish",
              filterByTaste: "Filter by taste:",
              noDescription: "No description provided.",
              contact: "Contact",
              imageCount: (count: number) => `${count} image(s)`,
              noAddress: "No address yet",
              edit: "Edit",
              addFirstDish: "Add first dish",
              noDishes: "No dishes found",
              noDishesDesc: "No dish matches the current taste filters.",
              formDescription:
                  "Form data keeps both existing image URLs and newly uploaded image files.",
              editDish: "Edit dish",
              createDish: "Create dish",
              dishName: "Dish name",
              price: "Price",
              description: "Description",
              address: "Address",
              tasteTags: "Taste tags",
              images: "Images",
              remove: "Remove",
              cancel: "Cancel",
              saving: "Saving...",
              updateDish: "Update dish",
              dishNameRequired: "Dish name required",
              dishNameRequiredDesc: "Please enter a dish name.",
              dishUpdated: "Dish updated",
              dishCreated: "Dish created",
              saveFailed: "Save failed",
              saveFailedDesc: "Dish could not be saved.",
              dishDeleted: "Dish deleted",
              deleteFailed: "Delete failed",
              deleteFailedDesc: "Dish could not be deleted.",
              noDishAvailable: "No dish available",
              noDishAvailableDesc:
                  "Adjust the taste filters or add more dishes.",
              randomDishTitle: "Random dish suggestion",
              randomDishDesc:
                  "Random pick uses only the currently filtered dish list.",
              keep: "Keep",
              delete: "Delete",
              deleteDish: "Delete dish",
              deleteDishDesc: (name: string) => `Delete dish "${name}"?`,
              loadFailed: "Could not load dishes",
              retry: "Please retry.",
          };
    const copy = {
        ...baseCopy,
        pageDescription: isVietnamese
            ? "Lưu các món yêu thích, hình ảnh và gu ăn uống để chọn nhanh hơn."
            : "Save favorite dishes, photos, and taste tags for faster picks.",
        formDescription: isVietnamese
            ? "Nhập thông tin món ăn, địa điểm và hình ảnh muốn lưu."
            : "Add the dish details, location, and photos you want to keep.",
        randomDishDesc: isVietnamese
            ? "Chọn ngẫu nhiên một món trong danh sách đang hiển thị."
            : "Pick a random dish from the list currently on screen.",
    };
    const loadFailedTitle = isVietnamese
        ? "Không thể tải món ăn"
        : "Could not load dishes";
    const retryText = isVietnamese ? "Vui lòng thử lại." : "Please retry.";

    const getPreferenceLabel = (preference: string) => {
        const match = preferenceOptions.find(
            (item) => item.value === preference,
        );
        if (!match) {
            return preference;
        }
        return language === "vi" ? match.vi : match.en;
    };

    const fetchDishes = async () => {
        setLoading(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                return;
            }
            const data = await dishApi.getDishes(undefined, token);
            setDishes(Array.isArray(data) ? data : []);
        } catch (error: any) {
            toast({
                title: loadFailedTitle,
                description: error.message || retryText,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    // Locale-derived error labels are intentionally reduced to stable primitives above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        const loadInitialDishes = async () => {
            setLoading(true);
            try {
                const token = await auth.currentUser?.getIdToken();
                if (!token) {
                    return;
                }
                const data = await dishApi.getDishes(undefined, token);
                setDishes(Array.isArray(data) ? data : []);
            } catch (error: any) {
                toast({
                    title: loadFailedTitle,
                    description: error.message || retryText,
                    variant: "destructive",
                });
            } finally {
                setLoading(false);
            }
        };

        void loadInitialDishes();
    }, [isVietnamese, loadFailedTitle, retryText, toast]);

    const filteredDishes = useMemo(() => {
        if (selectedPreferences.length === 0) {
            return dishes;
        }
        return dishes.filter((dish) =>
            dish.preferences.some((preference) =>
                selectedPreferences.includes(preference),
            ),
        );
    }, [dishes, selectedPreferences]);

    const resetForm = () => {
        setEditingDish(null);
        setPriceInput("");
        setFormValues({
            name: "",
            price: 0,
            description: "",
            address: "",
            preferences: [],
            existingImages: [],
            newImages: [],
        });
    };

    const handleOpenModal = (dish: Dish | null = null) => {
        if (dish) {
            setEditingDish(dish);
            setFormValues({
                name: dish.name,
                price: dish.price || 0,
                description: dish.description || "",
                address: dish.address || "",
                preferences: dish.preferences || [],
                existingImages: dish.imageUrls || [],
                newImages: [],
            });
            setPriceInput(
                dish.price ? formatWholeNumberInput(dish.price) : "",
            );
        } else {
            resetForm();
        }
        setModalOpen(true);
    };

    const handlePriceChange = (value: string, numericValue: number) => {
        setPriceInput(value);
        setFormValues((current) => ({
            ...current,
            price: numericValue,
        }));
    };

    const handleTogglePreference = (preference: string) => {
        setFormValues((current) => ({
            ...current,
            preferences: current.preferences.includes(preference)
                ? current.preferences.filter((item) => item !== preference)
                : [...current.preferences, preference],
        }));
    };

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        setFormValues((current) => ({
            ...current,
            newImages: [...current.newImages, ...files],
        }));
    };

    const handleSubmit = async () => {
        if (!formValues.name.trim()) {
            toast({
                title: copy.dishNameRequired,
                description: copy.dishNameRequiredDesc,
                variant: "destructive",
            });
            return;
        }

        setSaving(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                return;
            }

            const formData = new FormData();
            formData.append("name", formValues.name);
            formData.append("description", formValues.description);
            formData.append(
                "price",
                formValues.price ? String(formValues.price) : "",
            );
            formData.append(
                "preferences",
                JSON.stringify(formValues.preferences),
            );
            formData.append("address", formValues.address);
            formData.append(
                "existingImages",
                JSON.stringify(formValues.existingImages),
            );
            formValues.newImages.forEach((image) => {
                formData.append("images", image);
            });

            if (editingDish) {
                await dishApi.updateDish(editingDish._id, formData, token);
                toast({
                    title: copy.dishUpdated,
                    variant: "success",
                });
            } else {
                await dishApi.createDish(formData, token);
                toast({
                    title: copy.dishCreated,
                    variant: "success",
                });
            }

            setModalOpen(false);
            resetForm();
            await fetchDishes();
        } catch (error: any) {
            toast({
                title: copy.saveFailed,
                description: error.message || copy.saveFailedDesc,
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!pendingDelete) {
            return;
        }
        setSaving(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                return;
            }
            await dishApi.deleteDish(pendingDelete._id, token);
            toast({
                title: copy.dishDeleted,
                variant: "success",
            });
            setPendingDelete(null);
            await fetchDishes();
        } catch (error: any) {
            toast({
                title: copy.deleteFailed,
                description: error.message || copy.deleteFailedDesc,
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const handleRandomDish = () => {
        if (filteredDishes.length === 0) {
            toast({
                title: copy.noDishAvailable,
                description: copy.noDishAvailableDesc,
                variant: "destructive",
            });
            return;
        }

        const nextDish =
            filteredDishes[Math.floor(Math.random() * filteredDishes.length)];
        setRandomDish(nextDish);
    };

    if (loading) {
        return (
            <div className="flex min-h-[420px] items-center justify-center">
                <Spinner className="h-8 w-8" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="space-y-3 lg:hidden">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">
                            {copy.pageTitle}
                        </h1>
                        <p className="hidden md:block mt-1 text-sm text-muted-foreground">
                            {copy.pageDescription}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            onClick={handleRandomDish}
                            size="sm"
                            variant="outline"
                        >
                            <Dices className="h-4 w-4" />
                        </Button>
                        <Button onClick={() => handleOpenModal()} size="sm">
                            <Plus className="h-4 w-4" />
                            {copy.newDish}
                        </Button>
                    </div>
                </div>
            </div>

            <PageHeader
                actions={
                    <>
                        <Button onClick={handleRandomDish} variant="outline">
                            <Dices className="h-4 w-4" />
                            {copy.randomPick}
                        </Button>
                        <Button onClick={() => handleOpenModal()}>
                            <Plus className="h-4 w-4" />
                            {copy.newDish}
                        </Button>
                    </>
                }
                description={copy.pageDescription}
                hideTitleOnMobile
                title={copy.pageTitle}
            />

            <Card>
                <CardContent className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="mr-2 text-sm font-medium text-muted-foreground">
                            {copy.filterByTaste}
                        </p>
                        {preferenceOptions.map((preference) => {
                            const active = selectedPreferences.includes(
                                preference.value,
                            );
                            return (
                                <button
                                    key={preference.value}
                                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                                        active
                                            ? "border-primary bg-primary-soft text-primary"
                                            : "border-border text-muted-foreground hover:bg-muted/70"
                                    }`}
                                    onClick={() =>
                                        setSelectedPreferences((current) =>
                                            current.includes(preference.value)
                                                ? current.filter(
                                                      (item) =>
                                                          item !==
                                                          preference.value,
                                                  )
                                                : [
                                                      ...current,
                                                      preference.value,
                                                  ],
                                        )
                                    }
                                    type="button"
                                >
                                    {language === "vi"
                                        ? preference.vi
                                        : preference.en}
                                </button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {filteredDishes.length > 0 ? (
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {filteredDishes.map((dish) => (
                        <MediaCoverCard
                            key={dish._id}
                            editLabel={copy.edit}
                            footerLeading={
                                <div className="flex min-w-0 items-center gap-2">
                                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">
                                        {dish.address || copy.noAddress}
                                    </span>
                                </div>
                            }
                            media={
                                <ImageCarousel
                                    alt={dish.name}
                                    fallback={
                                        <div className="flex h-full w-full items-center justify-center bg-primary-soft text-primary">
                                            <UtensilsCrossed className="h-10 w-10" />
                                        </div>
                                    }
                                    images={dish.imageUrls}
                                />
                            }
                            onDelete={() => setPendingDelete(dish)}
                            onEdit={() => handleOpenModal(dish)}
                            subtitle={dish.description || copy.noDescription}
                            tags={dish.preferences.map((preference) => ({
                                key: preference,
                                label: getPreferenceLabel(preference),
                            }))}
                            title={dish.name}
                            topBadges={
                                <>
                                    <Badge
                                        className={overlayBadgeClassName}
                                        variant="outline"
                                    >
                                        {copy.imageCount(dish.imageUrls.length)}
                                    </Badge>
                                    {dish.price ? (
                                        <Badge
                                            className="border-white/15 bg-emerald-500/18 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm"
                                            variant="outline"
                                        >
                                            {formatCurrency(dish.price)}
                                        </Badge>
                                    ) : (
                                        <Badge
                                            className={overlayBadgeClassName}
                                            variant="outline"
                                        >
                                            {copy.contact}
                                        </Badge>
                                    )}
                                </>
                            }
                        />
                    ))}
                </div>
            ) : (
                <EmptyState
                    actionLabel={copy.addFirstDish}
                    description={copy.noDishesDesc}
                    icon={UtensilsCrossed}
                    onAction={() => handleOpenModal()}
                    title={copy.noDishes}
                />
            )}

            <DishFormModal
                copy={copy}
                editing={editingDish}
                formValues={formValues}
                isVietnamese={isVietnamese}
                language={language}
                onClose={() => setModalOpen(false)}
                onFormValuesChange={setFormValues}
                onImageUpload={handleImageUpload}
                onPriceChange={handlePriceChange}
                onSubmit={() => void handleSubmit()}
                onTogglePreference={handleTogglePreference}
                open={modalOpen}
                priceInput={priceInput}
                saving={saving}
            />

            <RandomDishModal
                copy={copy}
                dish={randomDish}
                getPreferenceLabel={getPreferenceLabel}
                isVietnamese={isVietnamese}
                onClose={() => setRandomDish(null)}
            />

            <DeleteDishModal
                copy={copy}
                dish={pendingDelete}
                onClose={() => setPendingDelete(null)}
                onConfirm={() => void handleDelete()}
                saving={saving}
            />
        </div>
    );
};

export default DishSuggestions;
