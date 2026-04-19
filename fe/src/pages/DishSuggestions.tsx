/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useState } from "react";
import {
    Dices,
    MapPin,
    PencilLine,
    Plus,
    Trash2,
    UtensilsCrossed,
} from "lucide-react";
import { auth } from "../firebase/config";
import { dishApi } from "../services/api";
import { formatCurrency } from "../utils/formatters";
import { useLocale } from "../contexts/LocaleContext";
import { useToast } from "../contexts/ToastContext";
import { PageHeader } from "../components/app/page-header";
import { EmptyState } from "../components/app/empty-state";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import { Dialog } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Spinner } from "../components/ui/spinner";
import { Textarea } from "../components/ui/textarea";

interface Dish {
    _id: string;
    name: string;
    price?: number | null;
    description?: string;
    imageUrls: string[];
    preferences: string[];
    address?: string;
}

const preferenceOptions = [
    { value: "ngot", vi: "Ngọt", en: "Sweet" },
    { value: "chua", vi: "Chua", en: "Sour" },
    { value: "cay", vi: "Cay", en: "Spicy" },
    { value: "man", vi: "Mặn", en: "Savory" },
    { value: "rau", vi: "Rau", en: "Vegetables" },
    { value: "thit", vi: "Thịt", en: "Meat" },
    { value: "hai san", vi: "Hải sản", en: "Seafood" },
    { value: "chay", vi: "Chay", en: "Vegetarian" },
] as const;

