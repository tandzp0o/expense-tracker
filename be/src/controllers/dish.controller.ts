import { Request, Response } from "express";
import Dish from "../models/Dish";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

export const createDish = [
  upload.array("images", 10), // Allow up to 10 images
  async (req: any, res: Response) => {
    try {
      const { name, price, description, preferences, address } = req.body;
      const userId = req.user.uid;

      let imageUrls: string[] = [];
      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
          const result = await new Promise<any>((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { folder: "dishes" },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
            stream.end(file.buffer);
          });
          imageUrls.push(result.secure_url);
        }
      }

      const dish = new Dish({
        userId,
        name,
        price:
          price && price !== "" && price !== "null" ? parseFloat(price) : null,
        description,
        imageUrls,
        preferences: preferences ? preferences.split(",") : [],
        address,
      });

      await dish.save();
      res.status(201).json(dish);
    } catch (error) {
      console.error("Error creating dish:", error);
      res.status(500).json({ message: "Lỗi tạo món ăn" });
    }
  },
];

export const getDishes = async (req: any, res: Response) => {
  try {
    const userId = req.user.uid;
    const { preferences } = req.query;

    let filter: any = { userId };
    if (preferences) {
      filter.preferences = { $in: preferences.split(",") };
    }

    const dishes = await Dish.find(filter).sort({ createdAt: -1 });
    res.json(dishes);
  } catch (error) {
    console.error("Error fetching dishes:", error);
    res.status(500).json({ message: "Lỗi lấy danh sách món ăn" });
  }
};

export const getRandomDish = async (req: any, res: Response) => {
  try {
    const userId = req.user.uid;
    const { preferences } = req.query;

    let filter: any = { userId };
    if (preferences) {
      filter.preferences = { $in: preferences.split(",") };
    }

    const dishes = await Dish.find(filter);
    if (dishes.length === 0) {
      return res.status(404).json({ message: "Không có món ăn phù hợp" });
    }

    const randomDish = dishes[Math.floor(Math.random() * dishes.length)];
    res.json(randomDish);
  } catch (error) {
    console.error("Error getting random dish:", error);
    res.status(500).json({ message: "Lỗi lấy món ngẫu nhiên" });
  }
};

export const updateDish = [
  upload.array("images", 10),
  async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const { name, price, description, preferences, existingImages, address } =
        req.body;
      const userId = req.user.uid;

      const dish = await Dish.findOne({ _id: id, userId });
      if (!dish) {
        return res.status(404).json({ message: "Không tìm thấy món ăn" });
      }

      let imageUrls: string[] = existingImages
        ? JSON.parse(existingImages)
        : dish.imageUrls || [];

      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
          const result = await new Promise<any>((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { folder: "dishes" },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
            stream.end(file.buffer);
          });
          imageUrls.push(result.secure_url);
        }
      }

      dish.name = name || dish.name;
      dish.price =
        price !== undefined && price !== "" && price !== "null"
          ? parseFloat(price)
          : price === "" || price === "null"
          ? null
          : dish.price;
      dish.description =
        description !== undefined ? description : dish.description;
      dish.imageUrls = imageUrls;
      dish.preferences = preferences
        ? preferences.split(",")
        : dish.preferences;
      dish.address = address !== undefined ? address : dish.address;

      await dish.save();
      res.json(dish);
    } catch (error) {
      console.error("Error updating dish:", error);
      res.status(500).json({ message: "Lỗi cập nhật món ăn" });
    }
  },
];

export const deleteDish = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    const dish = await Dish.findOneAndDelete({ _id: id, userId });
    if (!dish) {
      return res.status(404).json({ message: "Không tìm thấy món ăn" });
    }

    res.json({ message: "Xóa món ăn thành công" });
  } catch (error) {
    console.error("Error deleting dish:", error);
    res.status(500).json({ message: "Lỗi xóa món ăn" });
  }
};