const DishSuggestions: React.FC = () => {
    const { language, isVietnamese } = useLocale();
    const { toast } = useToast();
    const [dishes, setDishes] = useState<Dish[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);
    const [editingDish, setEditingDish] = useState<Dish | null>(null);
    const [pendingDelete, setPendingDelete] = useState<Dish | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [randomDish, setRandomDish] = useState<Dish | null>(null);
    const [formValues, setFormValues] = useState({
        name: "",
        price: 0,
        description: "",
        address: "",
        preferences: [] as string[],
        existingImages: [] as string[],
        newImages: [] as File[],
    });

    const copy = isVietnamese
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
              noDishAvailableDesc: "Hãy chỉnh bộ lọc vị hoặc thêm nhiều món hơn.",
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
              noDishAvailableDesc: "Adjust the taste filters or add more dishes.",
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
    const loadFailedTitle = isVietnamese
        ? "Không thể tải món ăn"
        : "Could not load dishes";
    const retryText = isVietnamese ? "Vui lòng thử lại." : "Please retry.";

    const getPreferenceLabel = (preference: string) => {
        const match = preferenceOptions.find((item) => item.value === preference);
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
        } else {
            resetForm();
        }
        setModalOpen(true);
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
            formData.append("price", formValues.price ? String(formValues.price) : "");
            formData.append("preferences", JSON.stringify(formValues.preferences));
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
                title={copy.pageTitle}
            />

            <Card>
                <CardContent className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="mr-2 text-sm font-medium text-muted-foreground">
                            {copy.filterByTaste}
                        </p>
                        {preferenceOptions.map((preference) => {
                            const active = selectedPreferences.includes(preference.value);
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
                                                ? current.filter((item) => item !== preference.value)
                                                : [...current, preference.value],
                                        )
                                    }
                                    type="button"
                                >
                                    {language === "vi" ? preference.vi : preference.en}
                                </button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {filteredDishes.length > 0 ? (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {filteredDishes.map((dish) => (
                        <Card key={dish._id} className="overflow-hidden">
                            <div className="aspect-[16/10] bg-muted">
                                {dish.imageUrls[0] ? (
                                    <img
                                        alt={dish.name}
                                        className="h-full w-full object-cover"
                                        src={dish.imageUrls[0]}
                                    />
                                ) : (
                                    <div className="flex h-full items-center justify-center bg-primary-soft text-primary">
                                        <UtensilsCrossed className="h-10 w-10" />
                                    </div>
                                )}
                            </div>
                            <CardContent className="space-y-4 p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-lg font-semibold">{dish.name}</h3>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {dish.description || copy.noDescription}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-primary">
                                            {dish.price ? formatCurrency(dish.price) : copy.contact}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {copy.imageCount(dish.imageUrls.length)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {dish.preferences.map((preference) => (
                                        <Badge key={preference} variant="outline">
                                            {getPreferenceLabel(preference)}
                                        </Badge>
                                    ))}
                                </div>

                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <MapPin className="h-4 w-4" />
                                    <span>{dish.address || copy.noAddress}</span>
                                </div>

                                <div className="flex items-center justify-between border-t border-border pt-4">
                                    <Button
                                        onClick={() => handleOpenModal(dish)}
                                        variant="outline"
                                    >
                                        <PencilLine className="h-4 w-4" />
                                        {copy.edit}
                                    </Button>
                                    <Button
                                        onClick={() => setPendingDelete(dish)}
                                        variant="ghost"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
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

            <Dialog
                description={copy.formDescription}
                onClose={() => setModalOpen(false)}
                open={modalOpen}
                title={editingDish ? copy.editDish : copy.createDish}
            >
                <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-2 block text-sm font-medium">{copy.dishName}</label>
                            <Input
                                onChange={(event) =>
                                    setFormValues((current) => ({
                                        ...current,
                                        name: event.target.value,
                                    }))
                                }
                                value={formValues.name}
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium">{copy.price}</label>
                            <Input
                                min={0}
                                onChange={(event) =>
                                    setFormValues((current) => ({
                                        ...current,
                                        price: Number(event.target.value) || 0,
                                    }))
                                }
                                type="number"
                                value={formValues.price}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium">{copy.description}</label>
                        <Textarea
                            onChange={(event) =>
                                setFormValues((current) => ({
                                    ...current,
                                    description: event.target.value,
                                }))
                            }
                            value={formValues.description}
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium">{copy.address}</label>
                        <Input
                            onChange={(event) =>
                                setFormValues((current) => ({
                                    ...current,
                                    address: event.target.value,
                                }))
                            }
                            value={formValues.address}
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium">{copy.tasteTags}</label>
                        <div className="flex flex-wrap gap-2">
                            {preferenceOptions.map((preference) => {
                                const active = formValues.preferences.includes(preference.value);
                                return (
                                    <button
                                        key={preference.value}
                                        className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                                            active
                                                ? "border-primary bg-primary-soft text-primary"
                                                : "border-border text-muted-foreground hover:bg-muted/70"
                                        }`}
                                        onClick={() => handleTogglePreference(preference.value)}
                                        type="button"
                                    >
                                        {language === "vi" ? preference.vi : preference.en}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium">{copy.images}</label>
                        <Input accept="image/*" multiple onChange={handleImageUpload} type="file" />
                        <div className="mt-3 grid grid-cols-3 gap-3">
                            {formValues.existingImages.map((image) => (
                                <div key={image} className="relative">
                                    <img
                                        alt="Existing dish"
                                        className="h-24 w-full rounded-[var(--app-radius-lg)] object-cover"
                                        src={image}
                                    />
                                    <button
                                        className="absolute right-2 top-2 rounded-full bg-slate-950/70 px-2 py-1 text-xs text-white"
                                        onClick={() =>
                                            setFormValues((current) => ({
                                                ...current,
                                                existingImages: current.existingImages.filter(
                                                    (item) => item !== image,
                                                ),
                                            }))
                                        }
                                        type="button"
                                    >
                                        {copy.remove}
                                    </button>
                                </div>
                            ))}
                            {formValues.newImages.map((image) => (
                                <div key={`${image.name}-${image.lastModified}`} className="relative">
                                    <img
                                        alt={image.name}
                                        className="h-24 w-full rounded-[var(--app-radius-lg)] object-cover"
                                        src={URL.createObjectURL(image)}
                                    />
                                    <button
                                        className="absolute right-2 top-2 rounded-full bg-slate-950/70 px-2 py-1 text-xs text-white"
                                        onClick={() =>
                                            setFormValues((current) => ({
                                                ...current,
                                                newImages: current.newImages.filter(
                                                    (item) =>
                                                        item.name !== image.name ||
                                                        item.lastModified !== image.lastModified,
                                                ),
                                            }))
                                        }
                                        type="button"
                                    >
                                        {copy.remove}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button onClick={() => setModalOpen(false)} variant="outline">
                            {copy.cancel}
                        </Button>
                        <Button disabled={saving} onClick={handleSubmit}>
                            {saving
                                ? copy.saving
                                : editingDish
                                  ? copy.updateDish
                                  : copy.createDish}
                        </Button>
                    </div>
                </div>
            </Dialog>

            <Dialog
                description={copy.randomDishDesc}
                onClose={() => setRandomDish(null)}
                open={!!randomDish}
                title={copy.randomDishTitle}
            >
                {randomDish ? (
                    <div className="space-y-4">
                        {randomDish.imageUrls[0] ? (
                            <img
                                alt={randomDish.name}
                                className="h-56 w-full rounded-[var(--app-radius-xl)] object-cover"
                                src={randomDish.imageUrls[0]}
                            />
                        ) : null}
                        <div>
                            <h3 className="text-xl font-semibold">{randomDish.name}</h3>
                            <p className="mt-2 text-sm text-muted-foreground">
                                {randomDish.description || copy.noDescription}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {randomDish.preferences.map((preference) => (
                                <Badge key={preference} variant="outline">
                                    {getPreferenceLabel(preference)}
                                </Badge>
                            ))}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {randomDish.address || copy.noAddress}
                        </p>
                    </div>
                ) : null}
            </Dialog>

            <ConfirmDialog
                busy={saving}
                cancelLabel={copy.keep}
                confirmLabel={copy.delete}
                description={
                    pendingDelete ? copy.deleteDishDesc(pendingDelete.name) : ""
                }
                onClose={() => setPendingDelete(null)}
                onConfirm={handleDelete}
                open={!!pendingDelete}
                title={copy.deleteDish}
                variant="destructive"
            />
        </div>
    );
};

export default DishSuggestions;
